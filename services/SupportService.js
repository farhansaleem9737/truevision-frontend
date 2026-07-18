// truevision/services/SupportService.js
//
// Client for the Help & Support API plus a direct-to-Cloudinary attachment
// uploader (with progress) reused by both the Contact and Report forms.
//
//   getFaqs()                       → GET  /api/support/faqs (public)
//   sendContact(payload)            → POST /api/support/contact
//   sendReport(payload)             → POST /api/support/report
//   getTickets({page,limit})        → GET  /api/support/tickets
//   uploadAttachment(uri, opts)     → sign + upload to Cloudinary, returns
//                                     { url, publicId, resourceType }

import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const api = axios.create({ baseURL: API_URL, timeout: 30000 });
attachSessionGuard(api);

const unwrap = async (promise) => {
  try {
    const res = await promise;
    return res.data;
  } catch (e) {
    return { success: false, message: e.response?.data?.message || 'Network error' };
  }
};

// Map Cloudinary resource type → upload endpoint segment.
const endpointFor = (resourceType) =>
  resourceType === 'video' ? 'video' : resourceType === 'raw' ? 'raw' : 'image';

// Direct XHR upload so we get real progress events (axios/fetch don't expose
// upload progress in React Native reliably).
const uploadToCloudinary = (fileUri, mimeType, name, sig, onProgress) =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', { uri: fileUri, type: mimeType || 'application/octet-stream', name: name || 'attachment' });
    form.append('api_key',   sig.api_key);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder',    sig.folder);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.total > 0 && onProgress) onProgress(Math.min(Math.round((e.loaded / e.total) * 100), 99));
    };
    xhr.onload = () => {
      let body;
      try { body = JSON.parse(xhr.responseText); } catch { return reject(new Error('Bad response from Cloudinary')); }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve(body);
      } else {
        reject(new Error(body?.error?.message || `Upload failed (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror   = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = 120000;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${endpointFor(sig.resourceType)}/upload`);
    xhr.send(form);
  });

const supportService = {
  getFaqs:     (params = {}) => unwrap(api.get('/support/faqs', { params })),
  sendContact: (payload)     => unwrap(api.post('/support/contact', payload)),
  sendReport:  (payload)     => unwrap(api.post('/support/report', payload)),
  getTickets:  ({ page = 1, limit = 20, type } = {}) =>
    unwrap(api.get('/support/tickets', { params: { page, limit, ...(type ? { type } : {}) } })),

  /**
   * Sign + upload one attachment.
   * @param {string} fileUri  local file uri
   * @param {object} opts     { kind: 'support-image'|'support-video'|'support-doc', mimeType, name, onProgress, attachmentKind }
   * @returns {Promise<{success, url, publicId, resourceType, name, mime}|{success:false,message}>}
   */
  uploadAttachment: async (fileUri, opts = {}) => {
    const { kind = 'support-image', mimeType, name, onProgress } = opts;
    try {
      const sigRes = await api.get('/users/media-signature', { params: { kind } });
      if (!sigRes.data?.success) {
        return { success: false, message: sigRes.data?.message || 'Could not start upload' };
      }
      const cloud = await uploadToCloudinary(fileUri, mimeType, name, sigRes.data, onProgress);
      if (!cloud?.secure_url) return { success: false, message: 'Upload did not return a URL' };
      return {
        success: true,
        url: cloud.secure_url,
        publicId: cloud.public_id,
        resourceType: sigRes.data.resourceType,
        name: name || cloud.original_filename || 'attachment',
        mime: mimeType || '',
      };
    } catch (e) {
      return { success: false, message: e.message || 'Upload failed' };
    }
  },
};

export default supportService;
