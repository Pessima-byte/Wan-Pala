import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useRoom } from '../../context/RoomContext';
import { Search, Play, Pause } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');
const playerWidth = screenWidth - 24;
const playerHeight = Math.round((playerWidth * 9) / 16);

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
  const videoId = mediaState?.url ? extractYouTubeId(mediaState.url) || 'jfKfPfyJRdk' : 'jfKfPfyJRdk';
  const isPlaying = mediaState?.playing ?? true;

  // Sync state changes from room (video change, play/pause, seek drift)
  useEffect(() => {
    if (!playerRef.current || !mediaState) return;

    isUpdatingFromSocket.current = true;

    // Check drift if remote playing or paused
    const elapsedSinceUpdate = mediaState.playing
      ? (Date.now() - (mediaState.lastUpdated || Date.now())) / 1000
      : 0;
    const expectedTime = Math.max(0, (mediaState.currentTime || 0) + elapsedSinceUpdate);

    if (typeof playerRef.current.getCurrentTime === 'function') {
      playerRef.current.getCurrentTime().then(localTime => {
        if (typeof localTime === 'number' && Math.abs(localTime - expectedTime) > 1.8) {
          if (typeof playerRef.current?.seekTo === 'function') {
            playerRef.current.seekTo(expectedTime, true);
          }
        }
      }).catch(() => {});
    }

    const timer = setTimeout(() => {
      isUpdatingFromSocket.current = false;
    }, 800);

    return () => clearTimeout(timer);
  }, [mediaState?.playing, mediaState?.currentTime, mediaState?.url, mediaState?.lastUpdated]);

  const onStateChange = (state: string) => {
    if (isUpdatingFromSocket.current) return;

    if (state === 'playing') {
      if (!mediaState?.playing) {
        playerRef.current?.getCurrentTime().then(time => {
          sendMediaAction('play', { currentTime: time });
        }).catch(() => {});
      }
    } else if (state === 'paused') {
      if (mediaState?.playing) {
        playerRef.current?.getCurrentTime().then(time => {
          sendMediaAction('pause', { currentTime: time });
        }).catch(() => {});
      }
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
      {/* Video Box 16:9 */}
      <View style={[styles.videoBox, { height: playerHeight }]}>
        <YoutubePlayer
          ref={playerRef}
          width={playerWidth}
          height={playerHeight}
          play={isPlaying}
          videoId={videoId}
          onChangeState={onStateChange}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
            androidLayerType: 'hardware',
          }}
        />
      </View>

      {/* Media Info Bar matching screenshot */}
      <View style={styles.infoBar}>
        {/* Left: Red live dot + Title */}
        <View style={styles.titleContainer}>
          <View style={styles.redDot} />
          <Text style={styles.videoTitle} numberOfLines={1}>
            {mediaState?.title || 'Lofi Hip Hop Radio'}
          </Text>
        </View>

        {/* Center: Red/maroon pill button "Search / Change Video" */}
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => setIsYouTubeSearchOpen(true)}
          activeOpacity={0.8}
        >
          <Search size={13} color="#f87171" style={{ marginRight: 5 }} />
          <Text style={styles.searchBtnText}>Search / Change Video</Text>
        </TouchableOpacity>

        {/* Right: Paused or Synced indicator */}
        <View style={styles.statusContainer}>
          {isPlaying ? (
            <View style={styles.statusRow}>
              <Play size={12} color="#10b981" fill="#10b981" style={{ marginRight: 3 }} />
              <Text style={styles.syncedText}>Synced</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <Pause size={12} color="#f59e0b" style={{ marginRight: 3 }} />
              <Text style={styles.pausedText}>Paused</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0a0d14',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  videoBox: {
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111622',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  redDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  videoTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginHorizontal: 4,
  },
  searchBtnText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncedText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  pausedText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
});
