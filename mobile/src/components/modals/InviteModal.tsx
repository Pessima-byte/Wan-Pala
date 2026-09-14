import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Share,
} from 'react-native';
import { useRoom } from '../../context/RoomContext';
import { X, Copy, Check, Share2, Sparkles } from 'lucide-react-native';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ visible, onClose }) => {
  const { room } = useRoom();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const roomCode = room.slug;
  const webLink = `https://wan-pala.onrender.com/room/${room.slug}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my WAN PALA Lounge: ${room.name}\nRoom Code: ${roomCode}\nWeb Link: ${webLink}`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Sparkles size={20} color="#f59e0b" />
              </View>
              <Text style={styles.headerTitle}>Invite Friends</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.desc}>
              Share this room code with your friends so they can join your watch party instantly!
            </Text>

            {/* Room Code Box */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>ROOM CODE</Text>
              <Text style={styles.codeValue}>{roomCode}</Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 size={16} color="#0f172a" style={{ marginRight: 8 }} />
              <Text style={styles.shareBtnText}>Share Invitation Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
  body: {
    padding: 20,
    alignItems: 'center',
  },
  desc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  codeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  codeValue: {
    color: '#34d399',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34d399',
    borderRadius: 14,
    width: '100%',
    paddingVertical: 14,
  },
  shareBtnText: {
    color: '#064e3b',
    fontSize: 14,
    fontWeight: '700',
  },
});
