// truevision/screens/moderation/MyReviewsScreen.js
//
// Lists the signed-in creator's uploads that are in the moderation queue
// (processing / blocked / pending / rejected / changes-requested). Tapping one
// opens the block/review screen. Route: 'MyReviews'.

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import videoService from '../../services/VideoService';

const BADGE = {
  processing:        { label: 'Processing',   color: '#F59E0B' },
  pending_review:    { label: 'Under review',  color: '#F59E0B' },
  blocked:           { label: 'Blocked',       color: '#EF4444' },
  rejected:          { label: 'Rejected',      color: '#EF4444' },
  changes_requested: { label: 'Changes asked', color: '#F59E0B' },
};

export default function MyReviewsScreen({ navigation }) {
  const { colors } = useTheme();
  const [videos, setVideos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await videoService.getMyModeration();
    if (res?.success) setVideos(res.videos || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }) => {
    const b = BADGE[item.reviewStatus] || BADGE.blocked;
    return (
      <TouchableOpacity
        style={[S.row, { backgroundColor: colors.card, borderColor: colors.divider }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('UploadReview', { video: item })}
      >
        <ExpoImage source={{ uri: item.thumbnailUrl }} style={S.thumb} contentFit="cover" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[S.title, { color: colors.text }]} numberOfLines={2}>{item.title || 'Untitled'}</Text>
          <View style={[S.badge, { backgroundColor: b.color + '22' }]}>
            <Text style={[S.badgeText, { color: b.color }]}>{b.label}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[S.root, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Uploads under review</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={54} color={colors.textDim} />
              <Text style={[S.emptyText, { color: colors.textMuted }]}>No uploads under review.</Text>
              <Text style={[S.emptySub, { color: colors.textDim }]}>Published videos don’t appear here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  row:         { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 12 },
  thumb:       { width: 64, height: 64, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.15)' },
  title:       { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  badge:       { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText:   { fontSize: 12, fontWeight: '800' },
  empty:       { alignItems: 'center', paddingTop: 80 },
  emptyText:   { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub:    { fontSize: 13, marginTop: 6 },
});
