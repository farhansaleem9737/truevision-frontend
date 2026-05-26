import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider }          from './context/ThemeContext';

// Import Auth screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';

// Import Main App screens
import BottomTabNavigator       from './navigation/BottomTabNavigator';
import VideoPlayerScreen        from './screens/VideoPlayerScreen';
import EditProfileScreen        from './screens/EditProfileScreen';
import ChatConversationScreen   from './screens/ChatConversationScreen';
import ShareVideoScreen         from './screens/ShareVideoScreen';
import SettingsScreen           from './screens/SettingsScreen';
import HelpSupportScreen        from './screens/HelpSupportScreen';
import ActivityScreen           from './screens/ActivityScreen';
import WatchHistoryScreen       from './screens/activity/WatchHistoryScreen';
import ViewedProfilesScreen     from './screens/activity/ViewedProfilesScreen';
import LikedVideosScreen        from './screens/activity/LikedVideosScreen';
import SharedVideosScreen       from './screens/activity/SharedVideosScreen';
import SearchHistoryScreen      from './screens/activity/SearchHistoryScreen';
import PrivacyScreen            from './screens/PrivacyScreen';
import SecurityScreen           from './screens/SecurityScreen';
import SavedVideosScreen        from './screens/SavedVideosScreen';
import DownloadHistoryScreen    from './screens/DownloadHistoryScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import LanguageScreen           from './screens/LanguageScreen';
import ContentPreferencesScreen from './screens/ContentPreferencesScreen';
import AboutScreen              from './screens/AboutScreen';

import './global.css';

const Stack = createNativeStackNavigator();

// Auth Stack (Login, Register, etc.)
function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

// App Stack (Main app with bottom tabs + modal screens)
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Main Bottom Tab Navigator */}
      <Stack.Screen 
        name="MainApp" 
        component={BottomTabNavigator} 
      />
      
      {/* Video Player — full-screen reel takeover. Not a modal; matches the
          Home tab's reel feed visually so action buttons don't float above
          empty space and there's no iOS rounded-modal styling. */}
      <Stack.Screen
        name="VideoPlayer"
        component={VideoPlayerScreen}
        options={{
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />

      {/* Edit Profile */}
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Chat Conversation */}
      <Stack.Screen
        name="ChatConversation"
        component={ChatConversationScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Share Video in Chat */}
      <Stack.Screen
        name="ShareVideo"
        component={ShareVideoScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />

      {/* Settings */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Help & Support */}
      <Stack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ animation: 'slide_from_right' }}
      />

      {/* Settings sub-screens */}
      <Stack.Screen name="Activity"             component={ActivityScreen}             options={{ animation: 'slide_from_right' }} />
      {/* Activity sub-screens */}
      <Stack.Screen name="WatchHistory"         component={WatchHistoryScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ViewedProfiles"       component={ViewedProfilesScreen}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="LikedVideos"          component={LikedVideosScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SharedVideos"         component={SharedVideosScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SearchHistory"        component={SearchHistoryScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Privacy"              component={PrivacyScreen}              options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Security"             component={SecurityScreen}             options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SavedVideos"          component={SavedVideosScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="DownloadHistory"      component={DownloadHistoryScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Language"             component={LanguageScreen}             options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ContentPreferences"   component={ContentPreferencesScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="About"                component={AboutScreen}                options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

// Root Navigator (decides between Auth and App stacks)
function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return isAuthenticated ? <AppStack /> : <AuthStack />;
}

// Main App Component
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}