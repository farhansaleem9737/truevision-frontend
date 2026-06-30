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
            {/* Header */}
            <View className="items-center mb-8">
              {/* Logo — transparent PNG, no glow, sits directly on the background. */}
              <Image
                source={require('../assets/images/tv-icon.png')}
                style={{
                  width: 82,
                  height: 82,
                  marginBottom: 14,
                }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 30, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                Create <Text style={{ color: '#D4A017' }}>Account</Text>
              </Text>
              <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '500' }}>
                Join <Text style={{ color: '#D4A017', fontWeight: '700' }}>TrueVision</Text> today
              </Text>
            </View>

            {/* Form */}
            <View>
              {/* Full Name */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Full Name
                </Text>
                <View className="flex-row items-center px-4 py-1" style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}>
                  <Ionicons name="person-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="John Doe"
                    placeholderTextColor="#94A3B8"
                    value={formData.fullName}
                    onChangeText={(text) => updateField('fullName', text)}
                    editable={!loading}
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
                  />
                </View>
                {errors.fullName && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.fullName}</Text>
                )}
              </View>

              {/* Username */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Username
                </Text>
                <View className="flex-row items-center px-4 py-1" style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}>
                  <Ionicons name="at-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="johndoe"
                    placeholderTextColor="#94A3B8"
                    value={formData.username}
                    onChangeText={(text) => updateField('username', text.toLowerCase())}
                    autoCapitalize="none"
                    editable={!loading}
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
                  />
                </View>
                {errors.username && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.username}</Text>
                )}
              </View>

              {/* Email */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Email Address
                </Text>
                <View className="flex-row items-center px-4 py-1" style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}>
                  <Ionicons name="mail-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="john@example.com"
                    placeholderTextColor="#94A3B8"
                    value={formData.email}
                    onChangeText={(text) => updateField('email', text)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }}
                  />
                </View>
                {errors.email && (
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.email}</Text>
                )}
              </View>

              {/* Country */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Country
                </Text>
                <View className="px-2" style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}>
                  <Picker
                    selectedValue={formData.country}
                    onValueChange={(value) => updateField('country', value)}
                    enabled={!loading}
                    style={{ color: '#0F172A', height: 50 }}
                    dropdownIconColor="#64748B"
                  >
                    {countries.map((country) => (
                      <Picker.Item key={country} label={country} value={country} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Password */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Password
                </Text>
                <View className="flex-row items-center px-4 py-1" style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}>
                  <Ionicons name="lock-closed-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#94A3B8"
                    value={formData.password}
                    onChangeText={(text) => updateField('password', text)}
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
                  <Text className="text-red-400 text-xs mt-1 ml-1">{errors.password}</Text>
                )}
              </View>

              {/* Confirm Password */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Confirm Password
                </Text>
                <View className="flex-row items-center px-4 py-1" style={{ backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212, 160, 23, 0.45)' }}>
                  <Ionicons name="lock-closed-outline" size={20} color="#D4A017" />
                  <TextInput
                    placeholder="Re-enter password"
                    placeholderTextColor="#94A3B8"
                    value={formData.confirmPassword}
                    onChangeText={(text) => updateField('confirmPassword', text)}
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
                        Creating Account...
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#111111', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>
                      Create Account
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text style={{ color: '#64748B', fontSize: 15 }}>
                  Already have an account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  disabled={loading}
                >
                  <Text style={{ color: '#D4A017', fontSize: 15, fontWeight: '700' }}>
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