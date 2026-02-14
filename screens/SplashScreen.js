import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StatusBar,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const { isAuthenticated, loading } = useAuth();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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

    // Rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();

    // Navigate after animations and auth check
    if (!loading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          navigation.replace('Home');
        } else {
          navigation.replace('Login');
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#1e3a8a', '#2563eb', '#3b82f6']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />

      {/* Animated Background Circles */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          transform: [{ rotate: spin }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: -150,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: 200,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          transform: [{ rotate: spin }],
        }}
      />

      {/* Main Content */}
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
          }}
          className="items-center"
        >
          {/* Logo Container with Glow Effect */}
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
            className="mb-8"
          >
            <View className="w-32 h-32 items-center justify-center">
              {/* Outer Glow */}
              <View className="absolute w-40 h-40 bg-white/20 rounded-full" 
                style={{
                  shadowColor: '#fff',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 30,
                  elevation: 15,
                }}
              />
              {/* Inner Circle */}
              <View className="w-32 h-32 bg-white rounded-full items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
                <Text style={{ fontSize: 56 }}>🎬</Text>
              </View>
            </View>
          </Animated.View>

          {/* Brand Name */}
          <Text className="text-6xl font-black text-white tracking-wider mb-3"
            style={{
              textShadowColor: 'rgba(0, 0, 0, 0.3)',
              textShadowOffset: { width: 0, height: 4 },
              textShadowRadius: 10,
            }}
          >
            TrueVision
          </Text>

          {/* Tagline */}
          <View className="flex-row items-center space-x-2 mb-6">
            <View className="w-12 h-0.5 bg-blue-200/60" />
            <Text className="text-blue-50 text-base font-medium tracking-widest">
              AUTHENTIC
            </Text>
            <View className="w-1.5 h-1.5 bg-blue-200 rounded-full" />
            <Text className="text-blue-50 text-base font-medium tracking-widest">
              VERIFIED
            </Text>
            <View className="w-1.5 h-1.5 bg-blue-200 rounded-full" />
            <Text className="text-blue-50 text-base font-medium tracking-widest">
              INTELLIGENT
            </Text>
            <View className="w-12 h-0.5 bg-blue-200/60" />
          </View>

          {/* Description */}
          <View className="bg-white/10 backdrop-blur-lg rounded-2xl px-6 py-4 mt-4"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Text className="text-blue-50 text-center text-base leading-6">
              AI-Powered Short Video{'\n'}Information Platform
            </Text>
          </View>
        </Animated.View>

        {/* Loading Indicator */}
        <View className="absolute bottom-32 flex-row space-x-3">
          <LoadingDot delay={0} />
          <LoadingDot delay={200} />
          <LoadingDot delay={400} />
        </View>

        {/* Footer */}
        <View className="absolute bottom-12 items-center">
          <Text className="text-blue-100 text-sm font-medium mb-1">
            BS-IT Final Year Project
          </Text>
          <Text className="text-blue-200 text-xs">
            Powered by Artificial Intelligence
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function LoadingDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{ opacity }}
      className="w-3 h-3 bg-white rounded-full"
    />
  );
}