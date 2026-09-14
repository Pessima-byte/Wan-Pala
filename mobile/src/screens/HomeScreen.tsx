import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRoom } from '../context/RoomContext';
import {
  Plus,
  ArrowRight,
  Sparkles,
  Tv,
  Film,
  Gamepad2,
  Users,
  Settings,
} from 'lucide-react-native';

const AVATARS = ['🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦄', '🚀', '⭐', '🍕', '🎮', '🎧', '👾', '✨', '⚡'];
const COLORS = ['#10b981', '#34d399', '#06b6d4', '#3b82f6', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

export const HomeScreen: React.FC = () => {
  const { joinRoom, connected, serverUrl, setServerUrl } = useRoom();

  const [name, setName] = useState('Guest_' + Math.floor(1000 + Math.random() * 9000));
  const [avatar, setAvatar] = useState('🐱');
  const [color, setColor] = useState('#f59e0b');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState(serverUrl);

  const randomizeAvatar = () => {
    setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const handleCreateLounge = async () => {
    const slug = 'lounge-' + Math.floor(100 + Math.random() * 900);
    const finalRoomName = roomName.trim() || `${name}'s Lounge`;
    setIsSubmitting(true);
    const success = await joinRoom(slug, name, avatar, finalRoomName);
    setIsSubmitting(false);
    if (!success) {
      Alert.alert(
        'Connection Issue',
        `Unable to reach server at ${serverUrl}. If the server is on a free tier, it may be waking up—please try again in a few seconds, or check the server URL in settings.`
      );
    }
  };

  const handleJoinByCode = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Room Required', 'Please enter a room code or link.');
      return;
    }
    const cleanSlug = roomCode.replace(/^.*\/room\//, '').trim();
    setIsSubmitting(true);
    const success = await joinRoom(cleanSlug, name, avatar);
    setIsSubmitting(false);
    if (!success) {
      Alert.alert(
        'Connection Issue',
        `Unable to join room at ${serverUrl}. Make sure the code is correct, or wait a moment if the cloud server is waking up.`
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconBox}>
              <Image source={require('../../assets/icon.png')} style={styles.brandIcon} />
            </View>
            <Text style={styles.brandTitle}>WAN  PALA</Text>
          </View>

          <View style={styles.topRightRow}>
            <View style={styles.liveMeshBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveMeshText}>Live Mesh</Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowConfig(!showConfig)}
              style={styles.settingsBtn}
              activeOpacity={0.7}
            >
              <Settings size={14} color="#10b981" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Server Config Dropdown */}
        {showConfig && (
          <View style={styles.configDrawer}>
            <Text style={styles.configLabel}>Backend Host URL (LAN or Tunnel):</Text>
            <TextInput
              style={styles.configInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.X:5001"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              style={styles.configSaveBtn}
              onPress={() => {
                setServerUrl(tempUrl);
                setShowConfig(false);
              }}
            >
              <Text style={styles.configSaveBtnText}>Save URL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Logo with Glow Ring */}
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <View style={styles.logoBorderWrapper}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.logoLiveBadge} />
          </View>

          {/* Krio Virtual Lounge pill */}
          <View style={styles.krioPill}>
            <Text style={styles.krioPillText}>KRIO VIRTUAL LOUNGE</Text>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>
            Watch & Play <Text style={styles.headlineHighlight}>Together</Text>
          </Text>
          <Text style={styles.subheadline}>
            Sync YouTube, movies, chess & crystal-clear voice chat.
          </Text>
        </View>

        {/* Main Action Card */}
        <View style={styles.actionCard}>
          {/* Segmented Switcher */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[styles.segmentedTab, activeTab === 'create' && styles.segmentedTabActive]}
              onPress={() => setActiveTab('create')}
              activeOpacity={0.8}
            >
              <Plus
                size={13}
                color={activeTab === 'create' ? '#090d0b' : '#94a3b8'}
                strokeWidth={3}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.segmentedTabText,
                  activeTab === 'create' && styles.segmentedTabTextActive,
                ]}
              >
                Create Lounge
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentedTab, activeTab === 'join' && styles.segmentedTabActive]}
              onPress={() => setActiveTab('join')}
              activeOpacity={0.8}
            >
              <ArrowRight
                size={13}
                color={activeTab === 'join' ? '#090d0b' : '#94a3b8'}
                strokeWidth={3}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.segmentedTabText,
                  activeTab === 'join' && styles.segmentedTabTextActive,
                ]}
              >
                Join by Code
              </Text>
            </TouchableOpacity>
          </View>

          {/* Profile Input & Avatar Row */}
          <View style={styles.profileRow}>
            <TouchableOpacity
              style={[styles.avatarBox, { backgroundColor: `${color}25` }]}
              onPress={randomizeAvatar}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarEmoji}>{avatar}</Text>
            </TouchableOpacity>

            <View style={styles.nameAndColors}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your display name..."
                placeholderTextColor="#64748b"
                maxLength={20}
              />

              <View style={styles.colorsRow}>
                {COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorDotWrapper,
                      color === c && styles.colorDotWrapperActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.colorDot, { backgroundColor: c }]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Inputs & Launch Button */}
          {activeTab === 'create' ? (
            <View style={styles.tabContent}>
              <TextInput
                style={styles.inputField}
                placeholder="Lounge name (e.g. VIP Cinema)..."
                placeholderTextColor="#64748b"
                value={roomName}
                onChangeText={setRoomName}
              />
              <TouchableOpacity
                style={[styles.launchBtn, isSubmitting && { opacity: 0.8 }]}
                onPress={handleCreateLounge}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#090d0b" style={{ marginRight: 8 }} />
                    <Text style={styles.launchBtnText}>Connecting to Lounge...</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} color="#090d0b" style={{ marginRight: 6 }} />
                    <Text style={styles.launchBtnText}>Launch Lounge Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tabContent}>
              <TextInput
                style={styles.inputField}
                placeholder="Enter room code or link..."
                placeholderTextColor="#64748b"
                value={roomCode}
                onChangeText={setRoomCode}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.launchBtn, isSubmitting && { opacity: 0.8 }]}
                onPress={handleJoinByCode}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#090d0b" style={{ marginRight: 8 }} />
                    <Text style={styles.launchBtnText}>Entering Lounge...</Text>
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} color="#090d0b" style={{ marginRight: 6 }} />
                    <Text style={styles.launchBtnText}>Enter Lounge</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2x2 Feature Highlights Grid */}
        <View style={styles.featureGrid}>
          {/* Item 1 */}
          <View style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Tv size={14} color="#f87171" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>YouTube Party</Text>
              <Text style={styles.featureSub}>Synced 4K video</Text>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Film size={14} color="#34d399" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Local Movies</Text>
              <Text style={styles.featureSub}>Direct P2P stream</Text>
            </View>
          </View>

          {/* Item 3 */}
          <View style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Gamepad2 size={14} color="#fbbf24" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Chess & Arcade</Text>
              <Text style={styles.featureSub}>1v1 & puzzles</Text>
            </View>
          </View>

          {/* Item 4 */}
          <View style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
              <Users size={14} color="#2dd4bf" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Voice & Cams</Text>
              <Text style={styles.featureSub}>Mesh audio room</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>WAN PALA • Private Peer-to-Peer Lounge</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060b09',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'space-between',
    backgroundColor: '#060b09',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  brandIcon: {
    width: 22,
    height: 22,
  },
  brandTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveMeshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34d399',
    marginRight: 6,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  liveMeshText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  settingsBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  configDrawer: {
    backgroundColor: '#0a1411',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  configLabel: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  configInput: {
    backgroundColor: '#060b09',
    color: '#ffffff',
    fontSize: 12,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  configSaveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  configSaveBtnText: {
    color: '#060b09',
    fontSize: 11,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  logoBorderWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    padding: 3,
    backgroundColor: '#0a1411',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  logoLiveBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#060b09',
  },
  krioPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 6,
  },
  krioPillText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headline: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headlineHighlight: {
    color: '#5eead4',
  },
  subheadline: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 3,
    maxWidth: 260,
  },
  actionCard: {
    backgroundColor: 'rgba(10, 20, 17, 0.95)',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    marginVertical: 4,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#040706',
    borderRadius: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 7,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentedTabActive: {
    backgroundColor: '#34d399',
  },
  segmentedTabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  segmentedTabTextActive: {
    color: '#090d0b',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    marginRight: 10,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  nameAndColors: {
    flex: 1,
    justifyContent: 'center',
  },
  nameInput: {
    backgroundColor: '#040706',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 6,
  },
  colorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorDotWrapper: {
    padding: 2,
    borderRadius: 10,
  },
  colorDotWrapperActive: {
    borderWidth: 1.5,
    borderColor: '#fbbf24',
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  tabContent: {
    gap: 8,
  },
  inputField: {
    backgroundColor: '#040706',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  launchBtn: {
    flexDirection: 'row',
    backgroundColor: '#fbbf24',
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  launchBtnText: {
    color: '#090d0b',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 4,
  },
  featureCard: {
    width: (Dimensions.get('window').width - 40) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 20, 17, 0.8)',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  featureIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  featureSub: {
    color: '#94a3b8',
    fontSize: 8.5,
    marginTop: 1,
  },
  footerText: {
    color: 'rgba(110, 231, 183, 0.35)',
    fontSize: 9.5,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
