import React from 'react';
import { I18nManager } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider }          from './context/ThemeContext';
import { LanguageProvider }       from './context/LanguageContext';
import { CallProvider }           from './context/CallProvider';
import { ConfirmProvider }        from './components/common/ConfirmProvider';

// Initialise i18next before any screen mounts (English is bundled; other
// languages lazy-load). Also allow RTL so LanguageProvider can flip direction.
import './i18n';
I18nManager.allowRTL(true);

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
import EditReelScreen           from './screens/EditReelScreen';
import ArchivedReelsScreen      from './screens/ArchivedReelsScreen';
import ChatConversationScreen   from './screens/ChatConversationScreen';
import ForwardMessageScreen     from './screens/ForwardMessageScreen';
import ShareVideoScreen         from './screens/ShareVideoScreen';
import SettingsScreen           from './screens/SettingsScreen';
import HelpSupportScreen        from './screens/HelpSupportScreen';
import ActivityScreen           from './screens/ActivityScreen';
import ViewedProfilesScreen     from './screens/activity/ViewedProfilesScreen';
import LikedVideosScreen        from './screens/activity/LikedVideosScreen';
import SharedVideosScreen       from './screens/activity/SharedVideosScreen';
import SearchHistoryScreen      from './screens/activity/SearchHistoryScreen';
import CommentsHistoryScreen    from './screens/CommentsHistoryScreen';
import UserProfileScreen        from './screens/UserProfileScreen';
import FollowListScreen         from './screens/FollowListScreen';
import FollowRequestsScreen     from './screens/FollowRequestsScreen';
import BlockedUsersScreen       from './screens/BlockedUsersScreen';
import AudienceSettingScreen    from './screens/AudienceSettingScreen';
import PrivacyScreen            from './screens/PrivacyScreen';
import SecurityScreen           from './screens/SecurityScreen';
import ChangePasswordScreen     from './screens/ChangePasswordScreen';
import LoginActivityScreen      from './screens/LoginActivityScreen';
import PhoneVerificationScreen  from './screens/PhoneVerificationScreen';
import TwoFactorLoginScreen     from './screens/TwoFactorLoginScreen';
import SavedVideosScreen        from './screens/SavedVideosScreen';
import DownloadHistoryScreen    from './screens/DownloadHistoryScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
// AI Moderation — creator screens
import MyReviewsScreen from './screens/moderation/MyReviewsScreen';
import UploadReviewScreen from './screens/moderation/UploadReviewScreen';
import RequestReviewScreen from './screens/moderation/RequestReviewScreen';
// Hidden admin moderation panel
import AdminLoginScreen from './screens/admin/AdminLoginScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminReviewDetailScreen from './screens/admin/AdminReviewDetailScreen';
import LanguageScreen           from './screens/LanguageScreen';
import ContentPreferencesScreen from './screens/ContentPreferencesScreen';
import InterestedTopicsScreen   from './screens/InterestedTopicsScreen';
import AboutScreen              from './screens/AboutScreen';
import TermsScreen              from './screens/legal/TermsScreen';
import PrivacyPolicyScreen      from './screens/legal/PrivacyPolicyScreen';
import CheckForUpdatesScreen    from './screens/CheckForUpdatesScreen';
import TeamCreditsScreen        from './screens/TeamCreditsScreen';
import LicensesScreen           from './screens/LicensesScreen';
import HelpCenterScreen         from './screens/support/HelpCenterScreen';
import ContactUsScreen          from './screens/support/ContactUsScreen';
import ReportProblemScreen      from './screens/support/ReportProblemScreen';
import MyTicketsScreen          from './screens/support/MyTicketsScreen';

// Start capturing console logs at boot so bug reports can attach them.
import './utils/logBuffer';

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
        animationDuration: 240,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      {/* 2FA code entry — after a correct password on a 2FA-enabled account */}
      <Stack.Screen name="TwoFactorLogin" component={TwoFactorLoginScreen} />
    </Stack.Navigator>
  );
}

