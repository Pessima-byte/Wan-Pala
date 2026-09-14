import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoom } from '../../context/RoomContext';
import { X, Send, MessageSquare } from 'lucide-react-native';

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '🍿', '👾', '💯'];

export const ChatDrawer: React.FC = () => {
  const { isChatOpen, setIsChatOpen, room, currentUser, sendMessage } = useRoom();
  const [inputText, setInputText] = useState('');

  const messages = room?.chatMessages || [];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;
    sendMessage(text.trim());
    if (!textToSend) setInputText('');
  };

  return (
    <Modal
      visible={isChatOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsChatOpen(false)}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MessageSquare size={18} color="#6366f1" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Lounge Chat</Text>
            </View>
            <TouchableOpacity onPress={() => setIsChatOpen(false)} style={styles.closeBtn}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Quick Reactions Bar */}
          <View style={styles.reactionsBar}>
            {QUICK_REACTIONS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => handleSend(emoji)}
              >
                <Text style={styles.reactionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chat Messages */}
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingVertical: 10 }}
            renderItem={({ item }) => {
              const isMe = item.senderId === currentUser.id;
              if (item.isSystem) {
                return (
                  <View style={styles.systemMsg}>
                    <Text style={styles.systemMsgText}>
                      {item.senderAvatar} {item.text}
                    </Text>
                  </View>
                );
              }
              return (
                <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
                    <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Input Bar */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Send message to lounge..."
              placeholderTextColor="#64748b"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend()}>
              <Send size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    marginTop: 60,
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
  reactionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  reactionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  reactionText: {
    fontSize: 18,
  },
  systemMsg: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 4,
  },
  systemMsgText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  msgRow: {
    marginVertical: 4,
  },
  msgRowMe: {
    alignItems: 'flex-end',
  },
  msgRowThem: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#0b0e14',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  senderName: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  msgTextMe: {
    color: '#ffffff',
  },
  msgTextThem: {
    color: '#e2e8f0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0b0e14',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendBtn: {
    backgroundColor: '#4f46e5',
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
