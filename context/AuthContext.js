import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/AuthServices';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
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
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
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
        // Update state immediately — don't block on storage writes
        setToken(response.data.token);
        setUser(response.data.user);
        setIsAuthenticated(true);

        // Write both keys in parallel in the background
        Promise.all([
          AsyncStorage.setItem('authToken', response.data.token),
          AsyncStorage.setItem('userData', JSON.stringify(response.data.user)),
        ]).catch(e => console.error('AsyncStorage write error:', e));
        
        return { 
          success: true, 
          message: response.message,
          user: response.data.user 
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
        // Update state immediately — don't block on storage writes
        setToken(response.data.token);
        setUser(response.data.user);
        setIsAuthenticated(true);

        Promise.all([
          AsyncStorage.setItem('authToken', response.data.token),
          AsyncStorage.setItem('userData', JSON.stringify(response.data.user)),
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
      const updatedUser = { ...user, ...updatedData };
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
    register,
    verifyEmail,
    logout,
    updateUser,
    refreshAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;