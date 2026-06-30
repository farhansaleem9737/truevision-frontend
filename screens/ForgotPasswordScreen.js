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
      colors={['#FFFFFF', '#F8FAFC', '#FFFFFF']}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-12">
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: 'rgba(212, 160, 23, 0.12)' }}
            >
              <Ionicons name="lock-closed-outline" size={48} color="#D4A017" />
            </View>

            <Text style={{ fontSize: 30, fontWeight: '900', color: '#0F172A', marginBottom: 10 }}>
              Forgot <Text style={{ color: '#D4A017' }}>Password?</Text>
            </Text>
            <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', paddingHorizontal: 32, fontWeight: '500' }}>
              No worries! Enter your email and we&apos;ll send you a reset code
            </Text>
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
              Email Address
            </Text>
            <View
              className="flex-row items-center px-4 py-1"
              style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}
            >
              <Ionicons name="mail-outline" size={20} color="#D4A017" />
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
              />
            </View>
            {error && (
              <Text className="text-red-500 text-xs mt-1 ml-1">{error}</Text>
            )}
          </View>

          {/* Send Code Button */}
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={loading ? ['#94A3B8', '#64748B'] : ['#E0B028', '#D4A017', '#B8860B']}
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
                    Sending Code...
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', marginRight: 8 }}>
                    Send Reset Code
                  </Text>
                  <Ionicons name="send-outline" size={20} color="#111111" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Info */}
          <View
            className="rounded-2xl p-4 mt-6"
            style={{ backgroundColor: 'rgba(212, 160, 23, 0.08)', borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.25)' }}
          >
            <View className="flex-row items-start">
              <Ionicons name="information-circle-outline" size={20} color="#D4A017" />
              <View className="flex-1 ml-3">
                <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
                  • We&apos;ll send a 6-digit verification code to your email{'\n'}
                  • The code will expire in 15 minutes{'\n'}
                  • Check your spam folder if you don&apos;t see the email{'\n'}
                  • For security, we won&apos;t confirm if the email exists
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
            <Text style={{ color: '#64748B', fontSize: 14 }}>
              Remember your password?{' '}
              <Text style={{ color: '#D4A017', fontWeight: '700' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}