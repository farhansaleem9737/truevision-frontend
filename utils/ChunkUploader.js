// truevision/utils/ChunkUploader.js
//
// Chunked upload to Cloudinary via expo-file-system + native XMLHttpRequest.
//
// How it works:
//  1. Read N bytes from the source file into a temp file (expo-file-system base64 slice).
//  2. Upload the temp file via XHR with Content-Range + X-Unique-Upload-Id headers.
//  3. Cloudinary assembles the chunks and returns the full resource on the final chunk.
//  4. Temp files are cleaned up after each chunk regardless of success/failure.
//
// Progress: onProgress receives values in [30, 94] — caller maps that to the full bar.

import * as FileSystem from 'expo-file-system';

// ─────────────────────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 6 * 1024 * 1024;  // 6 MB per chunk
const MAX_RETRIES   = 3;
const RETRY_DELAY   = 2000;             // ms between retries

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Upload a single pre-written chunk temp file to Cloudinary. */
const uploadChunkFile = (
  tempUri,
  cloudinaryUrl,
  sigData,
  { start, end, totalSize, uploadId, onProgress },
) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();

    // file field — React Native native stack reads the temp URI as real bytes
    formData.append('file', { uri: tempUri, type: 'video/mp4', name: 'chunk.mp4' });

    // Auth params on every chunk (required by Cloudinary — every part of a
    // chunked upload must carry the SAME signed params byte-for-byte).
    formData.append('api_key',   sigData.api_key);
    formData.append('timestamp', String(sigData.timestamp));
    formData.append('signature', sigData.signature);
    formData.append('folder',    sigData.folder);
    // Forward eager transforms so Cloudinary pre-generates 720p + 360p as
    // part of the final chunk's assembly. Signed on the server; if absent
    // (older signature response) we skip — chunk uploads must not add
    // fields that weren't in the signature.
    if (sigData.eager)       formData.append('eager',       sigData.eager);
    if (sigData.eager_async) formData.append('eager_async', sigData.eager_async);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.total > 0 && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body;
      try   { body = JSON.parse(xhr.responseText); }
      catch (_) { return reject(new Error('Unreadable response from Cloudinary')); }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject(new Error(body?.error?.message || `HTTP ${xhr.status}`));
      }
    };

    xhr.onerror   = () => reject(new Error('Network request failed during chunk upload'));
    xhr.ontimeout = () => reject(new Error('Chunk upload timed out — check your connection'));

    xhr.timeout = 120000; // 2 min per chunk
    xhr.open('POST', cloudinaryUrl);

    // These two headers are what makes it a chunked upload in Cloudinary's eyes
    xhr.setRequestHeader('X-Unique-Upload-Id', uploadId);
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);

    xhr.send(formData);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a local video file to Cloudinary in 6 MB chunks.
 *
 * @param {string} fileUri          Local file URI (already compressed)
 * @param {string} cloudinaryUrl    https://api.cloudinary.com/v1_1/{cloud}/video/upload
 * @param {object} sigData          { api_key, timestamp, signature, folder }
 * @param {object} opts
 * @param {function} [opts.onProgress]  Receives values 30-94 (maps into overall progress bar)
 *
 * @returns {object} Cloudinary response from the final chunk (contains public_id, secure_url, …)
 * @throws  {Error}  on unrecoverable failure after retries
 */
export const uploadInChunks = async (fileUri, cloudinaryUrl, sigData, { onProgress } = {}) => {
  // ── Get file size ──────────────────────────────────────────────────────────
  const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
  if (!fileInfo.exists) throw new Error('Compressed video file not found');

  const totalSize = fileInfo.size;
  const numChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const uploadId  = `tv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  console.log(`[ChunkUploader] ${numChunks} chunk(s), total ${(totalSize / 1024 / 1024).toFixed(1)} MB, id=${uploadId}`);

  let cloudResult = null;

  for (let i = 0; i < numChunks; i++) {
    const start     = i * CHUNK_SIZE;
    const end       = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
    const chunkSize = end - start + 1;

    // ── Read chunk bytes as base64 ─────────────────────────────────────────
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: start,
      length:   chunkSize,
    });

    // ── Write chunk to temp file ───────────────────────────────────────────
    const tempUri = `${FileSystem.cacheDirectory}tv_chunk_${i}_${Date.now()}.mp4`;
    await FileSystem.writeAsStringAsync(tempUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // ── Upload chunk (with retry) ──────────────────────────────────────────
    let attempt = 0;
    let lastErr;
    try {
      while (attempt < MAX_RETRIES) {
        try {
          cloudResult = await uploadChunkFile(tempUri, cloudinaryUrl, sigData, {
            start,
            end,
            totalSize,
            uploadId,
            onProgress: (chunkPct) => {
              // Map this chunk's 0-100% onto the global 30-94% window
              const windowStart = 30 + (i / numChunks) * 64;
              const windowSize  = (1 / numChunks) * 64;
              const overall     = Math.round(windowStart + (chunkPct / 100) * windowSize);
              onProgress?.(Math.min(overall, 94));
            },
          });

          console.log(`[ChunkUploader] Chunk ${i + 1}/${numChunks} OK`);
          break; // success — exit retry loop

        } catch (err) {
          lastErr = err;
          attempt++;
          if (attempt < MAX_RETRIES) {
            console.warn(`[ChunkUploader] Chunk ${i + 1} failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message} — retrying…`);
            await sleep(RETRY_DELAY * attempt); // 2s, 4s back-off
          }
        }
      }

      if (attempt >= MAX_RETRIES) {
        throw new Error(`Chunk ${i + 1}/${numChunks} failed after ${MAX_RETRIES} attempts: ${lastErr?.message}`);
      }

    } finally {
      // Always clean up the temp chunk file
      await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
    }
  }

  if (!cloudResult?.public_id) {
    throw new Error('Chunked upload completed but Cloudinary returned no resource ID');
  }

  return cloudResult;
};

/**
 * Get file size in bytes (0 if unavailable).
 * Used by VideoService to decide between direct vs chunked upload.
 */
export const getFileSize = async (uri) => {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return info.exists ? (info.size || 0) : 0;
  } catch (_) {
    return 0;
  }
};