// App Stack (Main app with bottom tabs + modal screens)
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Consistent, quick default transition for every pushed screen.
        // Per-screen options below still override where a screen wants a
        // different presentation (e.g. slide_from_bottom modals).
        animation: 'slide_from_right',
        animationDuration: 240,
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

      {/* Edit Reel — metadata-only editor reached from the "Manage your reel" sheet */}
      <Stack.Screen
        name="EditReel"
        component={EditReelScreen}
        options={{ animation: 'slide_from_right' }}
      />

      {/* Archived Reels — owner-only list of archived videos */}
      <Stack.Screen
        name="ArchivedReels"
        component={ArchivedReelsScreen}
        options={{ animation: 'slide_from_right' }}
      />

      {/* Chat Conversation */}
      <Stack.Screen
        name="ChatConversation"
        component={ChatConversationScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Forward messages — modal-style presentation, matches WhatsApp/Telegram flow */}
      <Stack.Screen
        name="ForwardMessage"
        component={ForwardMessageScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'modal',
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

      {/* Social graph screens */}
      <Stack.Screen name="UserProfile"          component={UserProfileScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FollowList"           component={FollowListScreen}           options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FollowRequests"       component={FollowRequestsScreen}       options={{ animation: 'slide_from_right' }} />
      {/* Settings sub-screens */}
      <Stack.Screen name="Activity"             component={ActivityScreen}             options={{ animation: 'slide_from_right' }} />
      {/* Activity sub-screens */}
      <Stack.Screen name="ViewedProfiles"       component={ViewedProfilesScreen}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="LikedVideos"          component={LikedVideosScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SharedVideos"         component={SharedVideosScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SearchHistory"        component={SearchHistoryScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CommentsHistory"      component={CommentsHistoryScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Privacy"              component={PrivacyScreen}              options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="BlockedUsers"         component={BlockedUsersScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AudienceSetting"      component={AudienceSettingScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Security"             component={SecurityScreen}             options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ChangePassword"       component={ChangePasswordScreen}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="LoginActivity"        component={LoginActivityScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PhoneVerification"    component={PhoneVerificationScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SavedVideos"          component={SavedVideosScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="DownloadHistory"      component={DownloadHistoryScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Language"             component={LanguageScreen}             options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ContentPreferences"   component={ContentPreferencesScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="InterestedTopics"      component={InterestedTopicsScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="About"                component={AboutScreen}                options={{ animation: 'slide_from_right' }} />
      {/* About TrueVision module — legal, updates, credits, licenses */}
      <Stack.Screen name="Terms"                component={TermsScreen}                options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PrivacyPolicy"        component={PrivacyPolicyScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CheckForUpdates"      component={CheckForUpdatesScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="TeamCredits"          component={TeamCreditsScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Licenses"             component={LicensesScreen}             options={{ animation: 'slide_from_right' }} />
      {/* Help & Support module */}
      <Stack.Screen name="HelpCenter"           component={HelpCenterScreen}           options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ContactUs"            component={ContactUsScreen}            options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ReportProblem"        component={ReportProblemScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="MyTickets"            component={MyTicketsScreen}            options={{ animation: 'slide_from_right' }} />
      {/* AI Moderation — creator-facing */}
      <Stack.Screen name="MyReviews"            component={MyReviewsScreen}            options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="UploadReview"         component={UploadReviewScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="RequestReview"        component={RequestReviewScreen}        options={{ animation: 'slide_from_right' }} />
      {/* Hidden admin moderation panel (admin-only; not linked in normal UI) */}
      <Stack.Screen name="AdminLogin"           component={AdminLoginScreen}           options={{ animation: 'fade' }} />
      <Stack.Screen name="AdminDashboard"       component={AdminDashboardScreen}       options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="AdminReviewDetail"    component={AdminReviewDetailScreen}    options={{ animation: 'slide_from_right' }} />
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
          {/* LanguageProvider sits inside AuthProvider so it can restore the
              account's language on login, and outside the navigator so a
              language change re-renders every screen. */}
          <LanguageProvider>
            {/* CallProvider renders the full-screen call overlay above the
                navigator and binds the WebRTC signalling listeners. */}
            <CallProvider>
              {/* App-wide themed confirmation dialogs (replaces Alert.alert
                  for user-facing confirmations). Inside the navigator tree so
                  useConfirm() is reachable from every screen. */}
              <ConfirmProvider>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </ConfirmProvider>
            </CallProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}