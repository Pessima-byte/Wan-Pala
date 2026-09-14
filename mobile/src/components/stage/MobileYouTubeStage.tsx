import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useRoom } from '../../context/RoomContext';
import { Search, Play, Pause, Disc } from 'lucide-react-native';

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url?.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const MobileYouTubeStage: React.FC = () => {
  const { room, sendMediaAction, setIsYouTubeSearchOpen } = useRoom();
  const playerRef = useRef<YoutubeIframeRef>(null);
  const isUpdatingFromSocket = useRef(false);

  const mediaState = room?.mediaState;
  const videoId = mediaState?.url ? extractYouTubeId(mediaState.url) || '5qap5aO4i9A' : '5qap5aO4i9A';
  const isPlaying = mediaState?.playing ?? true;

  // Sync state changes from room
  useEffect(() => {
    if (!playerRef.current || !mediaState) return;

    isUpdatingFromSocket.current = true;
    const timer = setTimeout(() => {
      isUpdatingFromSocket.current = false;
    }, 500);

    return () => clearTimeout(timer);
  }, [mediaState?.playing, mediaState?.currentTime]);

  const onStateChange = (state: string) => {
    if (isUpdatingFromSocket.current) return;

    if (state === 'playing') {
      playerRef.current?.getCurrentTime().then(time => {
        sendMediaAction('play', { currentTime: time });
      });
    } else if (state === 'paused') {
      playerRef.current?.getCurrentTime().then(time => {
        sendMediaAction('pause', { currentTime: time });
      });
    } else if (state === 'ended') {
      if (mediaState?.queue && mediaState.queue.length > 1) {
        const next = mediaState.queue[1];
        sendMediaAction('set-media', { url: next.url, title: next.title, appType: 'youtube' });
        sendMediaAction('queue-remove', { id: mediaState.queue[0].id });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Video Box */}
      <View style={styles.videoBox}>
        <YoutubePlayer
          ref={playerRef}
          height={220}
          play={isPlaying}
          videoId={videoId}
          onChangeState={onStateChange}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
        />
      </View>

      {/* Media Info Bar */}
      <View style={styles.infoBar}>
        <View style={styles.titleCol}>
          <Text style={styles.videoTitle} numberOfLines={1}>
            {mediaState?.title || 'YouTube Watch Party'}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isPlaying ? '#10b981' : '#f59e0b' }]} />
            <Text style={styles.statusText}>{isPlaying ? 'Synced' : 'Paused'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => setIsYouTubeSearchOpen(true)}
          activeOpacity={0.8}
        >
          <Search size={14} color="#f87171" style={{ marginRight: 6 }} />
          <Text style={styles.searchBtnText}>Change</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  videoBox: {
    width: '100%',
    height: 220,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#161d27',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  videoTitle: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  searchBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
});
