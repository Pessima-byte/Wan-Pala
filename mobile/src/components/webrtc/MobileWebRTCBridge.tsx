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

  // Keep room users list synced into the WebView
  useEffect(() => {
    if (room?.users) {
      postToWebView({
        type: 'USERS_UPDATE',
        users: room.users,
      });
    }
  }, [room?.users, postToWebView]);

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
        console.log(`[MobileWebRTCBridge] User joined: ${data.user.name} (${data.user.id}), calling peer...`);
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
        if (room?.users) {
          postToWebView({ type: 'USERS_UPDATE', users: room.users });
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
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WAN PALA Video & Audio Engine</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #tiles-scroll {
      display: flex;
      flex-direction: row;
      align-items: center;
      overflow-x: auto;
      overflow-y: hidden;
      gap: 10px;
      height: 88px;
      padding: 2px 4px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    #tiles-scroll::-webkit-scrollbar {
      display: none;
    }
    .tile-card {
      flex-shrink: 0;
      width: 82px;
      height: 82px;
      border-radius: 18px;
      background: #0c131d;
      border: 2px solid #10b981;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
      position: relative;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .tile-card.speaking {
      border-color: #34d399;
      box-shadow: 0 0 14px rgba(52, 211, 153, 0.8);
    }
    .tile-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      top: 0;
      left: 0;
      border-radius: 16px;
      z-index: 1;
    }
    .tile-video.self {
      transform: scaleX(-1);
    }
    .avatar-circle {
      width: 50px;
      height: 50px;
      border-radius: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      z-index: 1;
    }
    .speaker-badge {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 20px;
      height: 20px;
      border-radius: 10px;
      background: rgba(16, 185, 129, 0.25);
      border: 1px solid rgba(16, 185, 129, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3;
    }
    .speaker-badge.muted {
      background: rgba(239, 68, 68, 0.25);
      border-color: rgba(239, 68, 68, 0.5);
    }
    .name-badge {
      position: absolute;
      bottom: 4px;
      left: 4px;
      right: 4px;
      background: rgba(9, 13, 11, 0.85);
      border-radius: 6px;
      padding: 2px 4px;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      z-index: 3;
      letter-spacing: 0.2px;
    }
    #audio-container {
      position: absolute;
      top: -100px;
      left: -100px;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="tiles-scroll"></div>
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
      let usersMap = {};
      let speakingMap = {};

      let localStream = null;
      let globalAudioCtx = null;
      const peerConnections = {};
      const pendingCandidates = {};
      const audioElements = {};
      const remoteVideoStreams = {};
      const makingOffer = {};

      const micIconSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
      const micOffIconSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';

      function postToRN(type, message, payload, event) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: type,
            message: message,
            event: event,
            payload: payload
          }));
        }
      }

      function log(msg) {
        postToRN('LOG', msg, null, null);
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
              speakingMap[userId] = speakingNow;
              updateSpeakingBorder(userId, speakingNow);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SPEAKING_UPDATE',
                  userId: userId,
                  isSpeaking: speakingNow
                }));
              }
            }
          }, 150);
        } catch (e) {}
      }

      function updateSpeakingBorder(userId, speaking) {
        const tile = document.getElementById('tile-' + userId);
        if (tile) {
          if (speaking) {
            tile.classList.add('speaking');
          } else {
            tile.classList.remove('speaking');
          }
        }
      }

      function getMediaStream(constraints) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          return navigator.mediaDevices.getUserMedia(constraints);
        }
        return new Promise(function(resolve, reject) {
          const legacyGUM = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
          if (!legacyGUM) {
            return reject(new Error('getUserMedia not supported in this WebView'));
          }
          legacyGUM.call(navigator, constraints, resolve, reject);
        });
      }

      async function initMedia(includeVideo) {
        try {
          log('initMedia: requesting audio=true, video=' + includeVideo);
          const constraints = {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: includeVideo ? {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 }
            } : false
          };

          const stream = await getMediaStream(constraints);
          localStream = stream;

          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];

          if (audioTrack) {
            audioTrack.enabled = !isMuted;
          }
          if (videoTrack) {
            videoTrack.enabled = !isCameraOff;
          }

          // Attach to transceivers across all peer connections
          for (const targetId in peerConnections) {
            const pc = peerConnections[targetId];
            const transceivers = pc.getTransceivers();
            if (audioTrack && transceivers[0]?.sender) {
              await transceivers[0].sender.replaceTrack(audioTrack).catch(function(e) {});
            }
            if (transceivers[1]?.sender) {
              await transceivers[1].sender.replaceTrack(videoTrack || null).catch(function(e) {});
            }
          }

          // Setup voice detection for self
          try {
            const ctx = getAudioContext();
            if (ctx && audioTrack) {
              const selfSrc = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
              setupVAD(selfSrc, currentUserId);
            }
          } catch(e) {}

          renderTiles();
          log('initMedia: media stream successfully attached!');
          return stream;
        } catch (err) {
          log('initMedia error: ' + err.message);
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

        // Attach local tracks if available
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          const videoTrack = localStream.getVideoTracks()[0];
          const transceivers = pc.getTransceivers();
          if (audioTrack && transceivers[0]?.sender) {
            transceivers[0].sender.replaceTrack(audioTrack).catch(function() {});
          }
          if (videoTrack && transceivers[1]?.sender && !isCameraOff) {
            transceivers[1].sender.replaceTrack(videoTrack).catch(function() {});
          }
        }

        pc.onicecandidate = function(event) {
          if (event.candidate) {
            postToRN('SIGNAL_OUT', null, {
              targetUserId: targetUserId,
              candidate: event.candidate
            }, 'webrtc-ice-candidate');
          }
        };

        pc.ontrack = function(event) {
          log('ontrack from ' + targetUserId + ': ' + event.track.kind + ' (id: ' + event.track.id + ')');
          if (event.track.kind === 'audio') {
            // 1. Play using HTMLAudioElement
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
            audioEl.play().catch(function(e) {});

            // 2. Play using Web Audio AudioContext (bypasses iOS autoplay policies on WKWebView)
            try {
              const ctx = getAudioContext();
              if (ctx) {
                const srcNode = ctx.createMediaStreamSource(new MediaStream([event.track]));
                srcNode.connect(ctx.destination);
                setupVAD(srcNode, targetUserId);
                log('WebAudio destination connected for peer ' + targetUserId);
              }
            } catch (e) {}

          } else if (event.track.kind === 'video') {
            log('Remote video track received from ' + targetUserId);
            remoteVideoStreams[targetUserId] = new MediaStream([event.track]);
            renderTiles();
          }
        };

        return pc;
      }

      async function callPeer(targetUserId) {
        log('Initiating call to peer ' + targetUserId);
        const pc = getOrCreatePeer(targetUserId);

        if (!localStream) {
          await initMedia(!isCameraOff);
        }

        if (pc.signalingState !== 'stable' || makingOffer[targetUserId]) {
          log('callPeer: Peer ' + targetUserId + ' busy (' + pc.signalingState + ')');
          return;
        }

        try {
          makingOffer[targetUserId] = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          postToRN('SIGNAL_OUT', null, {
            targetUserId: targetUserId,
            callerUserId: currentUserId,
            offer: pc.localDescription
          }, 'webrtc-offer');
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

        if (!localStream) {
          initMedia(!isCameraOff).catch(function() {});
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

          postToRN('SIGNAL_OUT', null, {
            targetUserId: callerUserId,
            answer: pc.localDescription
          }, 'webrtc-answer');
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

      // ─── Render Participant Tiles Bar ───
      function renderTiles() {
        const container = document.getElementById('tiles-scroll');
        if (!container) return;

        // Ensure self is in usersMap
        if (!usersMap[currentUserId]) {
          usersMap[currentUserId] = {
            id: currentUserId,
            name: 'You',
            avatar: '📱',
            color: '#10b981',
            isMuted: isMuted,
            isCameraOff: isCameraOff
          };
        }

        const userIds = Object.keys(usersMap);
        // Put self first
        userIds.sort(function(a, b) {
          if (a === currentUserId) return -1;
          if (b === currentUserId) return 1;
          return 0;
        });

        userIds.forEach(function(uid) {
          const user = usersMap[uid] || {};
          const isMe = uid === currentUserId;
          const uMuted = isMe ? isMuted : Boolean(user.isMuted);
          const uCamOff = isMe ? isCameraOff : Boolean(user.isCameraOff);
          const isSpeaking = Boolean(speakingMap[uid]);

          let tile = document.getElementById('tile-' + uid);
          if (!tile) {
            tile = document.createElement('div');
            tile.id = 'tile-' + uid;
            tile.className = 'tile-card' + (isSpeaking ? ' speaking' : '');
            tile.innerHTML = [
              '<div class="speaker-badge' + (uMuted ? ' muted' : '') + '" id="badge-' + uid + '">',
              uMuted ? micOffIconSvg : micIconSvg,
              '</div>',
              '<video id="video-' + uid + '" class="tile-video' + (isMe ? ' self' : '') + '" autoplay playsinline' + (isMe ? ' muted' : '') + ' style="display:none;"></video>',
              '<div id="avatar-' + uid + '" class="avatar-circle" style="background:' + (user.color || '#3b82f6') + '35;">',
              user.avatar || (isMe ? '📱' : '🐱'),
              '</div>',
              '<div class="name-badge">' + (user.name || 'Guest') + (isMe ? ' (You)' : '') + '</div>'
            ].join('');
            container.appendChild(tile);
          } else {
            // Update classes & state
            tile.className = 'tile-card' + (isSpeaking ? ' speaking' : '');
            const badge = document.getElementById('badge-' + uid);
            if (badge) {
              badge.className = 'speaker-badge' + (uMuted ? ' muted' : '');
              badge.innerHTML = uMuted ? micOffIconSvg : micIconSvg;
            }
          }

          const videoEl = document.getElementById('video-' + uid);
          const avatarEl = document.getElementById('avatar-' + uid);

          if (!uCamOff) {
            // Camera is ON -> attach stream and show video
            const streamToPlay = isMe ? localStream : remoteVideoStreams[uid];
            if (videoEl) {
              if (streamToPlay && streamToPlay.getVideoTracks().length > 0) {
                if (videoEl.srcObject !== streamToPlay) {
                  videoEl.srcObject = streamToPlay;
                }
                videoEl.style.display = 'block';
                videoEl.play().catch(function() {});
                if (avatarEl) avatarEl.style.display = 'none';
              } else {
                videoEl.style.display = 'none';
                if (avatarEl) avatarEl.style.display = 'flex';
              }
            }
          } else {
            // Camera is OFF -> show avatar circle
            if (videoEl) videoEl.style.display = 'none';
            if (avatarEl) avatarEl.style.display = 'flex';
          }
        });

        // Clean up removed users
        const currentTileNodes = container.querySelectorAll('.tile-card');
        currentTileNodes.forEach(function(node) {
          const uid = node.id.replace('tile-', '');
          if (!usersMap[uid]) {
            node.remove();
          }
        });
      }

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
            const prevCamOff = isCameraOff;
            currentUserId = d.currentUserId || currentUserId;
            isMuted = d.isMuted;
            isCameraOff = d.isCameraOff;

            if (usersMap[currentUserId]) {
              usersMap[currentUserId].isMuted = isMuted;
              usersMap[currentUserId].isCameraOff = isCameraOff;
            }

            // If camera state toggled
            if (prevCamOff !== isCameraOff) {
              log('Camera toggled: isCameraOff=' + isCameraOff);
              if (!isCameraOff) {
                // Camera ON
                await initMedia(true);
                // Renegotiate with all peers to stream video
                for (const targetId in peerConnections) {
                  callPeer(targetId);
                }
              } else {
                // Camera OFF
                if (localStream) {
                  localStream.getVideoTracks().forEach(function(t) {
                    t.enabled = false;
                    t.stop();
                  });
                }
                for (const targetId in peerConnections) {
                  const pc = peerConnections[targetId];
                  const transceivers = pc.getTransceivers();
                  if (transceivers[1]?.sender) {
                    await transceivers[1].sender.replaceTrack(null).catch(function() {});
                  }
                  callPeer(targetId);
                }
                renderTiles();
              }
            } else if (localStream) {
              localStream.getAudioTracks().forEach(function(t) {
                t.enabled = !isMuted;
              });
              renderTiles();
            } else if (!isMuted) {
              await initMedia(false);
            } else {
              renderTiles();
            }

          } else if (msg.type === 'USERS_UPDATE') {
            usersMap = msg.users || {};
            renderTiles();

          } else if (msg.type === 'USER_LEFT') {
            const uid = msg.userId;
            delete usersMap[uid];
            delete remoteVideoStreams[uid];
            if (peerConnections[uid]) {
              peerConnections[uid].close();
              delete peerConnections[uid];
            }
            if (audioElements[uid]) {
              audioElements[uid].remove();
              delete audioElements[uid];
            }
            renderTiles();
          }
        } catch (err) {
          log('window message error: ' + err.message);
        }
      });

      // Announce ready to React Native container
      postToRN('READY', 'Engine ready', null, null);
      log('Engine initialized, isSecureContext=' + window.isSecureContext);
      renderTiles();
    })();
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.tilesContainerWrapper}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://localhost' }}
        onMessage={onMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaCapturePermissionGrantType="grant"
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        style={styles.tilesWebView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  tilesContainerWrapper: {
    width: '100%',
    height: 88,
    overflow: 'hidden',
  },
  tilesWebView: {
    width: '100%',
    height: 88,
    backgroundColor: 'transparent',
  },
});
