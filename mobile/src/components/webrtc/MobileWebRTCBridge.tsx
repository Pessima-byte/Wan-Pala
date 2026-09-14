import React, { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoom } from '../../context/RoomContext';

export const MobileWebRTCBridge: React.FC = () => {
  const { socket, currentUser, room, setSpeakingUsers } = useRoom();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingQueue = useRef<string[]>([]);

  const postToWebView = useCallback((data: any) => {
    const payload = JSON.stringify(data);
    if (!isReady || !webViewRef.current) {
      pendingQueue.current.push(payload);
    } else {
      webViewRef.current.postMessage(payload);
    }
  }, [isReady]);

  // Flush queued messages once WebView is confirmed ready
  useEffect(() => {
    if (isReady && webViewRef.current && pendingQueue.current.length > 0) {
      const queue = [...pendingQueue.current];
      pendingQueue.current = [];
      queue.forEach(item => {
        webViewRef.current?.postMessage(item);
      });
    }
  }, [isReady]);

  // Send state updates (mute, camera, current user ID) into WebView
  useEffect(() => {
    postToWebView({
      type: 'STATE_UPDATE',
      data: {
        currentUserId: currentUser.id,
        isMuted: currentUser.isMuted,
        isCameraOff: currentUser.isCameraOff,
      },
    });
  }, [currentUser.id, currentUser.isMuted, currentUser.isCameraOff, postToWebView]);

  // Listen to WebRTC signaling events on the primary room socket and forward into WebView
  useEffect(() => {
    if (!socket) return;

    const onOffer = (payload: { callerUserId: string; offer: any }) => {
      console.log(`[MobileWebRTCBridge] Received webrtc-offer from ${payload.callerUserId}`);
      postToWebView({ type: 'SIGNAL_IN', event: 'webrtc-offer', payload });
    };

    const onAnswer = (payload: { responderUserId: string; answer: any }) => {
      console.log(`[MobileWebRTCBridge] Received webrtc-answer from ${payload.responderUserId}`);
      postToWebView({ type: 'SIGNAL_IN', event: 'webrtc-answer', payload });
    };

    const onIceCandidate = (payload: { senderUserId: string; candidate: any }) => {
      postToWebView({ type: 'SIGNAL_IN', event: 'webrtc-ice-candidate', payload });
    };

    const onRenegotiate = (payload: { targetUserId: string }) => {
      console.log(`[MobileWebRTCBridge] Received webrtc-request-renegotiate for ${payload.targetUserId}`);
      postToWebView({ type: 'SIGNAL_IN', event: 'webrtc-request-renegotiate', payload });
    };

    const onUserJoined = (data: { user: any; users: Record<string, any> }) => {
      if (data.user && data.user.id && data.user.id !== currentUser.id) {
        console.log(`[MobileWebRTCBridge] User joined: ${data.user.name} (${data.user.id}), notifying engine...`);
        postToWebView({ type: 'CALL_PEER', targetUserId: data.user.id });
      }
    };

    const onUserLeft = (data: { userId: string }) => {
      console.log(`[MobileWebRTCBridge] User left: ${data.userId}`);
      postToWebView({ type: 'USER_LEFT', userId: data.userId });
    };

    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    socket.on('webrtc-ice-candidate', onIceCandidate);
    socket.on('webrtc-request-renegotiate', onRenegotiate);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('webrtc-offer', onOffer);
      socket.off('webrtc-answer', onAnswer);
      socket.off('webrtc-ice-candidate', onIceCandidate);
      socket.off('webrtc-request-renegotiate', onRenegotiate);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
    };
  }, [socket, currentUser.id, postToWebView]);

  // Handle messages dispatched from inside WebView
  const onMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'READY') {
        console.log('[MobileWebRTCBridge] WebView engine is READY');
        setIsReady(true);
        // Connect to any existing users in room
        if (room?.users) {
          Object.keys(room.users).forEach(peerId => {
            if (peerId !== currentUser.id) {
              postToWebView({ type: 'CALL_PEER', targetUserId: peerId });
            }
          });
        }
      } else if (msg.type === 'SIGNAL_OUT') {
        if (socket && socket.connected) {
          socket.emit(msg.event, msg.payload);
        }
      } else if (msg.type === 'SPEAKING_UPDATE') {
        setSpeakingUsers(prev => ({
          ...prev,
          [msg.userId]: msg.isSpeaking,
        }));
      } else if (msg.type === 'LOG') {
        console.log('[MobileWebRTCBridge Engine]', msg.message);
      }
    } catch (e) {
      console.warn('[MobileWebRTCBridge] onMessage parse error:', e);
    }
  }, [socket, currentUser.id, room?.users, postToWebView, setSpeakingUsers]);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WAN PALA Audio Engine</title>
