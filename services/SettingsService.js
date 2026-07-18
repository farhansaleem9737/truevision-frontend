// truevision/services/SettingsService.js
//
// Client for the account-level settings API (Backend/routes/SettingsRoutes.js).
// Currently: UI language. Uses the shared axios + session-guard setup so 401s
// tear down the session like every other authenticated call.

import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const api = axios.create({ baseURL: `${API_URL}/settings`, timeout: 15000 });
attachSessionGuard(api);

const settingsService = {
  // GET /api/settings/language → { success, language, supported }
  getLanguage: async () => {
    try {
      const res = await api.get('/language');
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // PATCH /api/settings/language { language } → { success, language, supported }
  updateLanguage: async (language) => {
    try {
      const res = await api.patch('/language', { language });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },
};

export default settingsService;
