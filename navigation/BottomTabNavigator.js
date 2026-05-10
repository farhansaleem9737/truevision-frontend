// truevision/navigation/BottomTabNavigator.js
//
// Why nested stacks for some tabs:
//   When a user taps a video tile in Profile or Discover, we want the bottom
//   tab bar to remain visible (just like the Home tab's reels feed). React
//   Navigation hides the tab bar whenever you push to a screen that lives in
//   the parent (root) stack, so the player must be registered INSIDE each
//   tab's own stack to keep the tab bar showing.
//
// Other tabs (Home, Upload, Chat) are still simple Tab.Screens — those tabs
// don't open the in-tab reel viewer.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../context/ThemeContext';

// Screens
import HomeScreen       from '../screens/HomeScreen';
import DiscoverScreen   from '../screens/DiscoverScreen';
import UploadScreen     from '../screens/UploadScreen';
import ChatScreen       from '../screens/ChatScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import ReelsFeedScreen  from '../screens/ReelsFeedScreen';

const Tab           = createBottomTabNavigator();
const ProfileStack  = createNativeStackNavigator();
const DiscoverStack = createNativeStackNavigator();

// ─── Per-tab stacks ──────────────────────────────────────────────────────────

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="ReelsFeed"
        component={ReelsFeedScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: true, gestureDirection: 'vertical' }}
      />
    </ProfileStack.Navigator>
  );
}

function DiscoverStackNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen name="DiscoverMain" component={DiscoverScreen} />
      <DiscoverStack.Screen
        name="ReelsFeed"
        component={ReelsFeedScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: true, gestureDirection: 'vertical' }}
      />
    </DiscoverStack.Navigator>
  );
}

// ─── Tab icons ───────────────────────────────────────────────────────────────

const TabIcon = ({ name, focused, isUpload, colors }) => {
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
        color={focused ? colors.tabIconActive : colors.tabIcon}
      />
    </View>
  );
};

// ─── Tab navigator ───────────────────────────────────────────────────────────

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          let iconName;
          let isUpload = false;
          if      (route.name === 'Home')     iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Discover') iconName = focused ? 'search' : 'search-outline';
          else if (route.name === 'Upload')   { iconName = 'add'; isUpload = true; }
          else if (route.name === 'Chat')     iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          else if (route.name === 'Profile')  iconName = focused ? 'person-circle' : 'person-circle-outline';
          return <TabIcon name={iconName} focused={focused} isUpload={isUpload} colors={colors} />;
        },
        tabBarShowLabel: false,
        tabBarStyle: {
          ...styles.tabBar,
          backgroundColor: colors.tabBg,
          borderTopColor:  colors.tabBorder,
          height: 65 + (insets.bottom > 0 ? insets.bottom : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 25, android: 10 }),
        },
        tabBarItemStyle: styles.tabBarItem,
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverStackNavigator} />
      <Tab.Screen name="Upload"   component={UploadScreen} />
      <Tab.Screen name="Chat"     component={ChatScreen} />
      <Tab.Screen name="Profile"  component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // backgroundColor + borderTopColor injected from theme at runtime
    borderTopWidth: 0.5,
    paddingTop: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  tabBarItem: { justifyContent: 'center', alignItems: 'center' },
  regularIconContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  uploadIconContainer:  { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  uploadIconGradient: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 6,
  },
});
