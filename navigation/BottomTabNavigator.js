import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Screens
import HomeScreen    from '../screens/HomeScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import UploadScreen  from '../screens/UploadScreen';
import ChatScreen    from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused, isUpload }) => {
  if (isUpload) {
    return (
      <View style={styles.uploadIconContainer}>
        <LinearGradient
          colors={focused ? ['#3b82f6', '#2563eb'] : ['#4b5563', '#374151']}
          style={styles.uploadIconGradient}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.regularIconContainer}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? '#ffffff' : '#64748b'}
      />
    </View>
  );
};

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          let iconName;
          let isUpload = false;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Discover') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Upload') {
            iconName = 'add';
            isUpload = true;
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }

          return <TabIcon name={iconName} focused={focused} isUpload={isUpload} />;
        },
        tabBarShowLabel: false,
        tabBarStyle: {
          ...styles.tabBar,
          height: 65 + (insets.bottom > 0 ? insets.bottom : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.select({
            ios: 25,
            android: 10,
          }),
        },
        tabBarItemStyle: styles.tabBarItem,
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Upload"   component={UploadScreen} />
      <Tab.Screen name="Chat"     component={ChatScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f0f0f',
    borderTopWidth: 0.5,
    borderTopColor: '#1f2937',
    paddingTop: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  regularIconContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIconContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  uploadIconGradient: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
});
