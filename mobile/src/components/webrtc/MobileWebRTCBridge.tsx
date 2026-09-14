import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoom } from '../../context/RoomContext';

export const MobileWebRTCBridge: React.FC = () => {
  const { currentUser, room, serverUrl, setSpeakingUsers } = useRoom();
  const webViewRef = useRef<WebView>(null);

  // Send state updates (mute, camera, users) into the WebView WebRTC engine
  useEffect(() => {
    if (!webViewRef.current) return;
    const payload = JSON.stringify({
      type: 'STATE_UPDATE',
      data: {
        currentUserId: currentUser.id,
        isMuted: currentUser.isMuted,
        isCameraOff: currentUser.isCameraOff,
        roomSlug: room?.slug,
      },
    });
    webViewRef.current.postMessage(payload);
  }, [currentUser.id, currentUser.isMuted, currentUser.isCameraOff, room?.slug]);

  // Handle messages from the WebView WebRTC engine
  const onMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SPEAKING_UPDATE') {
        setSpeakingUsers(prev => ({
          ...prev,
          [msg.userId]: msg.isSpeaking,
        }));
      } else if (msg.type === 'LOG') {
        console.log('[WebRTC Mobile Bridge]', msg.message);
      }
    } catch (e) {
      // ignore
    }
  };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
</head>
<body style="background:transparent; margin:0; padding:0; overflow:hidden;">
  <div id="audio-container"></div>
  <script>
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

    let currentUserId = "${currentUser.id}";
    let isMuted = ${currentUser.isMuted};
    let isCameraOff = ${currentUser.isCameraOff};
    let roomSlug = "${room?.slug || ''}";

    let localStream = null;
    const peerConnections = {};
    const audioElements = {};

    function log(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', message: msg }));
      }
    }

    async function initLocalAudio() {
      try {
        if (localStream) {
          localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
          return localStream;
        }
        if (!isMuted) {
          log('Requesting mobile microphone stream...');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: !isCameraOff
          });
          localStream = stream;
          localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
          
          // Replace audio tracks on existing peer connections
          const audioTrack = stream.getAudioTracks()[0];
          Object.values(peerConnections).forEach(pc => {
            const transceivers = pc.getTransceivers();
            if (transceivers[0] && transceivers[0].sender) {
              transceivers[0].sender.replaceTrack(audioTrack).catch(() => {});
            }
          });
          log('Microphone successfully activated on mobile');
        }
      } catch (err) {
        log('Microphone error: ' + err.message);
      }
    }

    function getOrCreatePeer(targetUserId) {
      if (peerConnections[targetUserId]) return peerConnections[targetUserId];

      log('Creating peer connection for target: ' + targetUserId);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections[targetUserId] = pc;

      // Add transceivers for voice audio and camera
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'recvonly' });

      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        const transceivers = pc.getTransceivers();
        if (audioTrack && transceivers[0]?.sender) {
          transceivers[0].sender.replaceTrack(audioTrack).catch(() => {});
        }
        if (videoTrack && transceivers[1]?.sender) {
          transceivers[1].sender.replaceTrack(videoTrack).catch(() => {});
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        log('ontrack received from ' + targetUserId + ': ' + event.track.kind);
        if (event.track.kind === 'audio') {
          let audioEl = audioElements[targetUserId];
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            document.getElementById('audio-container').appendChild(audioEl);
            audioElements[targetUserId] = audioEl;
          }
          audioEl.srcObject = new MediaStream([event.track]);
          audioEl.play().catch(e => log('Audio play wait: ' + e.message));
        }
      };

      return pc;
    }

    // Signaling handlers
    socket.on('webrtc-offer', async ({ callerUserId, offer }) => {
      log('Received offer from ' + callerUserId);
      const pc = getOrCreatePeer(callerUserId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetUserId: callerUserId,
          answer: pc.localDescription
        });
        log('Sent answer to ' + callerUserId);
      } catch (e) {
        log('Error handling offer: ' + e.message);
      }
    });

    socket.on('webrtc-answer', async ({ responderUserId, answer }) => {
      log('Received answer from ' + responderUserId);
      const pc = peerConnections[responderUserId];
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          log('Error handling answer: ' + e.message);
        }
      }
    });

    socket.on('webrtc-ice-candidate', async ({ senderUserId, candidate }) => {
      const pc = peerConnections[senderUserId];
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      }
    });

    socket.on('user-left', ({ userId }) => {
      if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
      }
      if (audioElements[userId]) {
        audioElements[userId].remove();
        delete audioElements[userId];
      }
    });

    // Handle messages from React Native container
    window.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATE') {
          const { currentUserId: newUid, isMuted: newMute, isCameraOff: newCam, roomSlug: newSlug } = msg.data;
          currentUserId = newUid;
          isMuted = newMute;
          isCameraOff = newCam;
          roomSlug = newSlug;

          if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
          } else if (!isMuted) {
            await initLocalAudio();
          }
        }
      } catch (e) {}
    });

    // Unlock AudioContext on interaction
    document.addEventListener('touchstart', () => {
      if (!isMuted && !localStream) {
        initLocalAudio();
      }
      Object.values(audioElements).forEach(a => a.play().catch(() => {}));
    }, { passive: true });
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.hiddenBridge} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={onMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={styles.hiddenWebView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenBridge: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
    top: -100,
    left: -100,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
});
