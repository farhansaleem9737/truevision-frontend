import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import authService from '../services/AuthServices';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const validateEmail = () => {
    if (!email.trim()) {
      setError('Email address is required');
      return false;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    setError('');
    return true;
  };

  const handleSendCode = async () => {
    if (!validateEmail()) return;

    setLoading(true);

    try {
      const result = await authService.forgotPassword(email.toLowerCase().trim());

      setLoading(false);

      if (result.success) {
        Alert.alert(
          'Code Sent! 📧',
          'If an account exists with this email, a password reset code has been sent. Please check your inbox.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ResetPassword', { 
                email: email.toLowerCase().trim() 
              })
            }
          ]
        );
      } else {
        Alert.alert(
          'Failed to Send',
          result.message || 'Unable to send reset code. Please try again.'
        );
      }
    } catch (error) {
      setLoading(false);
      console.error('Forgot password error:', error);
      Alert.alert(
        'Error',
        'Unable to process your request. Please check your connection and try again.'
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
        <Animated.View
          style={{ flex: 1, opacity: fadeAnim }}
          className="px-6 pt-20"
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mb-8"
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-12">
            <View className="w-24 h-24 bg-red-500 rounded-full items-center justify-center mb-6">
              <Ionicons name="lock-closed-outline" size={48} color="#fff" />
            </View>
            
            <Text className="text-3xl font-black text-white mb-3">
              Forgot Password?
            </Text>
            <Text className="text-slate-400 text-center text-base px-8">
              No worries! Enter your email and we'll send you a reset code
            </Text>
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: 32 }}>
            <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
              Email Address
            </Text>
            <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
              <Ionicons name="mail-outline" size={20} color="#94a3b8" />
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                className="flex-1 text-white text-base px-3 py-3"
              />
            </View>
            {error && (
              <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>
            )}
          </View>

          {/* Send Code Button */}
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={loading ? ['#64748b', '#475569'] : ['#ef4444', '#dc2626', '#b91c1c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-2xl py-4 items-center"
              style={{
                shadowColor: '#ef4444',
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
                    Sending Code...
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-white text-base font-bold mr-2">
                    Send Reset Code
                  </Text>
                  <Ionicons name="send-outline" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Info */}
          <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mt-6">
            <View className="flex-row items-start">
              <Ionicons name="information-circle-outline" size={20} color="#60a5fa" />
              <View className="flex-1 ml-3">
                <Text className="text-slate-400 text-xs leading-5">
                  • We'll send a 6-digit verification code to your email{'\n'}
                  • The code will expire in 15 minutes{'\n'}
                  • Check your spam folder if you don't see the email{'\n'}
                  • For security, we won't confirm if the email exists
                </Text>
              </View>
            </View>
          </View>

          {/* Back to Login */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            className="mt-8 items-center"
            disabled={loading}
          >
            <Text className="text-slate-400 text-sm">
              Remember your password?{' '}
              <Text className="text-blue-400 font-semibold">Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}