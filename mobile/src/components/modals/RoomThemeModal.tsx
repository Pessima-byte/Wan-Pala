import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRoom } from '../../context/RoomContext';
import { ROOM_THEMES, RoomTheme } from '../../utils/themes';
import { Palette, X, Check } from 'lucide-react-native';

export const RoomThemeModal: React.FC = () => {
  const { isThemeModalOpen, setIsThemeModalOpen, room, updateRoomSettings } = useRoom();

  const currentThemeId = room?.backgroundTheme || 'lofi-cafe';

  const handleSelectTheme = (theme: RoomTheme) => {
    updateRoomSettings({ backgroundTheme: theme.id });
    setIsThemeModalOpen(false);
  };

  return (
    <Modal
      visible={isThemeModalOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsThemeModalOpen(false)}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Palette size={20} color="#a855f7" />
              </View>
              <Text style={styles.headerTitle}>Room Ambiance & Theme</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsThemeModalOpen(false)}
              style={styles.closeBtn}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Theme List */}
          <ScrollView contentContainerStyle={styles.scrollList}>
            {Object.values(ROOM_THEMES).map(theme => {
              const isSelected = theme.id === currentThemeId;
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.themeCard, isSelected && styles.themeCardActive]}
                  onPress={() => handleSelectTheme(theme)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: theme.previewUrl }}
                    style={styles.themeImage}
                    resizeMode="cover"
                  />
                  <View style={styles.themeOverlay} />
                  <View style={styles.themeInfo}>
                    <Text style={styles.themeName}>{theme.name}</Text>
                    <Text style={styles.themeDesc}>{theme.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Check size={14} color="#ffffff" />
                    </View>
                  )}
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
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
  },
  scrollList: {
    padding: 16,
    gap: 12,
  },
  themeCard: {
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    marginBottom: 10,
  },
  themeCardActive: {
    borderColor: '#10b981',
  },
  themeImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  themeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  themeInfo: {
    paddingHorizontal: 16,
    zIndex: 2,
  },
  themeName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  themeDesc: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
});
