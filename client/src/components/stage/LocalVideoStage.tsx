import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useRoom } from '../../context/RoomContext';
import { socket } from '../../socket';
import { Upload, Film, Play, Pause, Maximize2, Minimize2, Volume2, VolumeX, Radio, Sparkles, RefreshCw } from 'lucide-react';

export const LocalVideoStage: React.FC = () => {
  const {
    room,
    sendMediaAction,
    currentUser,
    startCustomMediaStream,
    stopCustomMediaStream,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    syncAllRemoteStreams
  } = useRoom();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastAssignedTrackId = useRef<string | null>(null);

  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRemotePlaying, setIsRemotePlaying] = useState(false);
  const isUpdating = useRef(false);

  const mediaState = room?.mediaState;

  // Sync remote streams on mount and periodically if waiting for stream
  useEffect(() => {
    syncAllRemoteStreams();
    const timer = setInterval(() => {
      syncAllRemoteStreams();
    }, 2000);
    return () => clearInterval(timer);
  }, [syncAllRemoteStreams]);

  // Identify presenter/streamer (someone actively broadcasting)
  const presenterUser = useMemo(() => {
    // If the room state specifies a screenSharingUserId who isn't self
    if (room?.mediaState?.screenSharingUserId && room.users[room.mediaState.screenSharingUserId] && room.mediaState.screenSharingUserId !== currentUser.id) {
      return room.users[room.mediaState.screenSharingUserId];
    }
    // Or any other user marked as isScreenSharing
    const sharingUser = Object.values(room?.users || {}).find(u => u.isScreenSharing && u.id !== currentUser.id);
    if (sharingUser) return sharingUser;

    return undefined;
  }, [room?.mediaState?.screenSharingUserId, room?.users, currentUser.id]);

  const isSelfPresenting = Boolean(localFileUrl);
  const presenterId = isSelfPresenting ? currentUser.id : presenterUser?.id;
  const presenter = isSelfPresenting ? currentUser : presenterUser;

  // Active stream for remote viewers (screen stream carries video)
  const viewerStream = useMemo(() => {
    if (isSelfPresenting) return null;
    if (presenterId) {
      if (remoteScreenStreams?.[presenterId]?.getVideoTracks().length) {
        return remoteScreenStreams[presenterId];
      }
      if (remoteStreams[presenterId]?.getVideoTracks().length) {
        return remoteStreams[presenterId];
      }
    }
    // Fallback: check any remoteScreenStreams with video tracks
    for (const stream of Object.values(remoteScreenStreams || {})) {
      if (stream.getVideoTracks().length > 0) return stream;
    }
    // Fallback: check any remoteStreams with video tracks from other users
    for (const [uid, stream] of Object.entries(remoteStreams || {})) {
      if (uid !== currentUser.id && stream.getVideoTracks().length > 0) return stream;
    }
    return remoteScreenStreams?.[presenterId || ''] || remoteStreams[presenterId || ''] || null;
  }, [isSelfPresenting, presenterId, remoteScreenStreams, remoteStreams, currentUser.id]);

  // Remote audio stream (may come from remoteStreams or viewerStream)
  const viewerAudioStream = useMemo(() => {
    if (isSelfPresenting) return null;
    if (presenterId && remoteStreams[presenterId]?.getAudioTracks().length > 0) {
      return remoteStreams[presenterId];
    }
    if (viewerStream && viewerStream.getAudioTracks().length > 0) {
      return viewerStream;
    }
    for (const [uid, stream] of Object.entries(remoteStreams || {})) {
      if (uid !== currentUser.id && stream.getAudioTracks().length > 0) return stream;
    }
    return null;
  }, [isSelfPresenting, presenterId, remoteStreams, viewerStream, currentUser.id]);

  const hasViewerVideoTrack = Boolean(
    viewerStream &&
    viewerStream.getVideoTracks().length > 0
  );

  const hasViewerAudioTrack = Boolean(
    viewerAudioStream &&
    viewerAudioStream.getAudioTracks().length > 0
  );

  // Request renegotiation from presenter if stream is not ready after mounting
  useEffect(() => {
    if (!isSelfPresenting && presenterId) {
      syncAllRemoteStreams();
      const retryTimer = setTimeout(() => {
        if (!viewerStream || !viewerStream.getVideoTracks().length) {
          console.log(`[LocalVideoStage] Requesting screen/video renegotiation from ${presenterId}`);
          socket.emit('webrtc-request-renegotiate', { targetUserId: presenterId });
          syncAllRemoteStreams();
        }
      }, 1200);
      return () => clearTimeout(retryTimer);
    }
  }, [isSelfPresenting, presenterId, viewerStream, syncAllRemoteStreams]);

  // When host selects a file, clear any lingering srcObject, set URL, and broadcast
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const url = URL.createObjectURL(file);
    setLocalFileUrl(url);
    setFileName(file.name);

    sendMediaAction('set-media', {
      url: file.name,
      title: file.name,
      appType: 'localvideo'
    });

    socket.emit('update-user-state', { isScreenSharing: true });
    socket.emit('set-active-app', { appType: 'localvideo' });
  };

  // Explicitly ensure srcObject is null on host video when localFileUrl is set
  useEffect(() => {
    if (localFileUrl && videoRef.current) {
      if (videoRef.current.srcObject !== null) {
        videoRef.current.srcObject = null;
      }
    }
  }, [localFileUrl]);

  // Capture stream from video element (with canvas fallback to prevent hardware acceleration black frames)
  const captureAndBroadcast = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !localFileUrl || isBroadcasting) return;

    try {
      let capturedStream: MediaStream | null = null;
      let rawAudioTrack: MediaStreamTrack | null = null;

      // Extract raw audio track if available from video captureStream
      try {
        if (typeof (video as any).captureStream === 'function') {
          const directStream = (video as any).captureStream();
          if (directStream && directStream.getAudioTracks().length > 0) {
            rawAudioTrack = directStream.getAudioTracks()[0];
          }
        } else if (typeof (video as any).mozCaptureStream === 'function') {
          const directStream = (video as any).mozCaptureStream();
          if (directStream && directStream.getAudioTracks().length > 0) {
            rawAudioTrack = directStream.getAudioTracks()[0];
          }
        }
      } catch (audioErr) {
        console.warn('[LocalVideoStage] Direct audio capture warning:', audioErr);
      }

      // First attempt native captureStream
      if (typeof (video as any).captureStream === 'function') {
        try {
          capturedStream = (video as any).captureStream(30);
        } catch (_) {}
      } else if (typeof (video as any).mozCaptureStream === 'function') {
        try {
          capturedStream = (video as any).mozCaptureStream(30);
        } catch (_) {}
      }

      // If captureStream fails or outputs black frame on hardware decoders, use offscreen canvas capture
      if (!capturedStream || capturedStream.getVideoTracks().length === 0) {
        console.log('[LocalVideoStage] Using Canvas captureStream fallback for video decoding...');
        const canvas = canvasRef.current || document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d', { alpha: false });

        const drawLoop = () => {
          if (!video.paused && !video.ended && ctx) {
            if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          animFrameIdRef.current = requestAnimationFrame(drawLoop);
        };
        drawLoop();

        const canvasStream = canvas.captureStream(30);
        const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
        if (rawAudioTrack) tracks.push(rawAudioTrack);
        capturedStream = new MediaStream(tracks);
      } else if (rawAudioTrack && capturedStream.getAudioTracks().length === 0) {
        capturedStream.addTrack(rawAudioTrack);
      }

      if (capturedStream && capturedStream.getVideoTracks().length > 0) {
        console.log('[LocalVideoStage] Successfully prepared MediaStream for broadcast:', capturedStream.id);
        const success = await startCustomMediaStream(capturedStream);
        if (success) {
          setIsBroadcasting(true);
          console.log('[LocalVideoStage] P2P Ultra-HD video stream broadcast started!');
        }
      }
    } catch (err) {
      console.warn('[LocalVideoStage] captureStream error:', err);
    }
  }, [localFileUrl, isBroadcasting, startCustomMediaStream]);

  // Trigger capture stream when video begins playback or has loaded data
  useEffect(() => {
    if (localFileUrl && videoRef.current && !isBroadcasting) {
      const v = videoRef.current;
      const onReady = () => {
        captureAndBroadcast();
      };
      v.addEventListener('loadeddata', onReady);
      v.addEventListener('canplay', onReady);
      v.addEventListener('playing', onReady);
      if (v.readyState >= 2) {
        onReady();
      }
      return () => {
        v.removeEventListener('loadeddata', onReady);
        v.removeEventListener('canplay', onReady);
        v.removeEventListener('playing', onReady);
      };
    }
  }, [localFileUrl, isBroadcasting, captureAndBroadcast]);

  // Clean up broadcast and canvas animation on unmount if host
  useEffect(() => {
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (isBroadcasting) {
        stopCustomMediaStream();
        socket.emit('update-user-state', { isScreenSharing: false });
      }
    };
  }, [isBroadcasting, stopCustomMediaStream]);

  // Callback ref for remote viewer video element
  const setRemoteVideoRef = useCallback((node: HTMLVideoElement | null) => {
    remoteVideoRef.current = node;
    if (node && viewerStream) {
      node.defaultMuted = true;
      node.muted = true;
      node.playsInline = true;
      const videoTrack = viewerStream.getVideoTracks()[0];
      const trackId = videoTrack ? videoTrack.id : null;
      
      // CRITICAL FIX: Only assign srcObject if it is missing or track changed.
      // Do NOT reassign on every 2-second stream poll, which causes WebKit/Safari to abort video playback!
      if (!node.srcObject || lastAssignedTrackId.current !== trackId) {
        node.srcObject = viewerStream;
        lastAssignedTrackId.current = trackId;
      }
      node.play().then(() => setIsRemotePlaying(true)).catch(err => {
        console.warn('[LocalVideoStage] Viewer video play waiting for interaction:', err);
        setIsRemotePlaying(false);
      });
    }
  }, [viewerStream]);

  // Re-bind remote viewer video when viewerStream updates (with strict track ID deduplication)
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && viewerStream) {
      videoEl.defaultMuted = true;
      videoEl.muted = true;
      videoEl.playsInline = true;

      const videoTrack = viewerStream.getVideoTracks()[0];
      const trackId = videoTrack ? videoTrack.id : null;

      if (!videoEl.srcObject || lastAssignedTrackId.current !== trackId) {
        videoEl.srcObject = viewerStream;
        lastAssignedTrackId.current = trackId;
        videoEl.play().then(() => setIsRemotePlaying(true)).catch(() => {});
      }

      const onTrackChange = () => {
        const currentTrack = viewerStream.getVideoTracks()[0];
        const newTrackId = currentTrack ? currentTrack.id : null;
        if (!videoEl.srcObject || lastAssignedTrackId.current !== newTrackId) {
          videoEl.srcObject = viewerStream;
          lastAssignedTrackId.current = newTrackId;
        }
        videoEl.play().then(() => setIsRemotePlaying(true)).catch(() => {});
      };

      const handlePlaying = () => setIsRemotePlaying(true);
      const handlePause = () => setIsRemotePlaying(false);

      videoEl.addEventListener('playing', handlePlaying);
      videoEl.addEventListener('pause', handlePause);
      videoEl.addEventListener('loadeddata', onTrackChange);
      videoEl.addEventListener('canplay', onTrackChange);
      viewerStream.addEventListener('addtrack', onTrackChange);
      viewerStream.addEventListener('removetrack', onTrackChange);

      const tracks = viewerStream.getVideoTracks();
      tracks.forEach(track => {
        track.addEventListener('unmute', onTrackChange);
      });

      return () => {
        videoEl.removeEventListener('playing', handlePlaying);
        videoEl.removeEventListener('pause', handlePause);
        videoEl.removeEventListener('loadeddata', onTrackChange);
        videoEl.removeEventListener('canplay', onTrackChange);
        viewerStream.removeEventListener('addtrack', onTrackChange);
        viewerStream.removeEventListener('removetrack', onTrackChange);
        tracks.forEach(track => {
          track.removeEventListener('unmute', onTrackChange);
        });
      };
    }
  }, [viewerStream]);

  // Dedicated audio playback for remote viewers
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!isSelfPresenting && audioEl && viewerAudioStream && hasViewerAudioTrack) {
      if (audioEl.srcObject !== viewerAudioStream) {
        audioEl.srcObject = viewerAudioStream;
      }
      audioEl.muted = isAudioMuted;
      audioEl.play().catch(e => console.warn('[LocalVideoStage] Viewer audio blocked:', e));
    }
  }, [viewerAudioStream, isSelfPresenting, hasViewerAudioTrack, isAudioMuted]);

  // Sync play/pause/seek from socket ONLY for non-broadcasting peers who loaded the file locally
  useEffect(() => {
    // If this user is actively broadcasting the file locally (isSelfPresenting),
    // they are the master source of truth. DO NOT let incoming socket echoes override the host video!
    if (isSelfPresenting || !videoRef.current || !mediaState || isUpdating.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return; // Prevent stalling when video has not loaded metadata

    isUpdating.current = true;
    try {
      if (mediaState.playing && video.paused) {
        video.play().catch(() => {});
      } else if (!mediaState.playing && !video.paused) {
        video.pause();
      }

      if (Math.abs(video.currentTime - mediaState.currentTime) > 2.0) {
        video.currentTime = mediaState.currentTime;
      }
    } finally {
      setTimeout(() => {
        isUpdating.current = false;
      }, 150);
    }
  }, [mediaState, isSelfPresenting]);

  const handlePlay = () => {
    if (isUpdating.current || !videoRef.current) return;
    sendMediaAction('play', { currentTime: videoRef.current.currentTime });
  };

  const handlePause = () => {
    if (isUpdating.current || !videoRef.current) return;
    sendMediaAction('pause', { currentTime: videoRef.current.currentTime });
  };

  const handleSeek = () => {
    if (isUpdating.current || !videoRef.current) return;
    sendMediaAction('seek', { currentTime: videoRef.current.currentTime });
  };

  // Fullscreen toggle with cross-browser and iOS fallback
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current as any;
    if (!el) return;

    const doc = document as any;
    const isCurrentlyFullscreen = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      isFullscreen
    );

    if (!isCurrentlyFullscreen) {
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(true));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
        setIsFullscreen(true);
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
        setIsFullscreen(true);
      } else {
        // Fallback for devices without native container fullscreen (e.g. mobile Safari)
        setIsFullscreen(true);
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => setIsFullscreen(false));
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
        setIsFullscreen(false);
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
        setIsFullscreen(false);
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
        setIsFullscreen(false);
      } else {
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      setIsFullscreen(Boolean(fsEl && containerRef.current && (fsEl === containerRef.current || containerRef.current.contains(fsEl))));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, toggleFullscreen]);

  return (
    <div className="flex flex-col w-full h-full p-2 md:p-4 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-3 bg-lounge-800/90 p-3 rounded-xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-brand-500/20 text-brand-400 flex-shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100 truncate">
                {isSelfPresenting
                  ? (fileName || 'Local Video Sync (Host)')
                  : (mediaState?.appType === 'localvideo' && mediaState?.title && mediaState.title !== 'Shared Video'
                      ? mediaState.title
                      : `${presenter?.name || 'Host'} Local Video Stream`)}
              </h3>
              {isBroadcasting && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                  <Radio className="w-3 h-3" /> LIVE STREAMING
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Audio toggle for viewers */}
          {!isSelfPresenting && hasViewerAudioTrack && (
            <button
              type="button"
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className={`p-2 rounded-xl border transition shadow-sm ${
                isAudioMuted
                  ? 'bg-red-500/20 border-red-500/30 text-red-400'
                  : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
              }`}
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Fullscreen button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Host or local peer file loader */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/webm,video/ogg,video/quicktime,video/mkv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition shadow-md cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> {localFileUrl ? 'Switch Video' : 'Choose Video File'}
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        ref={containerRef}
        className={`flex-1 flex flex-col bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative items-center justify-center ${
          isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-none' : ''
        }`}
      >
        {/* Floating Exit Button when inside Fullscreen / Focus Mode */}
        {isFullscreen && (
          <button
            type="button"
            id="floating-exit-fullscreen-btn"
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-black/80 hover:bg-black/95 text-white border border-white/20 shadow-2xl backdrop-blur-md transition transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation group"
            title="Exit Fullscreen (Floating)"
          >
            <Minimize2 className="w-4 h-4 text-brand-300 group-hover:text-white transition-colors" />
            <span className="text-xs font-semibold tracking-wide">Exit Fullscreen</span>
          </button>
        )}
        {/* Host Local Player Mode */}
        {localFileUrl ? (
          <div key="host-container" className="w-full h-full relative flex items-center justify-center bg-black">
            <video
              key="host-local-video"
              ref={videoRef}
              src={localFileUrl}
              controls
              autoPlay
              playsInline
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeek}
              className="w-full h-full object-contain"
            />
          </div>
        ) : viewerStream && hasViewerVideoTrack ? (
          /* Remote Viewer Live Stream Mode */
          <div key="viewer-container" className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              key="viewer-remote-video"
              ref={setRemoteVideoRef}
              autoPlay
              playsInline
              muted={true}
              onPlay={() => setIsRemotePlaying(true)}
              onPause={() => setIsRemotePlaying(false)}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                el.play().then(() => setIsRemotePlaying(true)).catch(err => console.warn('[LocalVideoStage] onLoadedMetadata play err:', err));
              }}
              onCanPlay={(e) => {
                const el = e.currentTarget;
                el.play().then(() => setIsRemotePlaying(true)).catch(err => console.warn('[LocalVideoStage] onCanPlay play err:', err));
              }}
              className="w-full h-full object-contain cursor-pointer"
              style={{
                imageRendering: 'auto',
                WebkitFontSmoothing: 'antialiased',
              }}
              onClick={() => {
                if (remoteVideoRef.current && !isRemotePlaying) {
                  remoteVideoRef.current.play().then(() => setIsRemotePlaying(true)).catch(() => {});
                }
              }}
            />
            {/* Viewer Audio tag for live synchronized sound */}
            <audio key="viewer-remote-audio" ref={remoteAudioRef} autoPlay playsInline />

            {!isRemotePlaying && (
              <button
                type="button"
                onClick={() => {
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().then(() => setIsRemotePlaying(true)).catch(() => {});
                  }
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.play().catch(() => {});
                  }
                  syncAllRemoteStreams();
                  if (presenterId) {
                    socket.emit('webrtc-request-renegotiate', { targetUserId: presenterId });
                  }
                }}
                className="absolute bottom-6 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2 cursor-pointer transition transform hover:scale-105 active:scale-95"
              >
                ▶️ Tap to Resume Video
              </button>
            )}
          </div>
        ) : presenterId ? (
          /* Stream connecting / negotiation */
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-4 shadow-lg animate-pulse">
              <Film className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-200 mb-1">
              Connecting to {presenter?.name || 'Host'}'s Video Stream...
            </h4>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Negotiating real-time P2P stream. If stream does not start automatically, tap below to sync.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  syncAllRemoteStreams();
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition shadow-lg cursor-pointer active:scale-95"
              >
                <Radio className="w-4 h-4 animate-spin" /> Tap to Sync Stream
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                <Upload className="w-4 h-4" /> Pick File Locally
              </button>
            </div>
          </div>
        ) : (
          /* Empty State: Select a local file */
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-4 shadow-lg">
              <Film className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-200 mb-1">
              {fileName || (mediaState?.title && mediaState.title !== 'Shared Video' ? mediaState.title : 'Select a Local Movie or Episode')}
            </h4>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Select a local MP4, MKV, or WebM movie from your computer. It will be streamed directly in ultra-HD to everyone in the room with real-time synchronized audio and video.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition shadow-lg neon-glow cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Load Video File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
