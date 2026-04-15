import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const MOCK_DMS = [
  { id: '1', username: 'sahiladeem_',     avatar: 'https://i.pravatar.cc/150?img=1', lastMessage: 'Hey! Loved your latest video 🔥', time: '2m',  unread: 2 },
  { id: '2', username: 'dreamer_films',   avatar: 'https://i.pravatar.cc/150?img=2', lastMessage: 'Can we collab?',                              time: '15m', unread: 0 },
  { id: '3', username: 'blazevfx',        avatar: 'https://i.pravatar.cc/150?img=3', lastMessage: 'Sent you a video',                             time: '1h',  unread: 1 },
  { id: '4', username: 'adventureseeker', avatar: 'https://i.pravatar.cc/150?img=4', lastMessage: 'Thanks for the follow!',                       time: '3h',  unread: 0 },
  { id: '5', username: 'subarunation',    avatar: 'https://i.pravatar.cc/150?img=5', lastMessage: 'Nice content bro 🚗',                          time: '1d',  unread: 0 },
  { id: '6', username: 'nora.creates',    avatar: 'https://i.pravatar.cc/150?img=6', lastMessage: 'Your editing is insane 😭',                    time: '2d',  unread: 0 },
];

const DmRow = ({ item }) => (
  <TouchableOpacity style={S.dmRow} activeOpacity={0.7}>
    <View style={S.avatarWrap}>
      <Image source={{ uri: item.avatar }} style={S.avatar} />
      {item.unread > 0 && (
        <View style={S.badge}>
          <Text style={S.badgeText}>{item.unread}</Text>
        </View>
      )}
    </View>
    <View style={S.dmContent}>
      <View style={S.dmHeader}>
        <Text style={[S.username, item.unread > 0 && S.usernameUnread]}>
          {item.username}
        </Text>
        <Text style={S.time}>{item.time}</Text>
      </View>
      <Text
        style={[S.lastMessage, item.unread > 0 && S.lastMessageUnread]}
        numberOfLines={1}
      >
        {item.lastMessage}
      </Text>
    </View>
  </TouchableOpacity>
);

export default function ChatScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <Text style={S.headerTitle}>Messages</Text>
        <TouchableOpacity style={S.newBtn}>
          <Ionicons name="create-outline" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={MOCK_DMS}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <DmRow item={item} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={S.separator} />}
        ListEmptyComponent={
          <View style={S.empty}>
            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
            <Text style={S.emptyText}>No messages yet</Text>
          </View>
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#fff' },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle:        { fontSize: 22, fontWeight: '800', color: '#111827' },
  newBtn:             { padding: 4 },

  dmRow:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap:         { position: 'relative', marginRight: 12 },
  avatar:             { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e2e8f0' },
  badge:              { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', paddingHorizontal: 3 },
  badgeText:          { color: 'white', fontSize: 10, fontWeight: '800' },

  dmContent:          { flex: 1 },
  dmHeader:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  username:           { fontSize: 15, fontWeight: '600', color: '#111827' },
  usernameUnread:     { fontWeight: '800' },
  time:               { fontSize: 12, color: '#94a3b8' },
  lastMessage:        { fontSize: 14, color: '#6b7280' },
  lastMessageUnread:  { color: '#111827', fontWeight: '600' },

  separator:          { height: 1, backgroundColor: '#f8fafc', marginLeft: 80 },
  empty:              { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:          { color: '#94a3b8', fontSize: 16, marginTop: 12 },
});
