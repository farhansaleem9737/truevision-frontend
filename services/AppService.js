// truevision/services/AppService.js
//
// Client for the public App-info + Legal endpoints that power the About module:
//   GET /api/app/info | /api/app/version | /api/app/changelog
//   GET /api/legal/terms | /api/legal/privacy
//
// These are public (no auth required). We still attach the session guard so a
// signed-in user's token rides along harmlessly and consistently.

import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });
attachSessionGuard(api);

const unwrap = async (promise) => {
  try {
    const res = await promise;
    return res.data; // { success, ... }
  } catch (e) {
    return { success: false, message: e.response?.data?.message || 'Network error' };
  }
};

const appService = {
  getInfo:      () => unwrap(api.get('/app/info')),
  getVersion:   () => unwrap(api.get('/app/version')),
  getChangelog: () => unwrap(api.get('/app/changelog')),
  getTerms:     () => unwrap(api.get('/legal/terms')),
  getPrivacy:   () => unwrap(api.get('/legal/privacy')),
};

export default appService;
