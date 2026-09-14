import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRoom } from '../../context/RoomContext';
import { Search, X, Play, Clock, Sparkles, Tv } from 'lucide-react-native';

interface VideoItem {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  url: string;
}

const SUGGESTIONS = ['Lo-Fi Beats', 'Chill Synthwave', 'Trending Music', 'Funny Memes'];

export const YouTubeSearchModal: React.FC = () => {
  const { isYouTubeSearchOpen, setIsYouTubeSearchOpen, sendMediaAction, serverUrl } = useRoom();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isYouTubeSearchOpen && results.length === 0) {
      performSearch('lofi beats to study');
    }
  }, [isYouTubeSearchOpen]);

  const performSearch = async (term: string) => {
    if (!term.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/youtube/search?q=${encodeURIComponent(term.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      console.log('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideo = (video: VideoItem) => {
    // Single tap immediate playback
    sendMediaAction('set-media', {
      url: video.url,
      title: video.title,
      appType: 'youtube',
    });
    setIsYouTubeSearchOpen(false);
  };

  return (
    <Modal
      visible={isYouTubeSearchOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsYouTubeSearchOpen(false)}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Tv size={20} color="#f87171" />
              </View>
              <Text style={styles.headerTitle}>YouTube Search</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsYouTubeSearchOpen(false)}
              style={styles.closeBtn}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Search size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs, podcasts, memes..."
              placeholderTextColor="#64748b"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => performSearch(query)}
              returnKeyType="search"
            />
          </View>

          {/* Suggestions */}
          <View style={styles.suggestionsRow}>
            {SUGGESTIONS.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.suggestionPill}
                onPress={() => {
                  setQuery(item);
                  performSearch(item);
                }}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Results List */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#ef4444" />
              <Text style={styles.loadingText}>Searching YouTube...</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.videoCard}
                  onPress={() => handleSelectVideo(item)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` }}
                    style={styles.thumbnail}
                  />
                  <View style={styles.cardContent}>
                    <Text style={styles.videoCardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.channelText} numberOfLines={1}>
                      {item.channel}
                    </Text>
                    <View style={styles.playBadge}>
                      <Play size={10} color="#ffffff" fill="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.playBadgeText}>Play Now</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
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
  modalContent: {
    flex: 1,
    backgroundColor: '#161d27',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0e14',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  suggestionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
  },
  videoCard: {
    flexDirection: 'row',
    backgroundColor: '#0b0e14',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  thumbnail: {
    width: 100,
    height: 65,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  videoCardTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  channelText: {
    color: '#64748b',
    fontSize: 11,
  },
  playBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  playBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
