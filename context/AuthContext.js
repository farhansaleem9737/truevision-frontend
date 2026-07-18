import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/AuthServices';
import socketService from '../services/SocketService';
import { registerForPushNotifications, unregisterPushNotifications } from '../services/pushRegistration';
import { onSessionInvalidated } from '../services/sessionGuard';

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

  // Global 401 handler. sessionGuard purges AsyncStorage and emits an event
  // whenever any request comes back with an auth-invalidating status; here
  // we mirror that in React state + tear down the socket so the navigator
  // drops the user back to the login screen instead of staying in a zombie
  // signed-in state that keeps hitting "Invalid or expired token".
  useEffect(() => {
    const off = onSessionInvalidated(({ code, reason }) => {
      console.warn(`[auth] session invalidated (${code || 'unknown'}): ${reason || ''}`);
      // Best-effort socket teardown — a stale JWT will make the socket
      // reject the next handshake anyway.
      try { socketService.disconnect(); } catch (_) { /* non-fatal */ }
      // Push-token de-registration is not called here on purpose: the token
      // is already invalid, so the /devices DELETE would 401 in a loop.
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    });
    return off;
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
        // App relaunch on a signed-in device — re-register the push token so
        // Expo/APNs rotations don't leave us out of sync with the backend.
        registerForPushNotifications().catch(() => {});
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

  // Shared success path — used by password login, Google, email-verify and
  // the 2FA completion so all four set up the session identically.
  const establishSession = (data) => {
    const normalized = normalizeUser(data.user);
    setToken(data.token);
    setUser(normalized);
    setIsAuthenticated(true);
    Promise.all([
      AsyncStorage.setItem('authToken', data.token),
      AsyncStorage.setItem('userData', JSON.stringify(normalized)),
    ]).catch((e) => console.error('AsyncStorage write error:', e));
    socketService.connect();
    registerForPushNotifications().catch(() => {});
    return normalized;
  };

  const login = async (emailOrUsername, password) => {
    try {
      const response = await authService.login(emailOrUsername, password);

      // 2FA gate: password was right, but the account wants an emailed code.
      // No token exists yet — the LoginScreen navigates to TwoFactorLogin
      // with this pendingToken; completeTwoFactor() finishes the job.
      if (response.success && response.requires2FA) {
        return {
          success: false,           // NOT signed in yet
          requires2FA: true,
          pendingToken: response.data?.pendingToken,
          email: response.data?.email,
          message: response.message,
        };
      }

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

        // Register this device's Expo push token so we can push chat
        // notifications when the user is backgrounded/killed. Fire-and-forget
        // — the user is not blocked on the OS permission prompt.
        registerForPushNotifications().catch(() => {});

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

  // Complete a 2FA sign-in: exchange the pendingToken + emailed OTP for a
  // real session. Called by TwoFactorLoginScreen.
  const completeTwoFactor = async (pendingToken, otp) => {
    try {
      const securityService = require('../services/SecurityService').default;
      const response = await securityService.verifyLoginOtp(pendingToken, otp);
      if (!response.success) {
        return { success: false, message: response.message, code: response.code };
      }
      const normalized = establishSession(response.data);
      return { success: true, message: response.message, user: normalized };
    } catch (error) {
      console.error('2FA verify error:', error);
      return { success: false, message: error.message || 'Verification failed' };
    }
  };

  // Sign in / sign up with a Google id_token. Returns the same envelope as
  // `login()` so callers can branch on `result.success` uniformly.
  const googleSignIn = async (idToken) => {
    try {
      const response = await authService.googleSignIn(idToken);

      // Google is gated by 2FA exactly like the password path — the account
      // owner still has to prove the second factor.
      if (response.success && response.requires2FA) {
        return {
          success: false,
          requires2FA: true,
          pendingToken: response.data?.pendingToken,
          email: response.data?.email,
          message: response.message,
        };
      }

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
      // Unregister this device's push token BEFORE we drop the auth header —
      // otherwise a shared device would keep receiving notifications for the
      // signed-out account until the token naturally expired.
      await unregisterPushNotifications().catch(() => {});

      // Tell the server we're signing out, while the Bearer header is still
      // attached. This is the ONLY thing that (a) adds the token to the Redis
      // revocation list and (b) closes the LoginSession row so the device
      // stops showing as "active" in Security → Login Activity. Best-effort:
      // an offline sign-out must still clear local state.
      await authService.logout().catch(() => {});

      socketService.disconnect();
      await clearAuthData();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Never strand the user in a signed-in shell — clear locally regardless.
      await clearAuthData().catch(() => {});
      return { success: true };
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
    completeTwoFactor,
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