// truevision/screens/EditReelScreen.js
//
// Metadata-only editor for a reel. Reached from the "Manage your reel"
// sheet's Edit action. Does NOT re-upload the video, regenerate thumbnails,
// or re-run compression — it PUTs a JSON body of the changed fields to
// PUT /api/videos/:id and refreshes the local video state.
//
// Fields
//   • Caption   (title, required, ≤150 chars)
//   • Description (≤2200)
//   • Hashtags  (comma-separated, stored as lowercase array)
//   • Category  (single-select from Video model enum)
//   • Location  (free text, ≤120)
//   • Visibility (public / followers / private)
//   • Allow comments / downloads / duet / remix (booleans)
//
// UX
//   • Dark-mode by default; theme-aware via useTheme.
//   • Sticky Save button — enabled only when a real diff exists.
//   • Errors surfaced inline; success returns to the previous screen with a
//     `videoUpdated` param the sender can consume.

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar,
  ScrollView, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import videoService from '../services/VideoService';
import { useTheme } from '../context/ThemeContext';
import { useConfirm } from '../components/common/ConfirmProvider';

const CATEGORIES = [
  'education', 'tech', 'programming', 'business', 'finance',
  'islamic', 'motivation', 'news', 'productivity',
  'entertainment', 'music', 'sports', 'gaming', 'food', 'travel', 'fashion',
  'other',
];

const VISIBILITY_OPTIONS = [
  { key: 'public',    label: 'Public',    icon: 'earth-outline',     hint: 'Anyone can find and watch this reel' },
  { key: 'followers', label: 'Followers', icon: 'people-outline',    hint: 'Only your followers see it in feed' },
  { key: 'private',   label: 'Private',   icon: 'lock-closed-outline', hint: 'Only you can watch it' },
];

const tagsToString = (arr) =>
  Array.isArray(arr) ? arr.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ') : '';

