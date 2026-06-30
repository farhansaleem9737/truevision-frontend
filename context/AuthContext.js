import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/AuthServices';
import socketService from '../services/SocketService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Normalise the user object so consumers can rely on `_id`. Older login
// responses (and any data already in AsyncStorage) used `id` instead.
const normalizeUser = (u) => {
  if (!u) return u;
  if (u._id) return u;
  if (u.id)  return { ...u, _id: u.id };
  return u;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user data on app start
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Read both keys in parallel instead of sequentially
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem('authToken'),
        AsyncStorage.getItem('userData'),
      ]);

      if (storedToken && storedUser) {
        // Trust the stored token immediately — no network call on startup.
        // This eliminates the server round-trip that was blocking the app.
        const parsed = normalizeUser(JSON.parse(storedUser));
        setToken(storedToken);
        setUser(parsed);
        setIsAuthenticated(true);
        // Heal stored data so future reads have `_id` even before the user
        // touches anything that triggers updateUser.
        if (parsed && !JSON.parse(storedUser)._id && parsed._id) {
          AsyncStorage.setItem('userData', JSON.stringify(parsed)).catch(() => {});
        }
        // Connect Socket.IO for real-time chat
        socketService.connect();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      await clearAuthData();
    } finally {
      setLoading(false);
    }
  };

  const clearAuthData = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  // Manual refresh method
  const refreshAuthState = useCallback(async () => {
    setLoading(true);
    await loadUserData();
  }, []);

  const login = async (emailOrUsername, password) => {
    try {
      const response = await authService.login(emailOrUsername, password);

      if (response.success) {
        const normalized = normalizeUser(response.data.user);
        // Update state immediately — don't block on storage writes
        setToken(response.data.token);
        setUser(normalized);
        setIsAuthenticated(true);

        // Write both keys in parallel in the background
        Promise.all([
          AsyncStorage.setItem('authToken', response.data.token),
          AsyncStorage.setItem('userData', JSON.stringify(normalized)),
        ]).catch(e => console.error('AsyncStorage write error:', e));

        // Connect Socket.IO for real-time chat
        socketService.connect();

        return {
          success: true,
          message: response.message,
          user: normalized,
        };
      } else {
        return { 
          success: false, 
          message: response.message, 
          requiresVerification: response.requiresVerification, 
          email: response.email 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.message || 'Login failed. Please try again.' 
      };
    }
  };

  // Sign in / sign up with a Google id_token. Returns the same envelope as
  // `login()` so callers can branch on `result.success` uniformly.
  const googleSignIn = async (idToken) => {
    try {
      const response = await authService.googleSignIn(idToken);
      if (!response.success) {
        return { success: false, message: response.message || 'Google sign-in failed' };
      }

      const normalized = normalizeUser(response.data.user);
      setToken(response.data.token);
      setUser(normalized);
      setIsAuthenticated(true);

      Promise.all([
        AsyncStorage.setItem('authToken', response.data.token),
        AsyncStorage.setItem('userData', JSON.stringify(normalized)),
      ]).catch((e) => console.error('AsyncStorage write error:', e));

      socketService.connect();

      return { success: true, message: response.message, user: normalized };
    } catch (error) {
      console.error('Google sign-in error:', error);
      return { success: false, message: error.message || 'Google sign-in failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        message: error.message || 'Registration failed. Please try again.' 
      };
    }
  };

  const verifyEmail = async (email, otp) => {
    try {
      const response = await authService.verifyEmail(email, otp);

      if (response.success) {
        const normalized = normalizeUser(response.data.user);
        setToken(response.data.token);
        setUser(normalized);
        setIsAuthenticated(true);

        Promise.all([
          AsyncStorage.setItem('authToken', response.data.token),
          AsyncStorage.setItem('userData', JSON.stringify(normalized)),
        ]).catch(e => console.error('AsyncStorage write error:', e));
      }

      return response;
    } catch (error) {
      console.error('Verification error:', error);
      return { 
        success: false, 
        message: error.message || 'Verification failed. Please try again.' 
      };
    }
  };

  const logout = async () => {
    try {
      socketService.disconnect();
      await clearAuthData();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false, 
        message: 'Logout failed. Please try again.' 
      };
    }
  };

  const updateUser = async (updatedData) => {
    try {
      const updatedUser = normalizeUser({ ...user, ...updatedData });
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { 
        success: false, 
        message: 'Failed to update user data' 
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    googleSignIn,
    register,
    verifyEmail,
    logout,
    updateUser,
    refreshAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;