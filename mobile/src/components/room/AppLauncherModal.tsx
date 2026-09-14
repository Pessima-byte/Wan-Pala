import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRoom } from '../../context/RoomContext';
import { AppType } from '../../types';
import { Tv, Palette, Swords, X, Sparkles, Film, Monitor } from 'lucide-react-native';

interface AppItem {
  type: AppType;
  title: string;
  category: string;
  desc: string;
  icon: any;
  color: string;
}

const APPS: AppItem[] = [
  {
    type: 'youtube',
    title: 'YouTube Watch Party',
    category: 'Watch Together',
    desc: 'Watch synchronized YouTube videos with friends in your lounge.',
    icon: Tv,
    color: '#ef4444',
  },
  {
    type: 'screenshare',
    title: 'Screen & Tab Share',
    category: 'Watch Together',
    desc: 'Watch live screen, stream, and browser shares in real-time.',
    icon: Monitor,
    color: '#38bdf8',
  },
  {
    type: 'whiteboard',
    title: 'Collaborative Whiteboard',
    category: 'Create',
    desc: 'Draw, sketch, and brainstorm ideas together in real-time.',
    icon: Palette,
    color: '#ec4899',
  },
  {
    type: 'card-table',
    title: 'Card Game Table',
    category: 'Play',
    desc: 'Shuffle decks and deal hands at the virtual table.',
    icon: Film,
    color: '#f59e0b',
  },
  {
    type: 'chess',
    title: 'Chess & Puzzles',
    category: 'Play',
    desc: '1v1 challenge matches and tactical puzzles.',
    icon: Swords,
    color: '#eab308',
  },
];

export const AppLauncherModal: React.FC = () => {
  const { isAppLauncherOpen, setIsAppLauncherOpen, setActiveApp, setIsYouTubeSearchOpen } = useRoom();

  const handleLaunch = (type: AppType) => {
    setIsAppLauncherOpen(false);
    setActiveApp(type);
    if (type === 'youtube') {
      setIsYouTubeSearchOpen(true);
    }
  };

  return (
    <Modal
      visible={isAppLauncherOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsAppLauncherOpen(false)}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Sparkles size={18} color="#6366f1" />
              </View>
              <Text style={styles.headerTitle}>Launch Activity</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsAppLauncherOpen(false)}
              style={styles.closeBtn}
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* App Cards List */}
          <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
            {APPS.map(app => {
              const Icon = app.icon;
              return (
                <TouchableOpacity
                  key={app.type}
                  style={styles.appCard}
                  onPress={() => handleLaunch(app.type)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.appIconBox, { backgroundColor: app.color + '20' }]}>
                    <Icon size={24} color={app.color} />
                  </View>
                  <View style={styles.appContent}>
                    <Text style={styles.appCategory}>{app.category}</Text>
                    <Text style={styles.appTitle}>{app.title}</Text>
                    <Text style={styles.appDesc}>{app.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  container: {
    flex: 1,
    backgroundColor: '#161d27',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginTop: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  appCard: {
    flexDirection: 'row',
    backgroundColor: '#0b0e14',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  appIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  appContent: {
    flex: 1,
  },
  appCategory: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  appDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
});
