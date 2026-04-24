// truevision/screens/ShareVideoScreen.js
//
// Grid of user's videos + trending videos. Tapping one sends it as a
// video message in the current chat and navigates back.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth }   from '../context/AuthContext';
import videoService  from '../services/VideoService';
import socketService from '../services/SocketService';
import chatService   from '../services/ChatService';

// ─────────────────────────────────────────────────────────────────────────────

const VideoTile = ({ video, onPress }) => (
  <TouchableOpacity style={S.tile} activeOpacity={0.85} onPress={onPress}>
    <Image
      source={{ uri: video.thumbnailUrl || 'https://via.placeholder.com/180x240/1e293b/94a3b8?text=Video' }}
      style={S.thumb}
    />
    <View style={S.tileOverlay}>
      <Ionicons name="play" size={18} color="#fff" />
      {video.duration > 0 && (
        <Text style={S.tileDuration}>{Math.round(video.duration)}s</Text>
      )}
    </View>
    <Text style={S.tileTitle} numberOfLines={1}>{video.title}</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function ShareVideoScreen({ route, navigation }) {
  const { chatId }  = route.params;
  const { user }    = useAuth();
  const insets       = useSafeAreaInsets();

  const [tab, setTab]         = useState('mine');     // 'mine' | 'trending'
  const [videos, setVideos]   = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Load videos ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    let res;
    if (tab === 'mine') {
      res = await videoService.getUserVideos(user?._id, 1, 30);
    } else {
      res = await videoService.getFeed(1, 30, 'trending');
    }
    setVideos(res.videos || []);
    setLoading(false);
  }, [tab, user?._id]);

  useEffect(() => { load(); }, [load]);

  // ── Send the selected video as a chat message ─────────────────────────
  const selectVideo = (video) => {
    const videoId = video._id || video.id;
    const socket = socketService.getSocket();

    if (socket?.connected) {
      socketService.emit('sendMessage', {
        chatId,
        type: 'video',
        videoId,
        text: '',
      });
    } else {
      chatService.sendMessage(chatId, { type: 'video', videoId });
    }

    navigation.goBack();
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Share Video</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        <TouchableOpacity
          style={[S.tab, tab === 'mine' && S.tabActive]}
          onPress={() => setTab('mine')}
        >
          <Text style={[S.tabText, tab === 'mine' && S.tabTextActive]}>My Videos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.tab, tab === 'trending' && S.tabActive]}
          onPress={() => setTab('trending')}
        >
          <Text style={[S.tabText, tab === 'trending' && S.tabTextActive]}>Trending</Text>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item._id || item.id}
          numColumns={3}
          renderItem={({ item }) => <VideoTile video={item} onPress={() => selectVideo(item)} />}
          contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="videocam-off-outline" size={56} color="#cbd5e1" />
              <Text style={S.emptyText}>
                {tab === 'mine' ? 'You haven\'t uploaded any videos yet' : 'No trending videos'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  tabs:        { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  tab:         { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, marginHorizontal: 4, backgroundColor: '#f1f5f9' },
  tabActive:   { backgroundColor: '#3b82f6' },
  tabText:     { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },

  tile:        { flex: 1 / 3, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  thumb:       { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#1e293b' },
  tileOverlay: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tileDuration:{ color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 3 },
  tileTitle:   { padding: 6, fontSize: 12, fontWeight: '600', color: '#374151' },

  empty:       { alignItems: 'center', paddingTop: 80 },
  emptyText:   { color: '#94a3b8', fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 },
});
