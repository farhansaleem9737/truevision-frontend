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
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';

const countries = [
  'Pakistan', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'India', 'China', 'Germany', 'France', 'Japan', 'Brazil', 'Mexico',
  'Italy', 'Spain', 'South Korea', 'Saudi Arabia', 'UAE', 'Turkey',
  'Netherlands', 'Switzerland', 'Other'
];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    country: 'Pakistan',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain lowercase letters, numbers, and underscores';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await register({
        fullName: formData.fullName.trim(),
        username: formData.username.toLowerCase().trim(),
        email: formData.email.toLowerCase().trim(),
        country: formData.country,
        password: formData.password,
      });

      setLoading(false);

      if (result.success) {
        Alert.alert(
          'Success!',
          result.data?.emailSent 
            ? 'Registration successful! Please check your email for the verification code.'
            : 'Registration successful! However, there was an issue sending the verification email. You can resend it from the verification screen.',
          [
            {
              text: 'Verify Now',
              onPress: () => navigation.navigate('VerifyEmail', { 
                email: formData.email.toLowerCase().trim()
              })
            }
          ]
        );
      } else {
        Alert.alert('Registration Failed', result.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setLoading(false);
      console.error('Registration error:', error);
      Alert.alert(
        'Error',
        'Unable to complete registration. Please check your connection and try again.'
      );
    }
  };

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: '' });
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
            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-blue-500 rounded-full items-center justify-center mb-3">
                <Text style={{ fontSize: 32 }}>🎬</Text>
              </View>
              <Text className="text-3xl font-black text-white mb-1">Create Account</Text>
              <Text className="text-slate-400 text-sm">Join TrueVision today</Text>
            </View>

            {/* Form */}
            <View>
              {/* Full Name */}
              <View style={{ marginBottom: 16 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Full Name
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="person-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="John Doe"
                    placeholderTextColor="#64748b"
                    value={formData.fullName}
                    onChangeText={(text) => updateField('fullName', text)}
                    editable={!loading}
                    className="flex-1 text-white text-base px-3 py-3"
                  />
                </View>
                {errors.fullName && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.fullName}</Text>
                )}
              </View>

              {/* Username */}
              <View style={{ marginBottom: 16 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Username
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="at-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="johndoe"
                    placeholderTextColor="#64748b"
                    value={formData.username}
                    onChangeText={(text) => updateField('username', text.toLowerCase())}
                    autoCapitalize="none"
                    editable={!loading}
                    className="flex-1 text-white text-base px-3 py-3"
                  />
                </View>
                {errors.username && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.username}</Text>
                )}
              </View>

              {/* Email */}
              <View style={{ marginBottom: 16 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Email Address
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="mail-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="john@example.com"
                    placeholderTextColor="#64748b"
                    value={formData.email}
                    onChangeText={(text) => updateField('email', text)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                    className="flex-1 text-white text-base px-3 py-3"
                  />
                </View>
                {errors.email && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.email}</Text>
                )}
              </View>

              {/* Country */}
              <View style={{ marginBottom: 16 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Country
                </Text>
                <View className="bg-slate-800/50 rounded-2xl px-2 border border-slate-700">
                  <Picker
                    selectedValue={formData.country}
                    onValueChange={(value) => updateField('country', value)}
                    enabled={!loading}
                    style={{ color: '#fff', height: 50 }}
                    dropdownIconColor="#94a3b8"
                  >
                    {countries.map((country) => (
                      <Picker.Item key={country} label={country} value={country} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Password */}
              <View style={{ marginBottom: 16 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Password
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#64748b"
                    value={formData.password}
                    onChangeText={(text) => updateField('password', text)}
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
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.password}</Text>
                )}
              </View>

              {/* Confirm Password */}
              <View style={{ marginBottom: 16 }}>
                <Text className="text-slate-300 text-sm font-medium mb-2 ml-1">
                  Confirm Password
                </Text>
                <View className="flex-row items-center bg-slate-800/50 rounded-2xl px-4 py-1 border border-slate-700">
                  <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                  <TextInput
                    placeholder="Re-enter password"
                    placeholderTextColor="#64748b"
                    value={formData.confirmPassword}
                    onChangeText={(text) => updateField('confirmPassword', text)}
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

              {/* Register Button */}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
                className="mt-4"
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
                        Creating Account...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white text-base font-bold">Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text className="text-slate-400 text-base">
                  Already have an account?{' '}
                </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Login')}
                  disabled={loading}
                >
                  <Text className="text-blue-400 text-base font-semibold">
                    Sign In
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