import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../context/AuthContext';

// Required by expo-auth-session so the browser closes cleanly after the
// Google redirect comes back into the app. Safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

// Read the three Google OAuth client IDs from EXPO_PUBLIC env vars. Any that
// aren't set will just produce a "not configured" message when the button is
// tapped — the rest of the login flow stays usable.
const GOOGLE_CLIENT_IDS = {
  iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  webClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
};

export default function LoginScreen({ navigation }) {
  const { login, googleSignIn } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Google OAuth hook — generates the auth URL and a `promptAsync` we call
  // when the user taps the button. `response` updates with the result.
  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest(GOOGLE_CLIENT_IDS);

  // Watch for the Google flow to finish, then send the id_token to our backend.
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') {
        Alert.alert('Google sign-in failed', googleResponse.error?.message || 'Please try again.');
      }
      setGoogleLoading(false);
      return;
    }

    const idToken = googleResponse.authentication?.idToken || googleResponse.params?.id_token;
    if (!idToken) {
      Alert.alert('Google sign-in failed', 'No identity token was returned. Please try again.');
      setGoogleLoading(false);
      return;
    }

    (async () => {
      const result = await googleSignIn(idToken);
      setGoogleLoading(false);
      if (!result.success) {
        Alert.alert('Sign-in failed', result.message || 'Could not sign in with Google.');
      }
      // On success, AuthContext flips isAuthenticated and App.js swaps stacks.
    })();
  }, [googleResponse, googleSignIn]);

  const handleGoogleSignIn = async () => {
    // Surface "not configured" before opening the browser if all client IDs
    // are missing — saves the user from a confusing Google error screen.
    const anyConfigured = Object.values(GOOGLE_CLIENT_IDS).some(Boolean);
    if (!anyConfigured) {
      Alert.alert(
        'Google sign-in not configured',
        'Add EXPO_PUBLIC_GOOGLE_CLIENT_ID_* values to truevision/.env and restart Metro.',
      );
      return;
    }
    setGoogleLoading(true);
    try {
      await promptGoogleAsync();
    } catch (e) {
      setGoogleLoading(false);
      Alert.alert('Google sign-in failed', e.message || 'Please try again.');
    }
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!emailOrUsername.trim()) {
      newErrors.emailOrUsername = 'Email or username is required';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await login(emailOrUsername.trim(), password);

      setLoading(false);

      if (result.success) {
        // Navigation happens automatically — AuthContext sets isAuthenticated = true
        // and App.js switches to AppStack. No alert needed.
      } else {
        if (result.requiresVerification) {
          Alert.alert(
            'Email Not Verified',
            'Please verify your email before logging in.',
            [
              {
                text: 'Verify Now',
                onPress: () => navigation.navigate('VerifyEmail', { 
                  email: result.email 
                })
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        } else {
          Alert.alert('Login Failed', result.message || 'Invalid credentials');
        }
      }
    } catch (error) {
      setLoading(false);
      console.error('Login error:', error);
      Alert.alert(
        'Error',
        'Unable to login. Please check your connection and try again.'
      );
    }
  };

  return (
    <LinearGradient
      colors={['#FFFFFF', '#F8FAFC', '#FFFFFF']}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              flex: 1,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
            className="px-6 pt-20 pb-8"
          >
            {/* Header — premium logo + welcome typography */}
            <View className="items-center" style={{ marginBottom: 44 }}>
              {/* Logo — transparent PNG sits directly on the dark background. */}
              <Image
                source={require('../assets/images/tv-icon.png')}
                style={{
                  width: 110,
                  height: 110,
                  marginBottom: 28,
                }}
                resizeMode="contain"
              />

              {/* "Welcome" with mustard-gold accent on the second half */}
              <Text style={{
                fontSize: 38,
                fontWeight: '800',
                color: '#0F172A',
                letterSpacing: -0.5,
                marginBottom: 10,
              }}>
                Wel<Text style={{ color: '#D4A017' }}>come</Text>
              </Text>

              {/* Subtitle with TrueVision in gold */}
              <Text style={{
                fontSize: 15,
                color: '#64748B',
                fontWeight: '500',
                textAlign: 'center',
              }}>
                Sign in to continue to{' '}
                <Text style={{ color: '#D4A017', fontWeight: '700' }}>TrueVision</Text>
              </Text>
            </View>

            {/* Login Form */}
            <View>
              {/* Email/Username Input */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Email or Username
                </Text>
                <View
                  className="flex-row items-center px-4 py-1"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(212, 160, 23, 0.45)',
                  }}
                >
                  <Ionicons name="person-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="Enter your email or username"
                    placeholderTextColor="#94A3B8"
                    value={emailOrUsername}
                    onChangeText={(text) => {
                      setEmailOrUsername(text);
                      setErrors({ ...errors, emailOrUsername: '' });
                    }}
                    autoCapitalize="none"
                    editable={!loading}
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
                  />
                </View>
                {errors.emailOrUsername && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">
                    {errors.emailOrUsername}
                  </Text>
                )}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Password
                </Text>
                <View
                  className="flex-row items-center px-4 py-1"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(212, 160, 23, 0.45)',
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setErrors({ ...errors, password: '' });
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">
                    {errors.password}
                  </Text>
                )}
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                className="self-end"
                style={{ marginBottom: 24 }}
                disabled={loading}
              >
                <Text style={{
                  color: '#D4A017',
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Login Button — mustard gold gradient, dark text for contrast */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={loading ? ['#64748b', '#475569'] : ['#E0B028', '#D4A017', '#B8860B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    shadowColor: '#D4A017',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: loading ? 0.1 : 0.35,
                    shadowRadius: 14,
                    elevation: loading ? 2 : 10,
                  }}
                >
                  {loading ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator color="#111111" size="small" />
                      <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', marginLeft: 10 }}>
                        Signing in...
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>
                      Sign In
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
                <Text style={{ color: '#94A3B8', fontSize: 14, marginHorizontal: 16 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
              </View>

              {/* Continue with Google — light card with subtle gold border */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading || googleLoading}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: 'rgba(212, 160, 23, 0.35)',
                  marginBottom: 24,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#D4A017" size="small" />
                ) : (
                  <>
                    {/* Inline Google "G" badge */}
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: '#4285F4',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '900',
                        color: '#FFFFFF',
                      }}>G</Text>
                    </View>
                    <Text style={{ color: '#0F172A', fontSize: 15, fontWeight: '700' }}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Register Link */}
              <View className="flex-row justify-center items-center">
                <Text style={{ color: '#64748B', fontSize: 15 }}>
                  Don&apos;t have an account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Register')}
                  disabled={loading}
                >
                  <Text style={{ color: '#D4A017', fontSize: 15, fontWeight: '700' }}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}