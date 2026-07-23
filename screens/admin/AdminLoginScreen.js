// truevision/screens/admin/AdminLoginScreen.js
//
// Hidden admin login. Reached via a concealed entry point (not linked in normal
// UI). Authenticates against /api/admin/login and, on success, replaces into
// the AdminDashboard. Uses its own token (AdminService), never the user session.

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import adminService from '../../services/AdminService';
import { A } from './adminTheme';

export default function AdminLoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');

  // If an admin session already exists, skip straight to the dashboard.
  useEffect(() => {
    (async () => {
      const token = await adminService.getToken();
      if (!token) return;
      try {
        const me = await adminService.me();
        if (me?.success) navigation.replace('AdminDashboard');
      } catch (_) { /* token invalid — stay on login */ }
    })();
  }, [navigation]);

  const submit = async () => {
    setError('');
    if (!username.trim() || !password) { setError('Enter username and password.'); return; }
    setBusy(true);
    try {
      const res = await adminService.login(username.trim(), password, remember);
      if (res?.success) navigation.replace('AdminDashboard');
      else setError(res?.message || 'Invalid credentials');
    } catch (e) {
      setError(e?.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={S.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={S.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={S.badge}>
          <Ionicons name="shield-checkmark" size={30} color={A.accent} />
        </View>
        <Text style={S.title}>Moderation Panel</Text>
        <Text style={S.subtitle}>Administrator access only</Text>

        <View style={S.field}>
          <Ionicons name="person-outline" size={18} color={A.dim} />
          <TextInput
            style={S.input}
            placeholder="Username"
            placeholderTextColor={A.dim}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View style={S.field}>
          <Ionicons name="lock-closed-outline" size={18} color={A.dim} />
          <TextInput
            style={S.input}
            placeholder="Password"
            placeholderTextColor={A.dim}
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          <TouchableOpacity onPress={() => setShowPw((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={A.dim} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={S.remember} onPress={() => setRemember((r) => !r)} activeOpacity={0.7}>
          <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={19} color={remember ? A.accent : A.dim} />
          <Text style={S.rememberText}>Remember session</Text>
        </TouchableOpacity>

        {error ? <Text style={S.error}>{error}</Text> : null}

        <TouchableOpacity style={[S.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>Sign in</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 22 }}>
          <Text style={S.back}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:      { flex: 1, backgroundColor: A.bg },
  center:    { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  badge:     { width: 64, height: 64, borderRadius: 20, backgroundColor: A.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  title:     { color: A.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle:  { color: A.dim, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 30 },
  field:     { flexDirection: 'row', alignItems: 'center', backgroundColor: A.card, borderWidth: 1, borderColor: A.border, borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 14 },
  input:     { flex: 1, color: A.text, fontSize: 15, marginLeft: 10 },
  remember:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rememberText: { color: A.sub, fontSize: 14, marginLeft: 8 },
  error:     { color: A.red, fontSize: 13.5, marginVertical: 8 },
  btn:       { backgroundColor: A.accent, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  back:      { color: A.dim, fontSize: 14, textAlign: 'center' },
});
