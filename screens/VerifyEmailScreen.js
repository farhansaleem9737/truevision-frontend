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
import { useAuth } from '../context/AuthContext';
import authService from '../services/AuthServices';

export default function VerifyEmailScreen({ route, navigation }) {
  const { email } = route.params;
  const { verifyEmail } = useAuth();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const inputRefs = useRef([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Pulse animation for OTP boxes
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Timer for resend OTP
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit when all 6 digits are entered
    if (index === 5 && value && newOtp.every(digit => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode = null) => {
    const code = otpCode || otp.join('');
    
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyEmail(email, code);
      
      setLoading(false);

      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          'Your email has been verified successfully. Welcome to TrueVision!',
          [
            { 
              text: 'Get Started', 
              onPress: () => {
                // Navigation will happen automatically via AuthContext
                // The App.js will detect isAuthenticated = true
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Verification Failed',
          result.message || 'Invalid or expired code. Please try again or request a new code.'
        );
        // Clear OTP on failure
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      setLoading(false);
      console.error('Verification error:', error);
      Alert.alert(
        'Error',
        'Unable to verify. Please check your connection and try again.'
      );
    }
  };

  const handleResendOTP = async () => {
    if (!canResend || resendLoading) return;

    setResendLoading(true);

    try {
      const result = await authService.resendOTP(email);
      
      setResendLoading(false);

      if (result.success) {
        Alert.alert(
          'Code Sent!',
          'A new verification code has been sent to your email. Please check your inbox.'
        );
        setResendTimer(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert(
          'Failed to Send',
          result.message || 'Unable to send verification code. Please try again.'
        );
      }
    } catch (error) {
      setResendLoading(false);
      console.error('Resend OTP error:', error);
      Alert.alert(
        'Error',
        'Unable to resend code. Please check your connection and try again.'
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
            className="mb-6"
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-12">
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }] }}
              className="w-24 h-24 bg-blue-500 rounded-full items-center justify-center mb-6"
            >
              <Ionicons name="mail-outline" size={48} color="#fff" />
            </Animated.View>
            
            <Text className="text-3xl font-black text-white mb-3">
              Verify Your Email
            </Text>
            <Text className="text-slate-400 text-center text-base px-8">
              We've sent a 6-digit code to{'\n'}
              <Text className="text-blue-400 font-semibold">{email}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View className="mb-8">
            <Text className="text-slate-300 text-sm font-medium mb-4 text-center">
              Enter Verification Code
            </Text>
            
            <View className="flex-row justify-center mb-6" style={{ gap: 8 }}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  maxLength={1}
                  keyboardType="number-pad"
                  editable={!loading}
                  className={`w-12 h-14 bg-slate-800/50 rounded-xl text-white text-2xl font-bold text-center border-2 ${
                    digit ? 'border-blue-500' : 'border-slate-700'
                  }`}
                  style={{
                    shadowColor: digit ? '#3b82f6' : '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: digit ? 0.3 : 0.1,
                    shadowRadius: 4,
                    elevation: digit ? 4 : 2,
                  }}
                />
              ))}
            </View>

            {/* Resend Timer */}
            <View className="items-center mb-6">
              {resendLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#3b82f6" size="small" />
                  <Text className="text-slate-400 text-sm ml-2">Sending code...</Text>
                </View>
              ) : !canResend ? (
                <Text className="text-slate-400 text-sm">
                  Resend code in <Text className="text-blue-400 font-semibold">{resendTimer}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOTP} disabled={loading}>
                  <Text className="text-blue-400 text-sm font-semibold">
                    Resend Verification Code
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              onPress={() => handleVerify()}
              disabled={loading || otp.some(digit => digit === '')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  loading || otp.some(digit => digit === '')
                    ? ['#64748b', '#475569']
                    : ['#3b82f6', '#2563eb', '#1d4ed8']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-2xl py-4 items-center"
                style={{
                  shadowColor: '#3b82f6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: loading || otp.some(digit => digit === '') ? 0.1 : 0.3,
                  shadowRadius: 8,
                  elevation: loading || otp.some(digit => digit === '') ? 2 : 8,
                }}
              >
                {loading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-white text-base font-bold ml-2">
                      Verifying...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Text className="text-white text-base font-bold mr-2">
                      Verify Email
                    </Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Info Box */}
          <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
            <View className="flex-row items-start">
              <Ionicons name="information-circle-outline" size={20} color="#60a5fa" />
              <View className="flex-1 ml-3">
                <Text className="text-blue-400 text-sm font-semibold mb-1">
                  Didn't receive the code?
                </Text>
                <Text className="text-slate-400 text-xs leading-5">
                  • Check your spam/junk folder{'\n'}
                  • Make sure {email} is correct{'\n'}
                  • Wait for the timer and resend if needed{'\n'}
                  • The code expires in 15 minutes
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
              Back to{' '}
              <Text className="text-blue-400 font-semibold">Login</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}