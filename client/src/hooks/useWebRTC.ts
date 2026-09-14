import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    { urls: ['stun:relay.metered.ca:80', 'stun:relay.metered.ca:443'] },
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 2
};

interface UseWebRTCProps {
  currentUserId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  onScreenShareEnded?: () => void;
}

export function useWebRTC({ currentUserId, isMuted, isCameraOff, onScreenShareEnded }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({});

  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const makingOffer = useRef<Record<string, boolean>>({});
  const ignoreOffer = useRef<Record<string, boolean>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const screenMixContextRef = useRef<AudioContext | null>(null);
  const effectiveAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const currentUserIdRef = useRef(currentUserId);
  const onScreenShareEndedRef = useRef(onScreenShareEnded);
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const remoteScreenStreamsRef = useRef<Record<string, MediaStream>>({});

  // Keep refs in sync
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);
  useEffect(() => { onScreenShareEndedRef.current = onScreenShareEnded; }, [onScreenShareEnded]);
  useEffect(() => { remoteStreamsRef.current = remoteStreams; }, [remoteStreams]);
  useEffect(() => { remoteScreenStreamsRef.current = remoteScreenStreams; }, [remoteScreenStreams]);

  // Resume global AudioContext on user interaction
  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  // Voice activity detection helper
  const setupVoiceActivityDetection = useCallback((stream: MediaStream, userId: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) return;

      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let isSpeaking = false;
      let active = true;

      const checkVolume = () => {
        if (!active) return;

        if (!audioTracks[0] || !audioTracks[0].enabled) {
          if (isSpeaking) {
            isSpeaking = false;
            setSpeakingUsers(prev => ({ ...prev, [userId]: false }));
          }
          requestAnimationFrame(checkVolume);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const speakingNow = avg > 12;

        if (speakingNow !== isSpeaking) {
          isSpeaking = speakingNow;
          setSpeakingUsers(prev => ({ ...prev, [userId]: speakingNow }));
        }

        requestAnimationFrame(checkVolume);
      };

      requestAnimationFrame(checkVolume);

      return () => {
        active = false;
        try { source.disconnect(); } catch (_) {}
      };
    } catch (e) {
      console.warn(`[WebRTC] VAD error for ${userId}:`, e);
    }
  }, []);

  // ─── Synchronize all receiver tracks into MediaStreams for a given peer ───
  // Transceiver 0: Audio (Host voice + screen audio mix)
  // Transceiver 1: Camera Video (Host webcam -> remoteStreams)
  // Transceiver 2: Screen Share Video (High quality screen share -> remoteScreenStreams)
  const syncRemoteStream = useCallback((userId: string) => {
    const pc = peerConnections.current[userId];
    if (!pc) return;

    const transceivers = pc.getTransceivers();

    // Receiving audio transceivers: Filter for active tracks, prioritize unmuted incoming tracks
    const audioReceivers = transceivers
      .filter(t => t.receiver?.track?.kind === 'audio' && t.receiver.track.readyState !== 'ended')
      .filter(t => t.currentDirection !== 'sendonly')
      .sort((a, b) => transceivers.indexOf(a) - transceivers.indexOf(b));

    const audioTrack = audioReceivers[0]?.receiver?.track || null;

    // Receiving video transceivers: Filter for video receivers that are not sendonly
    const videoReceivers = transceivers
      .filter(t => t.receiver?.track?.kind === 'video' && t.receiver.track.readyState !== 'ended')
      .filter(t => t.currentDirection !== 'sendonly')
      .sort((a, b) => transceivers.indexOf(a) - transceivers.indexOf(b));

    // In dual-transceiver architecture:
    // videoReceivers[0] is the camera video track (transceiver 1)
    // videoReceivers[1] is the screen share video track (transceiver 2)
    let cameraTrack: MediaStreamTrack | null = null;
    let screenTrack: MediaStreamTrack | null = null;

    if (videoReceivers.length >= 2) {
      const t0 = videoReceivers[0]?.receiver?.track || null;
      const t1 = videoReceivers[1]?.receiver?.track || null;
      cameraTrack = t0;
      screenTrack = t1;
    } else if (videoReceivers.length === 1) {
      const singleTrack = videoReceivers[0]?.receiver?.track || null;
      // In single track scenarios, make it available to both or screen
      cameraTrack = singleTrack;
      screenTrack = singleTrack;
    }

    // 1. Media stream: Voice audio + camera video for VideoTile avatar dock
    const mediaTracks: MediaStreamTrack[] = [];
    if (audioTrack) mediaTracks.push(audioTrack);
    if (cameraTrack) mediaTracks.push(cameraTrack);

    if (mediaTracks.length > 0) {
      const currentStream = remoteStreamsRef.current[userId];
      const currentTrackIds = currentStream ? currentStream.getTracks().map(t => `${t.id}:${t.muted}`).sort().join(',') : '';
      const newTrackIds = mediaTracks.map(t => `${t.id}:${t.muted}`).sort().join(',');

      if (currentTrackIds !== newTrackIds) {
        console.log(`[WebRTC] syncRemoteStream (media) for ${userId}: ${mediaTracks.map(t => `${t.kind}(muted=${t.muted},id=${t.id.slice(0, 8)})`).join(', ')}`);
        setRemoteStreams(prev => ({ ...prev, [userId]: new MediaStream(mediaTracks) }));
      }

      if (audioTrack) {
        setupVoiceActivityDetection(new MediaStream([audioTrack]), userId);
      }
    }

    // 2. Screen stream: Dedicated high-resolution screen share for ScreenShareStage
    if (screenTrack) {
      const currentScreen = remoteScreenStreamsRef.current[userId];
      const currentTrack = currentScreen?.getVideoTracks()[0];
      if (!currentTrack || currentTrack.id !== screenTrack.id || currentTrack.muted !== screenTrack.muted) {
        console.log(`[WebRTC] syncRemoteStream (screen) for ${userId}: video(id=${screenTrack.id.slice(0, 8)}, muted=${screenTrack.muted})`);
        setRemoteScreenStreams(prev => ({ ...prev, [userId]: new MediaStream([screenTrack]) }));
      }
    } else {
      if (remoteScreenStreamsRef.current[userId]) {
        setRemoteScreenStreams(prev => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    }
  }, [setupVoiceActivityDetection]);

  // Sync ALL remote streams — useful when a new stage mounts and needs fresh data
  const syncAllRemoteStreams = useCallback(() => {
    for (const userId of Object.keys(peerConnections.current)) {
      syncRemoteStream(userId);
    }
  }, [syncRemoteStream]);

  // ─── SDP Bitrate Optimization Helper ───
  // Boosts SDP bandwidth limit for video (b=AS for kbps, b=TIAS for bps)
  // RFC 4566 compliant: places b= line strictly AFTER c= in each media section
  const boostSdpBitrate = (sdp: string, bitrateKbps = 4000): string => {
    try {
      const lines = sdp.split('\r\n');
      const result: string[] = [];
      let inVideoSection = false;
      let inAudioSection = false;
      let insertedVideoBandwidth = false;
      let insertedAudioBandwidth = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('m=video')) {
          inVideoSection = true;
          inAudioSection = false;
          insertedVideoBandwidth = false;
          result.push(line);
          continue;
        } else if (line.startsWith('m=audio')) {
          inAudioSection = true;
          inVideoSection = false;
          insertedAudioBandwidth = false;
          result.push(line);
          continue;
        } else if (line.startsWith('m=')) {
          inVideoSection = false;
          inAudioSection = false;
          result.push(line);
          continue;
        }

        // RFC 4566 requires b= lines to follow c= in the media description
        if (inVideoSection && line.startsWith('c=') && !insertedVideoBandwidth) {
          result.push(line);
          result.push(`b=AS:${bitrateKbps}`);
          result.push(`b=TIAS:${bitrateKbps * 1000}`);
          insertedVideoBandwidth = true;
          continue;
        }

        if (inAudioSection && line.startsWith('c=') && !insertedAudioBandwidth) {
          result.push(line);
          result.push(`b=AS:128`);
          result.push(`b=TIAS:128000`);
          insertedAudioBandwidth = true;
          continue;
        }

        if ((inVideoSection || inAudioSection) && (line.startsWith('b=AS:') || line.startsWith('b=TIAS:'))) {
          continue;
        }

        result.push(line);
      }

      return result.join('\r\n');
    } catch {
      return sdp;
    }
  };

  // ─── Replace sender tracks on all existing peer connections ───
  // Transceiver 0: Audio (Host mic + screen audio mix)
  // Transceiver 1: Camera Video (Host webcam)
  // Transceiver 2: Screen Share / Local Video (Ultra-high quality 60fps 25Mbps)
  const replaceAllSenderTracks = useCallback(async (
    audioTrack?: MediaStreamTrack | null,
    cameraTrack?: MediaStreamTrack | null,
    screenTrack?: MediaStreamTrack | null
  ) => {
    for (const pc of Object.values(peerConnections.current)) {
      const transceivers = pc.getTransceivers();
      const audioT = transceivers[0];
      const cameraT = transceivers[1];
      const screenT = transceivers[2];

      if (audioTrack !== undefined && audioT?.sender) {
        try {
          await audioT.sender.replaceTrack(audioTrack);
        } catch (e) {
          console.warn('[WebRTC] replaceTrack audio:', e);
        }
      }

      if (cameraTrack !== undefined && cameraT?.sender) {
        try {
          if (cameraTrack) cameraT.direction = 'sendrecv';
          await cameraT.sender.replaceTrack(cameraTrack);
        } catch (e) {
          console.warn('[WebRTC] replaceTrack camera:', e);
        }
      }

      if (screenTrack !== undefined && screenT?.sender) {
        try {
          if (screenTrack) {
            screenT.direction = 'sendrecv';
            await screenT.sender.replaceTrack(screenTrack);

            // Configure sender encoding parameters for adaptive screen share (4 Mbps, 60 FPS)
            const params = screenT.sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 4_000_000;
            params.encodings[0].maxFramerate = 60;
            params.encodings[0].scaleResolutionDownBy = 1.0;
            (params as any).degradationPreference = 'maintain-resolution';

            await screenT.sender.setParameters(params).catch(err => {
              console.log('[WebRTC] setParameters info on screen sender:', err);
            });
          } else {
            await screenT.sender.replaceTrack(null);
          }
        } catch (e) {
          console.warn('[WebRTC] replaceTrack screen:', e);
        }
      }
    }
  }, []);

  // ─── Initialize local microphone & webcam ───
  const startLocalMedia = useCallback(async (audio = true, video = false) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !isMuted));
        localStreamRef.current.getVideoTracks().forEach(t => (t.enabled = !isCameraOff));
        return localStreamRef.current;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
          console.warn('[WebRTC] Insecure HTTP origin detected on mobile. Redirecting to HTTPS...');
          alert('Microphone access requires HTTPS on mobile devices. Switching to HTTPS now...');
          window.location.href = window.location.href.replace('http:', 'https:');
          return null;
        }
        alert('Microphone is not supported or blocked by browser settings.');
        return null;
      }

      console.log('[WebRTC] Requesting local media devices (mic)...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false
      });

      stream.getAudioTracks().forEach(t => (t.enabled = !isMuted));

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Replace audio track and camera track on all existing PCs via replaceTrack (no renegotiation needed)
      const audioTrack = stream.getAudioTracks()[0] || null;
      const videoTrack = stream.getVideoTracks()[0] || null;
      await replaceAllSenderTracks(audioTrack, videoTrack, undefined);

      // Start voice activity detection for local user
      setupVoiceActivityDetection(stream, currentUserIdRef.current);

      console.log('[WebRTC] Local microphone stream successfully activated');
      return stream;
    } catch (err) {
      console.warn('[WebRTC] Media device access error or waiting for gesture:', err);
      return null;
    }
  }, [isMuted, isCameraOff, setupVoiceActivityDetection, replaceAllSenderTracks]);

  // Global gesture listener to unlock AudioContext & acquire mic if unmuted
  useEffect(() => {
    const handleGesture = () => {
      resumeAudioContext();
      if (!localStreamRef.current && !isMuted) {
        startLocalMedia(true, false).catch(() => {});
      }
    };

    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [resumeAudioContext, isMuted, startLocalMedia]);

  // Explicit SDP renegotiation helper
  const renegotiatePeer = useCallback(async (targetUserId: string) => {
    const pc = peerConnections.current[targetUserId];
    if (!pc) return;

    if (pc.signalingState !== 'stable' || makingOffer.current[targetUserId]) {
      console.log(`[WebRTC] Peer ${targetUserId} not stable (${pc.signalingState}), queueing renegotiation...`);
      const retryRenegotiate = () => {
        if (pc.signalingState === 'stable' && !makingOffer.current[targetUserId]) {
          pc.removeEventListener('signalingstatechange', retryRenegotiate);
          renegotiatePeer(targetUserId);
        }
      };
      pc.addEventListener('signalingstatechange', retryRenegotiate);
      setTimeout(() => {
        pc.removeEventListener('signalingstatechange', retryRenegotiate);
        if (pc.signalingState === 'stable' && !makingOffer.current[targetUserId]) {
          renegotiatePeer(targetUserId);
        }
      }, 500);
      return;
    }

    try {
      console.log(`[WebRTC] Explicit renegotiation for ${targetUserId}`);
      makingOffer.current[targetUserId] = true;
      const offer = await pc.createOffer();
      if (offer.sdp) {
        offer.sdp = boostSdpBitrate(offer.sdp, 4000);
      }
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', {
        targetUserId,
        callerUserId: currentUserIdRef.current,
        offer: pc.localDescription
      });
    } catch (err) {
      console.error(`[WebRTC] Renegotiation error for ${targetUserId}:`, err);
    } finally {
      makingOffer.current[targetUserId] = false;
    }
  }, []);

  const toggleCamera = useCallback(async (enable: boolean) => {
    if (!localStreamRef.current) {
      await startLocalMedia(true, enable);
      for (const targetUserId of Object.keys(peerConnections.current)) {
        renegotiatePeer(targetUserId);
      }
      return;
    }

    const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
    if (enable) {
      if (currentVideoTrack) {
        currentVideoTrack.enabled = true;
      } else {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
          });
          const newTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);
        } catch (err) {
          console.error('[WebRTC] Error acquiring webcam:', err);
          return;
        }
      }

      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      // Use replaceTrack + explicit renegotiation so all remote peers receive new video m-line
      const vt = localStreamRef.current.getVideoTracks()[0] || null;
      await replaceAllSenderTracks(undefined, vt, undefined);
      for (const targetUserId of Object.keys(peerConnections.current)) {
        renegotiatePeer(targetUserId);
      }
    } else {
      if (currentVideoTrack) {
        currentVideoTrack.enabled = false;
        currentVideoTrack.stop();
        localStreamRef.current.removeTrack(currentVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        await replaceAllSenderTracks(undefined, null, undefined);
        for (const targetUserId of Object.keys(peerConnections.current)) {
          renegotiatePeer(targetUserId);
        }
      }
    }
  }, [startLocalMedia, replaceAllSenderTracks, renegotiatePeer]);

  // Toggle local mute
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // ═══════════════════════════════════════════════════════════════
  // Screen Sharing
  // ═══════════════════════════════════════════════════════════════
  const stopScreenShareInternal = useCallback(async () => {
    if (screenMixContextRef.current) {
      try { screenMixContextRef.current.close(); } catch (_) {}
      screenMixContextRef.current = null;
    }

    const ss = screenStreamRef.current;
    if (ss) {
      ss.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    effectiveAudioTrackRef.current = null;

    // Restore clean microphone track to Transceiver 0; clear Transceiver 2 (screen)
    const micTrack = localStreamRef.current?.getAudioTracks()[0] || null;
    await replaceAllSenderTracks(micTrack, undefined, null);

    for (const targetUserId of Object.keys(peerConnections.current)) {
      await renegotiatePeer(targetUserId);
    }
  }, [replaceAllSenderTracks, renegotiatePeer]);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('Screen sharing is only supported on desktop browsers (Chrome, Edge, Safari, Firefox). Mobile browsers cannot capture their screen.');
        return null;
      }

      console.log('[WebRTC] Requesting getDisplayMedia with ultra-high quality constraints...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          // Request native display resolution up to 4K at 60 FPS
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 60, max: 60 }
        } as any,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2, // High-fidelity stereo system/tab audio
          sampleRate: 48000
        } as any
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);

      const screenVideoTrack = stream.getVideoTracks()[0] || null;
      const screenAudioTrack = stream.getAudioTracks()[0] || null;

      // Apply contentHint = 'detail' on screen video track to tell browser encoder to prioritize sharpness
      if (screenVideoTrack && 'contentHint' in screenVideoTrack) {
        (screenVideoTrack as any).contentHint = 'detail';
      }

      // Audio mixing: If screen capture includes system/tab audio and user also has mic,
      // mix them together so remote friends hear BOTH the host's voice AND the screen audio!
      // If no screen audio selected, keep the host's active microphone.
      const micAudioTrack = localStreamRef.current?.getAudioTracks()[0] || null;
      let effectiveAudioTrack = screenAudioTrack || micAudioTrack;

      if (screenAudioTrack && micAudioTrack) {
        try {
          if (screenMixContextRef.current) {
            try { screenMixContextRef.current.close(); } catch (_) {}
          }
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const mixCtx = new AudioCtx();
            screenMixContextRef.current = mixCtx;
            const micSource = mixCtx.createMediaStreamSource(new MediaStream([micAudioTrack]));
            const screenSource = mixCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
            const destination = mixCtx.createMediaStreamDestination();
            micSource.connect(destination);
            screenSource.connect(destination);
            effectiveAudioTrack = destination.stream.getAudioTracks()[0] || screenAudioTrack;
          }
        } catch (e) {
          console.warn('[WebRTC] Audio mixing error, falling back to screen audio:', e);
        }
      }

      effectiveAudioTrackRef.current = effectiveAudioTrack;

      console.log(`[WebRTC] Screen video track: ${screenVideoTrack?.id}, audio track: ${effectiveAudioTrack?.id} (screenAudio=${Boolean(screenAudioTrack)}, mic=${Boolean(micAudioTrack)})`);

      // Replace sender tracks on all PCs:
      // Transceiver 0: effectiveAudioTrack (Host voice + screen audio mix)
      // Transceiver 1: undefined (Host camera video is KEPT and NOT cut off!)
      // Transceiver 2: screenVideoTrack (Screen share at 10 Mbps 60fps)
      await replaceAllSenderTracks(
        effectiveAudioTrack,
        undefined,
        screenVideoTrack
      );

      // Force SDP renegotiation so remote peers negotiate transceiver 2 and start decoding immediately
      for (const targetUserId of Object.keys(peerConnections.current)) {
        await renegotiatePeer(targetUserId);
      }

      // Handle user clicking "Stop Sharing" from browser native bar
      if (screenVideoTrack) {
        screenVideoTrack.onended = async () => {
          console.log('[WebRTC] Native screen share ended event fired');
          await stopScreenShareInternal();
          onScreenShareEndedRef.current?.();
        };
      }

      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.log('[WebRTC] Screen share was cancelled by user');
      } else {
        console.warn('[WebRTC] Screen share error:', err);
      }
      return null;
    }
  }, [replaceAllSenderTracks, renegotiatePeer, stopScreenShareInternal]);

  const stopScreenShare = useCallback(async () => {
    await stopScreenShareInternal();
  }, [stopScreenShareInternal]);

  // ═══════════════════════════════════════════════════════════════
  // Custom Media Streaming (e.g. Local Video Player via captureStream)
  // ═══════════════════════════════════════════════════════════════
  const startCustomMediaStream = useCallback(async (customStream: MediaStream): Promise<boolean> => {
    try {
      console.log('[WebRTC] Starting custom media stream (local video/file stream)...');
      screenStreamRef.current = customStream;
      setScreenStream(customStream);

      const customVideoTrack = customStream.getVideoTracks()[0] || null;
      const customAudioTrack = customStream.getAudioTracks()[0] || null;

      if (customVideoTrack && 'contentHint' in customVideoTrack) {
        (customVideoTrack as any).contentHint = 'motion';
      }

      // Mix video audio with host's microphone so viewers hear both
      const micAudioTrack = localStreamRef.current?.getAudioTracks()[0] || null;
      let effectiveAudioTrack = customAudioTrack || micAudioTrack;

      if (customAudioTrack && micAudioTrack) {
        try {
          if (screenMixContextRef.current) {
            try { screenMixContextRef.current.close(); } catch (_) {}
          }
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const mixCtx = new AudioCtx();
            screenMixContextRef.current = mixCtx;
            if (mixCtx.state === 'suspended') {
              mixCtx.resume().catch(() => {});
            }
            const micSource = mixCtx.createMediaStreamSource(new MediaStream([micAudioTrack]));
            const customSource = mixCtx.createMediaStreamSource(new MediaStream([customAudioTrack]));
            const destination = mixCtx.createMediaStreamDestination();
            micSource.connect(destination);
            customSource.connect(destination);
            effectiveAudioTrack = destination.stream.getAudioTracks()[0] || customAudioTrack;
          }
        } catch (e) {
          console.warn('[WebRTC] Audio mixing error for custom stream, using file audio:', e);
        }
      }

      effectiveAudioTrackRef.current = effectiveAudioTrack;

      console.log(`[WebRTC] Custom stream video track: ${customVideoTrack?.id}, audio track: ${effectiveAudioTrack?.id}`);

      // Transceiver 0: mixed audio, Transceiver 1: camera unchanged, Transceiver 2: video track
      await replaceAllSenderTracks(
        effectiveAudioTrack,
        undefined,
        customVideoTrack
      );

      for (const targetUserId of Object.keys(peerConnections.current)) {
        await renegotiatePeer(targetUserId);
      }

      return true;
    } catch (err) {
      console.error('[WebRTC] startCustomMediaStream error:', err);
      return false;
    }
  }, [replaceAllSenderTracks, renegotiatePeer]);

  const stopCustomMediaStream = useCallback(async () => {
    console.log('[WebRTC] Stopping custom media stream...');
    await stopScreenShareInternal();
  }, [stopScreenShareInternal]);

  // ═══════════════════════════════════════════════════════════════
  // Peer Connection management with W3C Perfect Negotiation
  // ═══════════════════════════════════════════════════════════════
  const createPeerConnection = useCallback((targetUserId: string) => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    console.log(`[WebRTC] Creating new PeerConnection for ${targetUserId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetUserId] = pc;
    pendingCandidates.current[targetUserId] = [];
    makingOffer.current[targetUserId] = false;
    ignoreOffer.current[targetUserId] = false;

    // Transceivers guarantee bidirectional audio and dual video m-lines in initial SDP:
    // Transceiver 0: Audio (Host voice + screen audio mix)
    // Transceiver 1: Camera Video (Host webcam)
    // Transceiver 2: Screen Share Video (High quality screen share)
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });

    // Attach active local tracks
    const transceivers = pc.getTransceivers();
    const audioT = transceivers[0];
    const cameraT = transceivers[1];
    const screenT = transceivers[2];

    const audioTrack = effectiveAudioTrackRef.current || localStreamRef.current?.getAudioTracks()[0] || null;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null;

    if (audioTrack && audioT?.sender) {
      audioT.direction = 'sendrecv';
      audioT.sender.replaceTrack(audioTrack).catch(() => {});
    }
    if (cameraTrack && cameraT?.sender) {
      cameraT.direction = 'sendrecv';
      cameraT.sender.replaceTrack(cameraTrack).catch(() => {});
    }
    if (screenTrack && screenT?.sender) {
      screenT.direction = 'sendrecv';
      screenT.sender.replaceTrack(screenTrack).catch(() => {});
      const params = screenT.sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = 4_000_000;
      params.encodings[0].maxFramerate = 60;
      params.encodings[0].scaleResolutionDownBy = 1.0;
      (params as any).degradationPreference = 'maintain-resolution';
      screenT.sender.setParameters(params).catch(() => {});
    }

    // Perfect Negotiation: Polite peer has lexicographically higher userId
    const isPolite = currentUserIdRef.current.localeCompare(targetUserId) > 0;

    // ──── onnegotiationneeded: THE SOLE place offers are created ────
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable' || makingOffer.current[targetUserId]) {
        console.log(`[WebRTC] onnegotiationneeded skipped: signalingState=${pc.signalingState}, makingOffer=${makingOffer.current[targetUserId]}`);
        return;
      }
      try {
        console.log(`[WebRTC] onnegotiationneeded for ${targetUserId}, signalingState=${pc.signalingState}`);
        makingOffer.current[targetUserId] = true;
        const offer = await pc.createOffer();
        if (offer.sdp) {
          offer.sdp = boostSdpBitrate(offer.sdp, 4000);
        }
        await pc.setLocalDescription(offer);
        console.log(`[WebRTC] Sending offer to ${targetUserId}`);
        socket.emit('webrtc-offer', {
          targetUserId,
          callerUserId: currentUserIdRef.current,
          offer: pc.localDescription
        });
      } catch (err) {
        console.error(`[WebRTC] onnegotiationneeded error with ${targetUserId}:`, err);
      } finally {
        makingOffer.current[targetUserId] = false;
      }
    };

    // ──── ontrack: Receive remote media ────
    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack from ${targetUserId}: kind=${event.track.kind}, id=${event.track.id}, muted=${event.track.muted}`);
      syncRemoteStream(targetUserId);

      event.track.onunmute = () => {
        console.log(`[WebRTC] track.onunmute from ${targetUserId}: ${event.track.kind}`);
        syncRemoteStream(targetUserId);
      };

      event.track.onended = () => {
        console.log(`[WebRTC] track.onended from ${targetUserId}: ${event.track.kind}`);
        syncRemoteStream(targetUserId);
      };
    };

    // ──── ICE candidates ────
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state with ${targetUserId}: ${pc.iceConnectionState}`);
    };

    // ──── Connection state changes ────
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        syncRemoteStream(targetUserId);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
        setSpeakingUsers(prev => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
      }
    };

    return pc;
  }, [syncRemoteStream]);

  // Flush queued candidates once remote description is set
  const processPendingCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current[userId];
    if (queue && queue.length > 0) {
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Error adding pending ICE candidate:', e);
        }
      }
      pendingCandidates.current[userId] = [];
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Socket signaling listener
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleOffer = async ({ callerUserId, offer }: { callerUserId: string; offer: any }) => {
      console.log(`[WebRTC] Received offer from ${callerUserId}, type=${offer?.type}`);

      const pc = createPeerConnection(callerUserId);
      const isPolite = currentUserIdRef.current.localeCompare(callerUserId) > 0;
      const offerCollision = makingOffer.current[callerUserId] || pc.signalingState !== 'stable';

      ignoreOffer.current[callerUserId] = !isPolite && offerCollision;
      if (ignoreOffer.current[callerUserId]) {
        console.log(`[WebRTC] Glare: impolite peer ignoring offer from ${callerUserId}`);
        return;
      }

      try {
        if (offerCollision && isPolite) {
          console.log(`[WebRTC] Glare: polite peer rolling back for ${callerUserId}`);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processPendingCandidates(callerUserId, pc);

        // Attach local tracks to transceivers
        const transceivers = pc.getTransceivers();
        const audioT = transceivers[0];
        const cameraT = transceivers[1];
        const screenT = transceivers[2];

        const audioTrack = effectiveAudioTrackRef.current || localStreamRef.current?.getAudioTracks()[0] || null;
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null;

        if (audioTrack && audioT?.sender) {
          audioT.direction = 'sendrecv';
          if (audioT.sender.track?.id !== audioTrack.id) {
            await audioT.sender.replaceTrack(audioTrack).catch(() => {});
          }
        }
        if (cameraTrack && cameraT?.sender) {
          cameraT.direction = 'sendrecv';
          if (cameraT.sender.track?.id !== cameraTrack.id) {
            await cameraT.sender.replaceTrack(cameraTrack).catch(() => {});
          }
        }
        if (screenTrack && screenT?.sender) {
          screenT.direction = 'sendrecv';
          if (screenT.sender.track?.id !== screenTrack.id) {
            await screenT.sender.replaceTrack(screenTrack).catch(() => {});
            const params = screenT.sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 4_000_000;
            params.encodings[0].maxFramerate = 60;
            params.encodings[0].scaleResolutionDownBy = 1.0;
            (params as any).degradationPreference = 'maintain-resolution';
            await screenT.sender.setParameters(params).catch(() => {});
          }
        } else if (screenT) {
          // If this peer is not sharing screen, ensure direction allows receiving remote screen
          if (screenT.direction !== 'recvonly' && screenT.direction !== 'sendrecv') {
            screenT.direction = 'recvonly';
          }
        }

        const answer = await pc.createAnswer();
        if (answer.sdp) {
          answer.sdp = boostSdpBitrate(answer.sdp, 4000);
        }
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          targetUserId: callerUserId,
          answer: pc.localDescription
        });

        console.log(`[WebRTC] Sent answer to ${callerUserId}`);
        syncRemoteStream(callerUserId);
      } catch (err) {
        console.error(`[WebRTC] Error handling offer from ${callerUserId}:`, err);
      }
    };

    const handleAnswer = async ({ responderUserId, answer }: { responderUserId: string; answer: any }) => {
      console.log(`[WebRTC] Received answer from ${responderUserId}`);
      const pc = peerConnections.current[responderUserId];
      if (!pc) return;

      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processPendingCandidates(responderUserId, pc);
          syncRemoteStream(responderUserId);
        } else {
          console.warn(`[WebRTC] Ignoring answer from ${responderUserId}: signalingState=${pc.signalingState}`);
        }
      } catch (err) {
        console.error(`[WebRTC] Error handling answer from ${responderUserId}:`, err);
      }
    };

    const handleCandidate = async ({ senderUserId, candidate }: { senderUserId: string; candidate: any }) => {
      const pc = peerConnections.current[senderUserId];
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Failed to add ICE candidate:', e);
        }
      } else {
        if (!pendingCandidates.current[senderUserId]) {
          pendingCandidates.current[senderUserId] = [];
        }
        pendingCandidates.current[senderUserId].push(candidate);
      }
    };

    const handleUserLeft = ({ userId }: { userId: string }) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }
      delete pendingCandidates.current[userId];
      delete makingOffer.current[userId];
      delete ignoreOffer.current[userId];
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRemoteScreenStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setSpeakingUsers(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleRequestRenegotiate = async ({ requesterUserId }: { requesterUserId: string }) => {
      console.log(`[WebRTC] Received renegotiation request from ${requesterUserId}`);
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null;
      const audioTrack = effectiveAudioTrackRef.current || localStreamRef.current?.getAudioTracks()[0] || null;
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;

      const pc = peerConnections.current[requesterUserId] || createPeerConnection(requesterUserId);
      if (pc) {
        const transceivers = pc.getTransceivers();
        if (transceivers[0]?.sender && audioTrack) {
          await transceivers[0].sender.replaceTrack(audioTrack).catch(() => {});
        }
        if (transceivers[1]?.sender && cameraTrack) {
          await transceivers[1].sender.replaceTrack(cameraTrack).catch(() => {});
        }
        if (transceivers[2]?.sender && screenTrack) {
          transceivers[2].direction = 'sendrecv';
          await transceivers[2].sender.replaceTrack(screenTrack).catch(() => {});
        }
        await renegotiatePeer(requesterUserId);
      }
    };

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleCandidate);
    socket.on('webrtc-request-renegotiate', handleRequestRenegotiate);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleCandidate);
      socket.off('webrtc-request-renegotiate', handleRequestRenegotiate);
      socket.off('user-left', handleUserLeft);
    };
  }, [createPeerConnection, processPendingCandidates, syncRemoteStream, renegotiatePeer]);

  // ═══════════════════════════════════════════════════════════════
  // Call peer (initiator) — just creates PeerConnection.
  // onnegotiationneeded fires automatically from addTransceiver and handles the offer.
  // ═══════════════════════════════════════════════════════════════
  const callPeer = useCallback(async (targetUserId: string) => {
    console.log(`[WebRTC] callPeer: ${targetUserId}`);
    createPeerConnection(targetUserId);
    // The PeerConnection creation adds transceivers and attaches tracks,
    // which triggers onnegotiationneeded → automatic offer creation.
  }, [createPeerConnection]);

  // ─── Clean up ONLY on unmount ───
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenMixContextRef.current) {
        try { screenMixContextRef.current.close(); } catch (_) {}
        screenMixContextRef.current = null;
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    speakingUsers,
    startLocalMedia,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    startCustomMediaStream,
    stopCustomMediaStream,
    callPeer,
    syncAllRemoteStreams
  };
}
