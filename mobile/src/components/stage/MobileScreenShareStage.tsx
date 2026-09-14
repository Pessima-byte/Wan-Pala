import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoom } from '../../context/RoomContext';
import { Monitor, Radio } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');
const STAGE_WIDTH = screenWidth - 24;
const STAGE_HEIGHT = Math.round((STAGE_WIDTH * 9) / 16);

export const MobileScreenShareStage: React.FC = () => {
  const { room, serverUrl, currentUser } = useRoom();

  const presenterUser = useMemo(() => {
    if (room?.mediaState?.screenSharingUserId && room.users[room.mediaState.screenSharingUserId]) {
      return room.users[room.mediaState.screenSharingUserId];
    }
    const sharingUser = Object.values(room?.users || {}).find(u => u.isScreenSharing);
    if (sharingUser) return sharingUser;
    return undefined;
  }, [room?.mediaState?.screenSharingUserId, room?.users]);

  const presenterId = presenterUser?.id || room?.mediaState?.screenSharingUserId || '';
  const presenterName = presenterUser?.name || 'Presenter';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    #overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.7);
      background: rgba(11, 15, 25, 0.95);
      z-index: 10;
      font-size: 13px;
      gap: 10px;
    }
  </style>
</head>
<body>
  <div id="overlay">
    <div>📡 Connecting to live stream...</div>
  </div>
  <video id="screen-video" autoplay playsinline></video>

  <script>
    const video = document.getElementById('screen-video');
    const overlay = document.getElementById('overlay');
    const presenterId = "${presenterId}";
    const currentUserId = "${currentUser.id}";

    const socket = io("${serverUrl}", {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    const ICE_SERVERS = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: ['stun:relay.metered.ca:80', 'stun:relay.metered.ca:443'] },
        { urls: 'turn:relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
      ]
    };

    let pc = null;

    function getOrCreatePC() {
      if (pc) return pc;
      pc = new RTCPeerConnection(ICE_SERVERS);

      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (event.track.kind === 'video') {
          video.srcObject = new MediaStream([event.track]);
          video.play().then(() => {
            overlay.style.display = 'none';
          }).catch(() => {});
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && presenterId) {
          socket.emit('webrtc-ice-candidate', {
            targetUserId: presenterId,
            candidate: event.candidate
          });
        }
      };

      return pc;
    }

    socket.on('webrtc-offer', async ({ callerUserId, offer }) => {
      if (presenterId && callerUserId !== presenterId) return;
      const peer = getOrCreatePC();
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetUserId: callerUserId,
          answer: peer.localDescription
        });
      } catch (e) {
        console.error('Screen offer error:', e);
      }
    });

    socket.on('webrtc-answer', async ({ responderUserId, answer }) => {
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {}
      }
    });

    socket.on('webrtc-ice-candidate', async ({ senderUserId, candidate }) => {
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      }
    });

    // Request renegotiation from presenter
    if (presenterId) {
      setTimeout(() => {
        socket.emit('webrtc-request-renegotiate', { targetUserId: presenterId });
      }, 500);
    }

    document.addEventListener('touchstart', () => {
      video.play().catch(() => {});
    }, { passive: true });
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      {/* 16:9 Screen Share Display Box */}
      <View style={[styles.videoBox, { width: STAGE_WIDTH, height: STAGE_HEIGHT }]}>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={styles.webView}
        />
      </View>

      {/* Info Bar matching UI design */}
      <View style={styles.infoBar}>
        <View style={styles.presenterInfo}>
          <Monitor size={14} color="#38bdf8" style={{ marginRight: 6 }} />
          <Text style={styles.presenterText} numberOfLines={1}>
            {presenterName}'s Live Stream
          </Text>
        </View>

        <View style={styles.liveBadge}>
          <Radio size={12} color="#10b981" style={{ marginRight: 4 }} />
          <Text style={styles.liveText}>LIVE HD</Text>
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
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
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
  presenterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  presenterText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
