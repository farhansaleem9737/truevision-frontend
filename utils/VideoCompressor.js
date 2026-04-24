// truevision/utils/VideoCompressor.js
//
// Client-side video compression via ffmpeg-kit-react-native.
// Gracefully skips compression if the native package is not linked.
//
// Installation (requires a custom dev build — does NOT work in Expo Go):
//   npx expo install ffmpeg-kit-react-native
//
// Usage:
//   const result = await compressVideo(uri, { onProgress, durationMs });
//   if (result.success) { /* use result.uri */ }

import * as FileSystem from 'expo-file-system';

// ── Try to load the native FFmpeg module ──────────────────────────────────────
let FFmpegKit   = null;
let ReturnCode  = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const mod = require('ffmpeg-kit-react-native');
  FFmpegKit  = mod.FFmpegKit;
  ReturnCode = mod.ReturnCode;
} catch (_) {
  // Package not installed or not linked — compression will be skipped
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Silently delete a single temp file. */
export const deleteTempFile = async (uri) => {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (_) {}
};

/** Remove all temp files written by this module (compressed + chunk files). */
export const cleanupTempVideos = async () => {
  try {
    const dir   = FileSystem.cacheDirectory;
    const files = await FileSystem.readDirectoryAsync(dir);
    await Promise.all(
      files
        .filter(f => f.startsWith('tv_compressed_') || f.startsWith('tv_chunk_'))
        .map(f => FileSystem.deleteAsync(`${dir}${f}`, { idempotent: true })),
    );
  } catch (_) {}
};

// ─────────────────────────────────────────────────────────────────────────────
// compressVideo
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Compress a video to 720p H.264, 2 Mbps, 30 fps, AAC 128 kbps, MP4.
 *
 * @param {string} inputUri     Local file URI from ImagePicker
 * @param {object} opts
 * @param {function} [opts.onProgress]   (0-30) => void  — called as compression advances
 * @param {number}  [opts.durationMs]    Video duration in ms — used to estimate progress
 *
 * @returns {{ success: true, uri: string, compressed: boolean, skipped?: boolean }}
 *          Always resolves (never rejects) — on failure it falls back to original URI.
 */
export const compressVideo = async (inputUri, { onProgress, durationMs } = {}) => {
  const report = (p) => onProgress?.(Math.min(Math.round(p), 29));

  // ── Fallback: FFmpegKit not available ─────────────────────────────────────
  if (!FFmpegKit) {
    console.log('[VideoCompressor] ffmpeg-kit-react-native not linked — skipping compression');
    onProgress?.(30);
    return { success: true, uri: inputUri, compressed: false, skipped: true };
  }

  const outputUri = `${FileSystem.cacheDirectory}tv_compressed_${Date.now()}.mp4`;

  // Scale filter — limits to 1280 on the long edge, keeps aspect ratio, even dimensions
  // • Landscape (iw > ih): caps width at 1280, height auto
  // • Portrait  (ih >= iw): caps height at 1280, width auto
  const scaleFilter =
    "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'";

  const command = [
    '-i',          inputUri,
    '-vf',         scaleFilter,
    '-c:v',        'libx264',
    '-preset',     'veryfast',
    '-crf',        '28',
    '-maxrate',    '2M',
    '-bufsize',    '4M',
    '-r',          '30',
    '-c:a',        'aac',
    '-b:a',        '128k',
    '-movflags',   '+faststart',
    '-y',
    outputUri,
  ].join(' ');

  return new Promise((resolve) => {
    FFmpegKit.executeAsync(
      command,

      // ── Complete callback ────────────────────────────────────────────────
      async (session) => {
        const rc = await session.getReturnCode();

        if (ReturnCode.isSuccess(rc)) {
          const info = await FileSystem.getInfoAsync(outputUri, { size: true });
          if (info.exists && info.size > 0) {
            onProgress?.(30);
            console.log(`[VideoCompressor] Compressed to ${(info.size / 1024 / 1024).toFixed(1)} MB`);
            resolve({ success: true, uri: outputUri, compressed: true });
          } else {
            // Output file empty — fall back to original
            await deleteTempFile(outputUri);
            onProgress?.(30);
            resolve({ success: true, uri: inputUri, compressed: false, skipped: true });
          }
        } else {
          const logs = await session.getAllLogsAsString();
          console.warn('[VideoCompressor] FFmpeg failed:', logs?.slice(-500));
          await deleteTempFile(outputUri);
          onProgress?.(30);
          resolve({ success: true, uri: inputUri, compressed: false, skipped: true });
        }
      },

      // ── Log callback (suppress) ──────────────────────────────────────────
      null,

      // ── Statistics callback — used for progress ──────────────────────────
      (stats) => {
        const timeMs = stats.getTime(); // ms of video processed so far
        if (timeMs > 0 && durationMs > 0) {
          // Map processed time → 0-29%
          const pct = (timeMs / durationMs) * 29;
          report(pct);
        }
      },
    );
  });
};