const stringToTags = (str) =>
  String(str || '')
    .split(/[,\s]+/)
    .map((t) => t.trim().replace(/^#+/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 30);

export default function EditReelScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const palette = isDark ? DARK : LIGHT;
  const confirm = useConfirm();

  // The caller MUST pass the current video document — we never fetch it
  // here to avoid a flash of empty fields. If for some reason it is
  // missing, back out immediately.
  const initial = route?.params?.video;

  useEffect(() => {
    if (!initial?._id && !initial?.id) {
      navigation.goBack();
    }
  }, [initial, navigation]);

  const [title,       setTitle]       = useState(initial?.title       || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [tagsInput,   setTagsInput]   = useState(tagsToString(initial?.tags));
  const [category,    setCategory]    = useState(initial?.category    || 'other');
  const [location,    setLocation]    = useState(initial?.location    || '');
  const [visibility,  setVisibility]  = useState(initial?.visibility  || 'public');
  const [allowComments, setAllowComments] = useState(!!initial?.allowComments);
  const [allowDownload, setAllowDownload] = useState(!!initial?.allowDownload);
  const [allowDuet,     setAllowDuet]     = useState(initial?.allowDuet  === undefined ? true : !!initial.allowDuet);
  const [allowRemix,    setAllowRemix]    = useState(initial?.allowRemix === undefined ? true : !!initial.allowRemix);
  const [saving, setSaving]             = useState(false);
  const [error,  setError]              = useState('');

  // ── Change detection ────────────────────────────────────────────────────
  // Only include fields the user actually touched so the PUT payload is
  // minimal and the backend doesn't re-run content moderation on unchanged
  // text (checkContent is expensive on long descriptions).
  const payload = useMemo(() => {
    const p = {};
    const initTags = tagsToString(initial?.tags);

    if (title.trim() !== (initial?.title || '').trim())                p.title       = title.trim();
    if (description !== (initial?.description || ''))                   p.description = description;
    if (tagsInput.trim() !== initTags.trim())                           p.tags        = stringToTags(tagsInput);
    if (category !== (initial?.category || 'other'))                    p.category    = category;
    if (location !== (initial?.location || ''))                         p.location    = location.trim();
    if (visibility !== (initial?.visibility || 'public'))               p.visibility  = visibility;
    if (allowComments !== !!initial?.allowComments)                     p.allowComments = allowComments;
    if (allowDownload !== !!initial?.allowDownload)                     p.allowDownload = allowDownload;
    if (allowDuet     !== (initial?.allowDuet  ?? true))                p.allowDuet     = allowDuet;
    if (allowRemix    !== (initial?.allowRemix ?? true))                p.allowRemix    = allowRemix;
    return p;
  }, [
    title, description, tagsInput, category, location, visibility,
    allowComments, allowDownload, allowDuet, allowRemix, initial,
  ]);

  const dirty      = Object.keys(payload).length > 0;
  const canSave    = dirty && title.trim().length > 0 && !saving;

  const onSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const id  = initial?._id || initial?.id;
      const res = await videoService.updateVideo(id, payload);
      if (!res?.success) {
        setError(res?.message || 'Could not save changes');
        setSaving(false);
        return;
      }
      // Tell the previous screen the video changed so it can refresh its
      // local copy without another network call.
      navigation.navigate({
        name: route?.params?.returnTo || 'ProfileTab',
        params: { updatedVideo: res.video || { ...initial, ...payload } },
        merge: true,
      });
    } catch (e) {
      setError(e?.message || 'Could not save changes');
      setSaving(false);
    }
  }, [canSave, initial, payload, navigation, route]);

  const confirmBack = useCallback(async () => {
    if (!dirty) return navigation.goBack();
    const ok = await confirm({
      title:       'Discard changes?',
      message:     'You have unsaved edits.',
      confirmText: 'Discard',
      cancelText:  'Keep editing',
      destructive: true,
      icon:        'create-outline',
    });
    if (ok) navigation.goBack();
  }, [dirty, navigation, confirm]);

  if (!initial) return null;

  return (
    <View style={[S.root, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={[
          S.header,
          { paddingTop: insets.top + 6, backgroundColor: palette.bg, borderBottomColor: palette.border },
        ]}
      >
        <TouchableOpacity onPress={confirmBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </TouchableOpacity>
        <Text style={[S.hTitle, { color: palette.text }]}>Edit reel</Text>
        <TouchableOpacity
          onPress={onSave}
          disabled={!canSave}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ opacity: canSave ? 1 : 0.45 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <Text style={[S.hSave, { color: palette.accent }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && (
            <View style={[S.errorRow, { backgroundColor: palette.dangerSoft }]}>
              <Ionicons name="alert-circle" size={16} color={palette.danger} />
              <Text style={[S.errorText, { color: palette.danger }]}>{error}</Text>
            </View>
          )}

          {/* ── Caption ────────────────────────────────────────────────── */}
          <Section title="Caption" palette={palette}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Write a caption…"
              placeholderTextColor={palette.textMuted}
              style={[S.input, { color: palette.text, backgroundColor: palette.card, borderColor: palette.border }]}
              maxLength={150}
              multiline
            />
            <Text style={[S.charCount, { color: palette.textMuted }]}>{title.length}/150</Text>
          </Section>

          {/* ── Description ───────────────────────────────────────────── */}
          <Section title="Description" palette={palette}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description"
              placeholderTextColor={palette.textMuted}
              style={[S.input, S.inputTall, { color: palette.text, backgroundColor: palette.card, borderColor: palette.border }]}
              multiline
              maxLength={2200}
            />
            <Text style={[S.charCount, { color: palette.textMuted }]}>{description.length}/2200</Text>
          </Section>

          {/* ── Hashtags ───────────────────────────────────────────────── */}
          <Section title="Hashtags" palette={palette} hint="Space or comma separated. Up to 30.">
            <TextInput
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="#tech #startup"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[S.input, { color: palette.text, backgroundColor: palette.card, borderColor: palette.border }]}
            />
          </Section>

          {/* ── Category ───────────────────────────────────────────────── */}
          <Section title="Category" palette={palette}>
            <View style={S.chipsRow}>
              {CATEGORIES.map((c) => {
                const active = c === category;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    activeOpacity={0.75}
                    style={[
                      S.chip,
                      {
                        backgroundColor: active ? palette.accent : palette.card,
                        borderColor: active ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.chipText,
                        { color: active ? '#fff' : palette.text },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* ── Location ───────────────────────────────────────────────── */}
          <Section title="Location" palette={palette}>
            <View style={[S.rowInput, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Ionicons name="location-outline" size={18} color={palette.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Add location"
                placeholderTextColor={palette.textMuted}
                style={{ flex: 1, color: palette.text, fontSize: 15 }}
                maxLength={120}
              />
            </View>
          </Section>

          {/* ── Visibility ─────────────────────────────────────────────── */}
          <Section title="Who can see this reel" palette={palette}>
            {VISIBILITY_OPTIONS.map((v) => {
              const active = v.key === visibility;
              return (
                <TouchableOpacity
                  key={v.key}
                  onPress={() => setVisibility(v.key)}
                  activeOpacity={0.75}
                  style={[
                    S.visRow,
                    { backgroundColor: palette.card, borderColor: active ? palette.accent : palette.border },
                  ]}
                >
                  <Ionicons name={v.icon} size={18} color={active ? palette.accent : palette.textMuted} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[S.visLabel, { color: palette.text }]}>{v.label}</Text>
                    <Text style={[S.visHint,  { color: palette.textMuted }]}>{v.hint}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? palette.accent : palette.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </Section>

          {/* ── Permissions ────────────────────────────────────────────── */}
          <Section title="Permissions" palette={palette}>
            <ToggleRow
              label="Allow comments"
              hint="Viewers can leave comments on this reel"
              value={allowComments}
              onValueChange={setAllowComments}
              palette={palette}
            />
            <ToggleRow
              label="Allow downloads"
              hint="Viewers can download the video file"
              value={allowDownload}
              onValueChange={setAllowDownload}
              palette={palette}
            />
            <ToggleRow
              label="Allow Duet"
              hint="Others can film side-by-side with your reel"
              value={allowDuet}
              onValueChange={setAllowDuet}
              palette={palette}
            />
            <ToggleRow
              label="Allow Remix"
              hint="Others can use your reel as a template"
              value={allowRemix}
              onValueChange={setAllowRemix}
              palette={palette}
            />
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const Section = ({ title, hint, children, palette }) => (
  <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
    <Text style={[S.secTitle, { color: palette.textMuted }]}>{title.toUpperCase()}</Text>
    {hint ? <Text style={[S.secHint, { color: palette.textMuted }]}>{hint}</Text> : null}
    <View style={{ marginTop: 8 }}>{children}</View>
  </View>
);

const ToggleRow = ({ label, hint, value, onValueChange, palette }) => (
  <View style={[S.toggleRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
    <View style={{ flex: 1 }}>
      <Text style={[S.toggleLabel, { color: palette.text }]}>{label}</Text>
      {hint ? <Text style={[S.toggleHint, { color: palette.textMuted }]}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: palette.switchTrackOff, true: palette.accent }}
      thumbColor={value ? '#fff' : '#f4f3f4'}
    />
  </View>
);

// ── Palettes ─────────────────────────────────────────────────────────────────
const DARK = {
  bg:              '#0b0b0f',
  card:            'rgba(255,255,255,0.05)',
  border:          'rgba(255,255,255,0.08)',
  text:            '#f5f5f7',
  textMuted:       '#a1a1aa',
  accent:          '#22C55E',
  danger:          '#ff5a5f',
  dangerSoft:      'rgba(255,90,95,0.15)',
  switchTrackOff:  'rgba(255,255,255,0.15)',
};

const LIGHT = {
  bg:              '#f8fafc',
  card:            '#ffffff',
  border:          '#e2e8f0',
  text:            '#0f172a',
  textMuted:       '#64748b',
  accent:          '#16a34a',
  danger:          '#ef4444',
  dangerSoft:      '#fef2f2',
  switchTrackOff:  '#e2e8f0',
};

const S = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hTitle: { fontSize: 17, fontWeight: '700', letterSpacing: 0.15 },
  hSave:  { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  errorRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, gap: 8,
  },
  errorText: { fontSize: 13, fontWeight: '600' },

  secTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  secHint:  { fontSize: 12, marginTop: 2 },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  inputTall: { minHeight: 100, textAlignVertical: 'top', paddingVertical: 12 },
  charCount: { fontSize: 11, marginTop: 4, textAlign: 'right' },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

  rowInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 44,
  },

  visRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8,
    minHeight: 56,
  },
  visLabel: { fontSize: 15, fontWeight: '700' },
  visHint:  { fontSize: 12, marginTop: 2 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8,
    minHeight: 56,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700' },
  toggleHint:  { fontSize: 12, marginTop: 2 },
});
