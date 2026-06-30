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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import authService from '../services/AuthServices';

export default function ResetPasswordScreen({ route, navigation }) {
  const { email } = route.params;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const inputRefs = useRef([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrors({ ...errors, otp: '' });

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validateForm = () => {
    const newErrors = {};

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      newErrors.otp = 'Please enter the complete 6-digit code';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    const otpCode = otp.join('');
    setLoading(true);

    try {
      const result = await authService.resetPassword(
        email.toLowerCase(),
        otpCode,
        newPassword
      );

      setLoading(false);

      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          'Your password has been reset successfully. You can now login with your new password.',
          [
            { 
              text: 'Login Now', 
              onPress: () => navigation.navigate('Login') 
            }
          ]
        );
      } else {
        Alert.alert(
          'Reset Failed',
          result.message || 'Unable to reset password. Please check your code and try again.'
        );
      }
    } catch (error) {
      setLoading(false);
      console.error('Reset password error:', error);
      Alert.alert(
        'Error',
        'Unable to reset password. Please check your connection and try again.'
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
            style={{ opacity: fadeAnim }}
            className="px-6 pt-16 pb-8"
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
            <View className="items-center mb-10">
              <View
                className="w-20 h-20 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(212, 160, 23, 0.12)' }}
              >
                <Ionicons name="key-outline" size={40} color="#D4A017" />
              </View>

              <Text style={{ fontSize: 30, fontWeight: '900', color: '#0F172A', marginBottom: 8 }}>
                Reset <Text style={{ color: '#D4A017' }}>Password</Text>
              </Text>
              <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', paddingHorizontal: 32, fontWeight: '500' }}>
                Enter the code sent to {email}
              </Text>
            </View>

            {/* OTP Input */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 12, marginLeft: 4 }}>
                Verification Code
              </Text>

              <View className="flex-row justify-center mb-2" style={{ gap: 8 }}>
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
                    }}
                  />
                ))}
              </View>
              {errors.otp && (
                <Text className="text-red-500 text-xs mt-1 ml-1">{errors.otp}</Text>
              )}
            </View>

            {/* New Password */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                New Password
              </Text>
              <View
                className="flex-row items-center px-4 py-1"
                style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#D4A017" />
                <TextInput
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#94A3B8"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setErrors({ ...errors, newPassword: '' });
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
              {errors.newPassword && (
                <Text className="text-red-500 text-xs mt-1 ml-1">{errors.newPassword}</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                Confirm Password
              </Text>
              <View
                className="flex-row items-center px-4 py-1"
                style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#D4A017" />
                <TextInput
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors({ ...errors, confirmPassword: '' });
                  }}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text className="text-red-500 text-xs mt-1 ml-1">{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Password Requirements */}
            <View
              className="rounded-2xl p-4 mb-6"
              style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}
            >
              <Text style={{ color: '#334155', fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                Password Requirements:
              </Text>
              <View className="space-y-1">
                <View className="flex-row items-center">
                  <Ionicons
                    name={newPassword.length >= 8 ? "checkmark-circle" : "ellipse-outline"}
                    size={14}
                    color={newPassword.length >= 8 ? "#10b981" : "#94A3B8"}
                  />
                  <Text style={{ color: '#64748B', fontSize: 12, marginLeft: 8 }}>At least 8 characters</Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons
                    name={newPassword === confirmPassword && newPassword ? "checkmark-circle" : "ellipse-outline"}
                    size={14}
                    color={newPassword === confirmPassword && newPassword ? "#10b981" : "#94A3B8"}
                  />
                  <Text style={{ color: '#64748B', fontSize: 12, marginLeft: 8 }}>Passwords match</Text>
                </View>
              </View>
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
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
                      Resetting Password...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', marginRight: 8 }}>
                      Reset Password
                    </Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#111111" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              className="mt-6 items-center"
              disabled={loading}
            >
              <Text style={{ color: '#64748B', fontSize: 14 }}>
                Back to{' '}
                <Text style={{ color: '#D4A017', fontWeight: '700' }}>Login</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}