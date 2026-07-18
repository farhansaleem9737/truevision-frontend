// truevision/services/AiService.js
//
// React Native wrapper for the AI endpoints exposed by Node at /api/ai/*.
// Not wired into any screen yet — drop the import into whichever screen
// needs the call (e.g. a future "Ask TrueVision" chatbot screen) and use
// the methods below.
//
// Auth: JWT is attached automatically — same pattern as other services
// in this folder (VideoService, UserService, etc.).
//
// Error policy: every method returns the response data on success, or
// `{ success: false, message }` on network failure. They never throw, so
// screens can switch on the success flag without try/catch ceremony.

import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const api = axios.create({
  baseURL: `${API_URL}/ai`,
  timeout: 30000,
});

attachSessionGuard(api);

// ─────────────────────────────────────────────────────────────────────────────

const aiService = {

  // ── /predict — classify a snippet of text ───────────────────────────────
  //
  // Returns: { success, category, confidence, all_scores }
  predict: async (text) => {
    try {
      const res = await api.post('/predict', { text });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Prediction failed' };
    }
  },

  // ── /recommend — ranked list of candidates ──────────────────────────────
  //
  // candidates: array of video objects (see Backend schema)
  // user:       optional { interests: [], watch_history_categories: {} }
  //
  // Returns: { success, items: [{ video_id, score, reason }] }
  recommend: async (candidates, user) => {
    try {
      const res = await api.post('/recommend', { candidates, user });
      return res.data;
    } catch (e) {
      return { success: false, items: [], message: e.response?.data?.message || 'Recommend failed' };
    }
  },

  // ── /moderate — image or frame-batch NSFW check ─────────────────────────
  //
  // Pass `{ imageUrl }` for a single image or `{ imageUrls }` for video frames.
  //
  // Returns: { success, status: 'SAFE'|'NSFW'|'PORN', confidence, detections }
  moderate: async ({ imageUrl, imageUrls }) => {
    try {
      const payload = {};
      if (imageUrl)  payload.image_url  = imageUrl;
      if (imageUrls) payload.image_urls = imageUrls;
      const res = await api.post('/moderate', payload);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Moderation failed' };
    }
  },

  // ── /chatbot — FAQ chatbot ──────────────────────────────────────────────
  //
  // message: user's question
  // history: optional [{ role: 'user' | 'bot', text }] for future generative use
  //
  // Returns: { success, answer, matched_question, confidence }
  chat: async (message, history = []) => {
    try {
      const res = await api.post('/chatbot', { message, history });
      return res.data;
    } catch (e) {
      return {
        success: false,
        answer: 'The assistant is offline right now. Please try again in a moment.',
        message: e.response?.data?.message || 'Chat failed',
      };
    }
  },

  // ── /health — service liveness ──────────────────────────────────────────
  health: async () => {
    try {
      const res = await api.get('/health');
      return res.data;
    } catch (e) {
      return { success: false, ai: { status: 'down' } };
    }
  },
};

export default aiService;

/*
─── Usage examples ──────────────────────────────────────────────────────────

import aiService from '../services/AiService';

// 1. Classify a caption before submitting an upload
const { category, confidence } = await aiService.predict('Learn Python today');

// 2. Re-rank a list of candidate videos for the current viewer
const { items } = await aiService.recommend(candidates, {
  interests: ['python', 'machine learning'],
  watch_history_categories: { Educational: 12, Professional: 4 },
});

// 3. Run NSFW moderation on a video preview frame
const { status, confidence } = await aiService.moderate({
  imageUrl: 'https://res.cloudinary.com/.../thumb.jpg',
});

// 4. FAQ chatbot
const { answer } = await aiService.chat('How do I upload a video?');
*/
