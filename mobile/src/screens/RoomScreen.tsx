import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Image,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRoom } from '../context/RoomContext';
import { MobileYouTubeStage } from '../components/stage/MobileYouTubeStage';
import { YouTubeSearchModal } from '../components/modals/YouTubeSearchModal';
import { ChatDrawer } from '../components/chat/ChatDrawer';
import { AppLauncherModal } from '../components/room/AppLauncherModal';
import { RoomThemeModal } from '../components/modals/RoomThemeModal';
import { InviteModal } from '../components/modals/InviteModal';
import { ROOM_THEMES } from '../utils/themes';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Share2,
  Palette,
  MessageSquare,
  LogOut,
  Plus,
  Volume2,
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
    setIsThemeModalOpen,
  } = useRoom();

  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const activeApp = room?.activeApp || 'none';
  const currentTheme =
    (room?.backgroundTheme && ROOM_THEMES[room.backgroundTheme]) ||
    ROOM_THEMES['lofi-cafe'];

  const usersList = Object.values(room?.users || {});

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Dynamic Background Image with Dark Vignette */}
      <ImageBackground
        source={{ uri: currentTheme.previewUrl }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.darkVignetteOverlay} />

        <SafeAreaView style={styles.safeContainer}>
          {/* Top Bar matching screenshot */}
          <View style={styles.topBar}>
            {/* Left: Logo Emblem & Room Name */}
            <View style={styles.topBarLeft}>
              <View style={styles.logoBadgeContainer}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logoEmblem}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.roomTitle} numberOfLines={1}>
                {room?.name || "Guest's Lounge"}
              </Text>
            </View>

            {/* Right: Gold Invite pill + Theme circle + Chat circle + Leave circle */}
            <View style={styles.topBarRight}>
              {/* Invite Gold Pill Button */}
              <TouchableOpacity
                style={styles.invitePillBtn}
                onPress={() => setIsInviteOpen(true)}
                activeOpacity={0.8}
              >
                <Share2 size={13} color="#451a03" style={{ marginRight: 4 }} />
                <Text style={styles.invitePillText}>Invite</Text>
              </TouchableOpacity>

              {/* Theme/Palette Button */}
              <TouchableOpacity
                style={styles.headerCircleBtn}
                onPress={() => setIsThemeModalOpen(true)}
                activeOpacity={0.8}
              >
                <Palette size={16} color="#cbd5e1" />
              </TouchableOpacity>

              {/* Chat Button */}
              <TouchableOpacity
                style={styles.headerCircleBtn}
                onPress={() => setIsChatOpen(true)}
                activeOpacity={0.8}
              >
                <MessageSquare size={16} color="#cbd5e1" />
              </TouchableOpacity>

              {/* Exit/Leave Button (Red) */}
              <TouchableOpacity
                style={[styles.headerCircleBtn, styles.exitBtn]}
                onPress={leaveRoom}
                activeOpacity={0.8}
              >
                <LogOut size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Stage Area (Center 16:9 Player or Empty Placeholder) */}
          <View style={styles.centerStageArea}>
            {activeApp === 'youtube' ? (
              <MobileYouTubeStage />
            ) : (
              <View style={styles.placeholderStage}>
                <Text style={styles.placeholderTitle}>Stage Ready</Text>
                <Text style={styles.placeholderSub}>
                  Launch YouTube watch party or games with friends below.
                </Text>
                <TouchableOpacity
                  style={styles.launchPromptBtn}
                  onPress={() => setIsAppLauncherOpen(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#064e3b" style={{ marginRight: 6 }} />
                  <Text style={styles.launchPromptText}>Start Activity</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Bottom Area: Participant Tiles + Floating Control Dock */}
          <View style={styles.bottomSection}>
            {/* Participant Video/Avatar Tiles at bottom-left */}
            <View style={styles.tilesContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tilesScrollContent}
              >
                {usersList.map((user, idx) => {
                  if (!user) return null;
                  const userId = user.id || `user-tile-${idx}`;
                  const isMe = user.id === currentUser.id;
                  return (
                    <View key={userId} style={styles.userTileCard}>
                      {/* Speaker / Mic icon at top-right */}
                      <View style={styles.tileSpeakerBadge}>
                        <Volume2 size={12} color="#10b981" />
                      </View>

                      {/* User Avatar Circle */}
                      <View
                        style={[
                          styles.avatarCircle,
                          { backgroundColor: `${user.color || '#3b82f6'}35` },
                        ]}
                      >
                        <Text style={styles.avatarEmoji}>{user.avatar || '🐱'}</Text>
                      </View>

                      {/* Bottom Name Badge */}
                      <View style={styles.tileNameBadge}>
                        <Text style={styles.tileNameText} numberOfLines={1}>
                          {user.name || 'Guest'} {isMe ? '(You)' : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* Floating Control Dock */}
            <View style={styles.controlDockWrapper}>
              <View style={styles.controlDock}>
                {/* Mic Toggle Button (Emerald / Red) */}
                <TouchableOpacity
                  style={[
                    styles.dockSquareBtn,
                    currentUser.isMuted ? styles.dockBtnMuted : styles.dockBtnEmerald,
                  ]}
                  onPress={toggleMute}
                  activeOpacity={0.8}
                >
                  {currentUser.isMuted ? (
                    <MicOff size={20} color="#f87171" />
                  ) : (
                    <Mic size={20} color="#10b981" />
                  )}
                </TouchableOpacity>

                {/* Camera Toggle Button (Dark with subtle red or white) */}
                <TouchableOpacity
                  style={[
                    styles.dockSquareBtn,
                    currentUser.isCameraOff ? styles.dockBtnCamOff : styles.dockBtnNormal,
                  ]}
                  onPress={toggleCamera}
                  activeOpacity={0.8}
                >
                  {currentUser.isCameraOff ? (
                    <VideoOff size={20} color="#f87171" />
                  ) : (
                    <Video size={20} color="#ffffff" />
                  )}
                </TouchableOpacity>

                {/* Screen Share Button */}
                <TouchableOpacity
                  style={[styles.dockSquareBtn, styles.dockBtnNormal]}
                  onPress={() => setIsAppLauncherOpen(true)}
                  activeOpacity={0.8}
                >
                  <Monitor size={20} color="#ffffff" />
                </TouchableOpacity>

                {/* Big Emerald "+ Add App / Watch" Button */}
                <TouchableOpacity
                  style={styles.addAppBtn}
                  onPress={() => setIsAppLauncherOpen(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={18} color="#064e3b" strokeWidth={3} style={{ marginRight: 6 }} />
                  <Text style={styles.addAppText}>Add App / Watch</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>

      {/* Modals & Drawers */}
      <YouTubeSearchModal />
      <AppLauncherModal />
      <RoomThemeModal />
      <InviteModal visible={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      <ChatDrawer />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  darkVignetteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 12, 0.72)',
  },
  safeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  logoBadgeContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.6)',
    marginRight: 10,
    backgroundColor: '#000',
  },
  logoEmblem: {
    width: '100%',
    height: '100%',
  },
  roomTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invitePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fde047',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#fde047',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  invitePillText: {
    color: '#451a03',
    fontSize: 13,
    fontWeight: '700',
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exitBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },

  /* Center Stage Area */
  centerStageArea: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderStage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111622',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  placeholderSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  launchPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34d399',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  launchPromptText: {
    color: '#064e3b',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Bottom Section */
  bottomSection: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
    gap: 12,
  },

  /* Participant Tiles */
  tilesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tilesScrollContent: {
    paddingVertical: 2,
  },
  userTileCard: {
    width: 82,
    height: 82,
    borderRadius: 18,
    backgroundColor: '#0c131d',
    borderWidth: 2,
    borderColor: '#10b981', // glowing emerald border
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: 10,
    overflow: 'hidden',
  },
  tileSpeakerBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  tileNameBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    width: '100%',
    paddingVertical: 2,
    alignItems: 'center',
  },
  tileNameText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '600',
    paddingHorizontal: 4,
  },

  /* Floating Control Dock */
  controlDockWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 16, 14, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    gap: 8,
  },
  dockSquareBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dockBtnEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  dockBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dockBtnCamOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dockBtnNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34d399',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 14,
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  addAppText: {
    color: '#064e3b',
    fontSize: 13,
    fontWeight: '800',
  },
});
