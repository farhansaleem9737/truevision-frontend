// components/Header.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ 
  title, 
  showBack = false, 
  onBackPress,
  rightIcon,
  onRightPress 
}) {
  const insets = useSafeAreaInsets();
  
  return (
    <View 
      style={{ 
        paddingTop: insets.top,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center">
          {showBack && (
            <TouchableOpacity onPress={onBackPress} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
          )}
          <Text className="text-xl font-semibold text-gray-900">{title}</Text>
        </View>
        
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress}>
            <Ionicons name={rightIcon} size={24} color="#1e293b" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}