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
            className="mb-6"
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-12">
            <Animated.View
              style={{
                transform: [{ scale: pulseAnim }],
                backgroundColor: 'rgba(212, 160, 23, 0.12)',
              }}
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
            >
              <Ionicons name="mail-outline" size={48} color="#D4A017" />
            </Animated.View>

            <Text style={{ fontSize: 30, fontWeight: '900', color: '#0F172A', marginBottom: 10 }}>
              Verify Your <Text style={{ color: '#D4A017' }}>Email</Text>
            </Text>
            <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', paddingHorizontal: 32, fontWeight: '500' }}>
              We&apos;ve sent a 6-digit code to{'\n'}
              <Text style={{ color: '#D4A017', fontWeight: '700' }}>{email}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View className="mb-8">
            <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 16, textAlign: 'center' }}>
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
                  style={{
                    width: 48, height: 56,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: digit ? '#D4A017' : 'rgba(212, 160, 23, 0.35)',
                    color: '#0F172A',
                    fontSize: 22,
                    fontWeight: '700',
                    textAlign: 'center',
                    shadowColor: digit ? '#D4A017' : '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: digit ? 0.25 : 0.04,
                    shadowRadius: 4,
                    elevation: digit ? 4 : 1,
                  }}
                />
              ))}
            </View>

            {/* Resend Timer */}
            <View className="items-center mb-6">
              {resendLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#D4A017" size="small" />
                  <Text style={{ color: '#64748B', fontSize: 14, marginLeft: 8 }}>Sending code...</Text>
                </View>
              ) : !canResend ? (
                <Text style={{ color: '#64748B', fontSize: 14 }}>
                  Resend code in <Text style={{ color: '#D4A017', fontWeight: '700' }}>{resendTimer}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOTP} disabled={loading}>
                  <Text style={{ color: '#D4A017', fontSize: 14, fontWeight: '700' }}>
                    Resend Verification Code
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              onPress={() => handleVerify()}
              disabled={loading || otp.some(digit => digit === '')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  loading || otp.some(digit => digit === '')
                    ? ['#94A3B8', '#64748B']
                    : ['#E0B028', '#D4A017', '#B8860B']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  shadowColor: '#D4A017',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: loading || otp.some(digit => digit === '') ? 0.1 : 0.35,
                  shadowRadius: 14,
                  elevation: loading || otp.some(digit => digit === '') ? 2 : 10,
                }}
              >
                {loading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#111111" size="small" />
                    <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', marginLeft: 10 }}>
                      Verifying...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', marginRight: 8 }}>
                      Verify Email
                    </Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#111111" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Info Box */}
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: 'rgba(212, 160, 23, 0.08)', borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.25)' }}
          >
            <View className="flex-row items-start">
              <Ionicons name="information-circle-outline" size={20} color="#D4A017" />
              <View className="flex-1 ml-3">
                <Text style={{ color: '#D4A017', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                  Didn&apos;t receive the code?
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
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
            <Text style={{ color: '#64748B', fontSize: 14 }}>
              Back to{' '}
              <Text style={{ color: '#D4A017', fontWeight: '700' }}>Login</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}