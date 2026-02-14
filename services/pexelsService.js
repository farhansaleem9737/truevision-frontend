import axios from 'axios';

// Get your free API key from: https://www.pexels.com/api/
const PEXELS_API_KEY = 'gkL51caadRSnzv3SlpD1JRkWAYPNFpjSvWCjlrvDpUXKW4aSTPrdd9pg'; // Replace with your key

const pexelsAPI = axios.create({
  baseURL: 'https://api.pexels.com/videos',
  headers: {
    Authorization: PEXELS_API_KEY,
  },
});

export const pexelsService = {
  // Search videos
  searchVideos: async (query = 'nature', page = 1, perPage = 15) => {
    try {
      const response = await pexelsAPI.get('/search', {
        params: {
          query,
          per_page: perPage,
          page,
        },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Pexels search error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Get popular videos
  getPopularVideos: async (page = 1, perPage = 15) => {
    try {
      const response = await pexelsAPI.get('/popular', {
        params: {
          per_page: perPage,
          page,
        },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Pexels popular error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Get video by ID
  getVideoById: async (id) => {
    try {
      const response = await pexelsAPI.get(`/videos/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Pexels get video error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

export default pexelsService;