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
            style={{ opacity: fadeAnim }}
            className="px-6 pt-16 pb-8"
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
            <View className="items-center mb-10">
              <View className="w-20 h-20 bg-red-500 rounded-full items-center justify-center mb-4">
                <Ionicons name="key-outline" size={40} color="#fff" />
              </View>
              
              <Text className="text-3xl font-black text-white mb-2">
                Reset Password
              </Text>
              <Text className="text-slate-400 text-center text-sm px-8">
                Enter the code sent to {email}
              </Text>
            </View>

            {/* OTP Input */}
            <View style={{ marginBottom: 24 }}>
              <Text className="text-slate-300 text-sm font-medium mb-3 ml-1">
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
                    className={`w-12 h-14 bg-slate-800/50 rounded-xl text-white text-2xl font-bold text-center border-2 ${
                      digit ? 'border-red-500' : 'border-slate-700'
                    }`}
                  />
                ))}
              </View>
              {errors.otp && (
                <Text className="text-red-400 text-xs mt-1 ml-1">{errors.otp}</Text>
              )}
            </View>

            {/* New Password */}
            <View style={{ marginBottom: 16 }}>
              <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                New Password
              </Text>
              <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                <TextInput
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#64748b"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setErrors({ ...errors, newPassword: '' });
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
              {errors.newPassword && (
                <Text className="text-red-400 text-xs mt-1 ml-1">{errors.newPassword}</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={{ marginBottom: 24 }}>
              <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                Confirm Password
              </Text>
              <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                <TextInput
                  placeholder="Re-enter new password"
                  placeholderTextColor="#64748b"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors({ ...errors, confirmPassword: '' });
                  }}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  className="flex-1 text-white text-base px-3 py-3"
                />
                <TouchableOpacity 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Password Requirements */}
            <View className="bg-slate-800/30 rounded-2xl p-4 mb-6">
              <Text className="text-slate-300 text-xs font-semibold mb-2">
                Password Requirements:
              </Text>
              <View className="space-y-1">
                <View className="flex-row items-center">
                  <Ionicons 
                    name={newPassword.length >= 8 ? "checkmark-circle" : "ellipse-outline"} 
                    size={14} 
                    color={newPassword.length >= 8 ? "#10b981" : "#64748b"} 
                  />
                  <Text className="text-slate-400 text-xs ml-2">At least 8 characters</Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons 
                    name={newPassword === confirmPassword && newPassword ? "checkmark-circle" : "ellipse-outline"} 
                    size={14} 
                    color={newPassword === confirmPassword && newPassword ? "#10b981" : "#64748b"} 
                  />
                  <Text className="text-slate-400 text-xs ml-2">Passwords match</Text>
                </View>
              </View>
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
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
                      Resetting Password...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Text className="text-white text-base font-bold mr-2">
                      Reset Password
                    </Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
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
              <Text className="text-slate-400 text-sm">
                Back to{' '}
                <Text className="text-blue-400 font-semibold">Login</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}