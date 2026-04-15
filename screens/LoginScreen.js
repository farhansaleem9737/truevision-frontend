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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

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
      colors={['#0f172a', '#1e293b', '#334155']}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

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
            {/* Header */}
            <View className="items-center mb-10">
              <View className="w-20 h-20 bg-blue-500 rounded-full items-center justify-center mb-4">
                <Text style={{ fontSize: 40 }}>🎬</Text>
              </View>
              <Text className="text-4xl font-black text-white mb-2">Welcome Back</Text>
              <Text className="text-slate-400 text-base">Sign in to continue to TrueVision</Text>
            </View>

            {/* Login Form */}
            <View>
              {/* Email/Username Input */}
              <View style={{ marginBottom: 20 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Email or Username
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="person-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="Enter your email or username"
                    placeholderTextColor="#64748b"
                    value={emailOrUsername}
                    onChangeText={(text) => {
                      setEmailOrUsername(text);
                      setErrors({ ...errors, emailOrUsername: '' });
                    }}
                    autoCapitalize="none"
                    editable={!loading}
                    className="flex-1 text-white text-base px-3 py-3"
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
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Password
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setErrors({ ...errors, password: '' });
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    className="flex-1 text-white text-base px-3 py-3"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#94a3b8"
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
                style={{ marginBottom: 20 }}
                disabled={loading}
              >
                <Text className="text-blue-400 text-sm font-medium">
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ['#64748b', '#475569'] : ['#3b82f6', '#2563eb', '#1d4ed8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="rounded-2xl py-4 items-center"
                  style={{
                    shadowColor: '#3b82f6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: loading ? 0.1 : 0.3,
                    shadowRadius: 8,
                    elevation: loading ? 2 : 8,
                  }}
                >
                  {loading ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator color="#fff" size="small" />
                      <Text className="text-white text-base font-bold ml-2">
                        Signing in...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white text-base font-bold">
                      Sign In
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-px bg-slate-700" />
                <Text className="text-slate-500 text-sm mx-4">or</Text>
                <View className="flex-1 h-px bg-slate-700" />
              </View>

              {/* Register Link */}
              <View className="flex-row justify-center items-center">
                <Text className="text-slate-400 text-base">
                  Don't have an account?{' '}
                </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Register')}
                  disabled={loading}
                >
                  <Text className="text-blue-400 text-base font-semibold">
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