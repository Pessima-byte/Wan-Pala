import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Share,
} from 'react-native';
import { useRoom } from '../context/RoomContext';
import { MobileYouTubeStage } from '../components/stage/MobileYouTubeStage';
import { YouTubeSearchModal } from '../components/modals/YouTubeSearchModal';
import { ChatDrawer } from '../components/chat/ChatDrawer';
import { AppLauncherModal } from '../components/room/AppLauncherModal';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  PlusCircle,
  Share2,
  LogOut,
  Users,
} from 'lucide-react-native';

export const RoomScreen: React.FC = () => {
  const {
    room,
    currentUser,
    leaveRoom,
    toggleMute,
    toggleCamera,
    setIsChatOpen,
    setIsAppLauncherOpen,
  } = useRoom();

  const userCount = Object.keys(room?.users || {}).length;
  const activeApp = room?.activeApp || 'none';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my WAN PALA Lounge: ${room?.name || 'Room'} (Code: ${room?.slug})`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room?.name || 'WAN PALA Lounge'}
          </Text>
          <View style={styles.peerBadge}>
            <Users size={12} color="#10b981" style={{ marginRight: 4 }} />
            <Text style={styles.peerCount}>{userCount} in Lounge</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
            <Share2 size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, styles.leaveBtn]} onPress={leaveRoom}>
            <LogOut size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Stage View */}
      <ScrollView contentContainerStyle={styles.stageScroll}>
        {activeApp === 'youtube' ? (
          <MobileYouTubeStage />
        ) : (
          <View style={styles.emptyStage}>
            <Text style={styles.emptyStageTitle}>No Activity on Stage</Text>
            <Text style={styles.emptyStageSub}>
              Launch a YouTube watch party or collaborative game with friends.
            </Text>
            <TouchableOpacity
              style={styles.launchStageBtn}
              onPress={() => setIsAppLauncherOpen(true)}
            >
              <PlusCircle size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.launchStageBtnText}>Launch Activity</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Participants Grid / Strips */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionHeader}>People in Room</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.usersScroll}>
            {Object.values(room?.users || {}).map(user => {
              const isMe = user.id === currentUser.id;
              return (
                <View key={user.id} style={styles.userCard}>
                  <View style={[styles.userAvatarBox, { borderColor: user.color || '#6366f1' }]}>
                    <Text style={styles.userAvatarText}>{user.avatar || '👤'}</Text>
                    {user.isMuted && (
                      <View style={styles.userMuteBadge}>
                        <MicOff size={10} color="#ffffff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name} {isMe && '(You)'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Floating Bottom Control Bar */}
      <View style={styles.bottomBar}>
        {/* Mic toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, currentUser.isMuted && styles.controlBtnInactive]}
          onPress={toggleMute}
        >
          {currentUser.isMuted ? (
            <MicOff size={20} color="#f87171" />
          ) : (
            <Mic size={20} color="#10b981" />
          )}
        </TouchableOpacity>

        {/* Cam toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, currentUser.isCameraOff && styles.controlBtnInactive]}
          onPress={toggleCamera}
        >
          {currentUser.isCameraOff ? (
            <VideoOff size={20} color="#f87171" />
          ) : (
            <Video size={20} color="#10b981" />
          )}
        </TouchableOpacity>

        {/* Add App / Stage Launcher */}
        <TouchableOpacity
          style={[styles.controlBtn, styles.launchBtn]}
          onPress={() => setIsAppLauncherOpen(true)}
        >
          <PlusCircle size={20} color="#ffffff" />
          <Text style={styles.launchBtnText}>Launch</Text>
        </TouchableOpacity>

        {/* Chat Drawer Toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, styles.chatBtn]}
          onPress={() => setIsChatOpen(true)}
        >
          <MessageSquare size={20} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <YouTubeSearchModal />
      <AppLauncherModal />
      <ChatDrawer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  roomInfo: {
    flex: 1,
    marginRight: 10,
  },
  roomName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  peerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  peerCount: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  stageScroll: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyStage: {
    backgroundColor: '#161d27',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyStageTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStageSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 16,
  },
  launchStageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  launchStageBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  participantsSection: {
    marginTop: 20,
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  usersScroll: {
    flexDirection: 'row',
  },
  userCard: {
    alignItems: 'center',
    marginRight: 12,
    width: 70,
  },
  userAvatarBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#161d27',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
  },
  userAvatarText: {
    fontSize: 24,
  },
  userMuteBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(22, 29, 39, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#0b0e14',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  controlBtnInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  launchBtn: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
    width: 100,
    paddingHorizontal: 10,
  },
  launchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  chatBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
});