</head>
<body style="background:transparent; margin:0; padding:0; overflow:hidden;">
  <div id="audio-container"></div>
  <script>
    (function() {
      const ICE_SERVERS = {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
          { urls: ['stun:relay.metered.ca:80', 'stun:relay.metered.ca:443'] },
          { urls: 'turn:relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
        ],
        iceCandidatePoolSize: 2
      };

      let currentUserId = "${currentUser.id}";
      let isMuted = ${currentUser.isMuted};
      let isCameraOff = ${currentUser.isCameraOff};

      let localStream = null;
      let globalAudioCtx = null;
      const peerConnections = {};
      const pendingCandidates = {};
      const audioElements = {};
      const makingOffer = {};

      function postToRN(type, eventOrData, payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: type,
            event: eventOrData,
            payload: payload
          }));
        }
      }

      function log(msg) {
        postToRN('LOG', null, msg);
      }

      function getAudioContext() {
        if (!globalAudioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            globalAudioCtx = new AudioCtx();
          }
        }
        if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
          globalAudioCtx.resume().catch(function() {});
        }
        return globalAudioCtx;
      }

      function setupVAD(sourceNode, userId) {
        try {
          const ctx = getAudioContext();
          if (!ctx) return;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.4;
          sourceNode.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let isSpeaking = false;

          setInterval(function() {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const speakingNow = avg > 12;
            if (speakingNow !== isSpeaking) {
              isSpeaking = speakingNow;
              postToRN('SPEAKING_UPDATE', null, { userId: userId, isSpeaking: speakingNow });
            }
          }, 150);
        } catch (e) {}
      }

      async function initLocalAudio() {
        if (localStream) {
          localStream.getAudioTracks().forEach(function(t) {
            t.enabled = !isMuted;
          });
          return localStream;
        }

        try {
          log('Acquiring microphone stream via getUserMedia...');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });

          localStream = stream;
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = !isMuted;
          }

          // Attach local audio track to transceiver 0 of all existing peer connections
          Object.values(peerConnections).forEach(function(pc) {
            const transceivers = pc.getTransceivers();
            if (transceivers[0] && transceivers[0].sender && audioTrack) {
              transceivers[0].sender.replaceTrack(audioTrack).catch(function(e) {
                log('replaceTrack err: ' + e.message);
              });
            }
          });

          // Also set up voice activity detection for self
          try {
            const ctx = getAudioContext();
            if (ctx && audioTrack) {
              const selfSrc = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
              setupVAD(selfSrc, currentUserId);
            }
          } catch(e) {}

          log('Microphone successfully initialized on mobile!');
          return stream;
        } catch (err) {
          log('getUserMedia error on mobile: ' + err.message);
        }
      }

      function getOrCreatePeer(targetUserId) {
        if (peerConnections[targetUserId]) {
          return peerConnections[targetUserId];
        }

        log('Creating RTCPeerConnection for ' + targetUserId);
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections[targetUserId] = pc;
        pendingCandidates[targetUserId] = [];
        makingOffer[targetUserId] = false;

        // Transceivers strictly matching Web app m-lines:
        // 0: Audio (sendrecv)
        // 1: Camera Video (sendrecv)
        // 2: Screen Video (recvonly)
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'recvonly' });

        // Attach local microphone track if available
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            const transceivers = pc.getTransceivers();
            if (transceivers[0] && transceivers[0].sender) {
              transceivers[0].sender.replaceTrack(audioTrack).catch(function() {});
            }
          }
        }

        pc.onicecandidate = function(event) {
          if (event.candidate) {
            postToRN('SIGNAL_OUT', 'webrtc-ice-candidate', {
              targetUserId: targetUserId,
              candidate: event.candidate
            });
          }
        };

        pc.ontrack = function(event) {
          log('ontrack from ' + targetUserId + ': ' + event.track.kind + ' (id: ' + event.track.id + ')');
          if (event.track.kind === 'audio') {
            // 1. Play using HTMLAudioElement with autoplay & playsinline
            let audioEl = audioElements[targetUserId];
            if (!audioEl) {
              audioEl = document.createElement('audio');
              audioEl.autoplay = true;
              audioEl.playsInline = true;
              audioEl.volume = 1.0;
              document.getElementById('audio-container').appendChild(audioEl);
              audioElements[targetUserId] = audioEl;
            }
            audioEl.srcObject = new MediaStream([event.track]);
            audioEl.play().catch(function(e) {
              log('Audio element play pending interaction: ' + e.message);
            });

            // 2. Play using Web Audio AudioContext (bypasses iOS autoplay policies on WKWebView)
            try {
              const ctx = getAudioContext();
              if (ctx) {
                const srcNode = ctx.createMediaStreamSource(new MediaStream([event.track]));
                srcNode.connect(ctx.destination);
                setupVAD(srcNode, targetUserId);
                log('WebAudio destination connected for peer ' + targetUserId);
              }
            } catch (e) {
              log('WebAudio playback error: ' + e.message);
            }
          }
        };

        return pc;
      }

      async function callPeer(targetUserId) {
        log('Initiating call to peer ' + targetUserId);
        const pc = getOrCreatePeer(targetUserId);

        if (!localStream) {
          await initLocalAudio();
        }

        if (pc.signalingState !== 'stable' || makingOffer[targetUserId]) {
          log('callPeer: Peer ' + targetUserId + ' busy (' + pc.signalingState + ')');
          return;
        }

        try {
          makingOffer[targetUserId] = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          postToRN('SIGNAL_OUT', 'webrtc-offer', {
            targetUserId: targetUserId,
            callerUserId: currentUserId,
            offer: pc.localDescription
          });
          log('Sent webrtc-offer to ' + targetUserId);
        } catch (err) {
          log('callPeer createOffer error: ' + err.message);
        } finally {
          makingOffer[targetUserId] = false;
        }
      }

      async function handleOffer(callerUserId, offer) {
        log('Handling webrtc-offer from ' + callerUserId);
        const pc = getOrCreatePeer(callerUserId);

        // Pre-warm local audio so mic is ready
        if (!localStream) {
          initLocalAudio().catch(function() {});
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          // Drain queued candidates
          if (pendingCandidates[callerUserId]) {
            for (const cand of pendingCandidates[callerUserId]) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(function() {});
            }
            delete pendingCandidates[callerUserId];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          postToRN('SIGNAL_OUT', 'webrtc-answer', {
            targetUserId: callerUserId,
            answer: pc.localDescription
          });
          log('Sent webrtc-answer to ' + callerUserId);
        } catch (err) {
          log('handleOffer error: ' + err.message);
        }
      }

      async function handleAnswer(responderUserId, answer) {
        log('Handling webrtc-answer from ' + responderUserId);
        const pc = peerConnections[responderUserId];
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            if (pendingCandidates[responderUserId]) {
              for (const cand of pendingCandidates[responderUserId]) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(function() {});
              }
              delete pendingCandidates[responderUserId];
            }
            log('Remote answer set successfully for ' + responderUserId);
          } catch (err) {
            log('handleAnswer error: ' + err.message);
          }
        }
      }

      async function handleIceCandidate(senderUserId, candidate) {
        const pc = peerConnections[senderUserId];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {}
        } else {
          if (!pendingCandidates[senderUserId]) pendingCandidates[senderUserId] = [];
          pendingCandidates[senderUserId].push(candidate);
        }
      }

      function unlockAllAudio() {
        getAudioContext();
        Object.values(audioElements).forEach(function(a) {
          a.play().catch(function() {});
        });
      }

      document.addEventListener('touchstart', unlockAllAudio, { passive: true });
      document.addEventListener('click', unlockAllAudio, { passive: true });

      window.addEventListener('message', async function(event) {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'SIGNAL_IN') {
            const ev = msg.event;
            const payload = msg.payload;

            if (ev === 'webrtc-offer') {
              await handleOffer(payload.callerUserId, payload.offer);
            } else if (ev === 'webrtc-answer') {
              await handleAnswer(payload.responderUserId, payload.answer);
            } else if (ev === 'webrtc-ice-candidate') {
              await handleIceCandidate(payload.senderUserId, payload.candidate);
            } else if (ev === 'webrtc-request-renegotiate') {
              await callPeer(payload.targetUserId);
            }

          } else if (msg.type === 'CALL_PEER') {
            await callPeer(msg.targetUserId);

          } else if (msg.type === 'STATE_UPDATE') {
            const d = msg.data;
            currentUserId = d.currentUserId || currentUserId;
            isMuted = d.isMuted;
            isCameraOff = d.isCameraOff;

            if (localStream) {
              localStream.getAudioTracks().forEach(function(t) {
                t.enabled = !isMuted;
              });
            } else if (!isMuted) {
              await initLocalAudio();
            }

          } else if (msg.type === 'USER_LEFT') {
            const uid = msg.userId;
            if (peerConnections[uid]) {
              peerConnections[uid].close();
              delete peerConnections[uid];
            }
            if (audioElements[uid]) {
              audioElements[uid].remove();
              delete audioElements[uid];
            }
          }
        } catch (err) {
          log('window message error: ' + err.message);
        }
      });

      // Announce ready to React Native container
      postToRN('READY', null, null);
      log('Engine initialized, ready signal sent');
    })();
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.bridgeContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={onMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaCapturePermissionGrantType="grant"
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        style={styles.bridgeWebView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bridgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 4,
    height: 4,
    opacity: 0.05,
    zIndex: -999,
  },
  bridgeWebView: {
    width: 4,
    height: 4,
    backgroundColor: 'transparent',
  },
});
