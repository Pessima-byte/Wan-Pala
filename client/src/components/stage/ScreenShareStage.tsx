import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Monitor, StopCircle, Maximize2, Minimize2, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { socket } from '../../socket';

export const ScreenShareStage: React.FC = () => {
  const { room, currentUser, screenStream, remoteStreams, remoteScreenStreams, toggleScreenShare, syncAllRemoteStreams } = useRoom();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  // Force re-sync remote streams on mount and periodically while waiting
  useEffect(() => {
    syncAllRemoteStreams();
    const timer = setInterval(() => {
      syncAllRemoteStreams();
    }, 2000);
    return () => clearInterval(timer);
  }, [syncAllRemoteStreams]);

  // Resilient presenter lookup from mediaState and user properties
  const presenterUser = useMemo(() => {
    if (room?.mediaState?.screenSharingUserId && room.users[room.mediaState.screenSharingUserId]) {
      return room.users[room.mediaState.screenSharingUserId];
    }
    const sharingUser = Object.values(room?.users || {}).find(u => u.isScreenSharing);
    if (sharingUser) return sharingUser;
    if (currentUser.isScreenSharing) return currentUser;
    return undefined;
  }, [room?.mediaState?.screenSharingUserId, room?.users, currentUser]);

  const presenterId = presenterUser?.id || room?.mediaState?.screenSharingUserId;
  const isSelfPresenting = presenterId === currentUser.id;
  const presenter = presenterUser || (presenterId ? room?.users[presenterId] : undefined);

  // Stream to display: for self, screenStream; for remote presenter, dedicated remoteScreenStreams (or fallback to remoteStreams)
  const activeStream = useMemo(() => {
    if (isSelfPresenting) return screenStream;
    if (presenterId) {
      if (remoteScreenStreams?.[presenterId]?.getVideoTracks().length) {
        return remoteScreenStreams[presenterId];
      }
      if (remoteStreams[presenterId]?.getVideoTracks().length) {
        return remoteStreams[presenterId];
      }
    }
    // Fallback: any remote screen stream with video tracks
    for (const stream of Object.values(remoteScreenStreams || {})) {
      if (stream.getVideoTracks().length > 0) return stream;
    }
    // Fallback: any remote stream with video tracks from other users
    for (const [uid, stream] of Object.entries(remoteStreams || {})) {
      if (uid !== currentUser.id && stream.getVideoTracks().length > 0) return stream;
    }
    return remoteScreenStreams?.[presenterId || ''] || remoteStreams[presenterId || ''] || null;
  }, [isSelfPresenting, screenStream, presenterId, remoteScreenStreams, remoteStreams, currentUser.id]);

  // Request renegotiation from presenter if stream is not ready after mounting
  useEffect(() => {
    if (!isSelfPresenting && presenterId) {
      syncAllRemoteStreams();
      const retryTimer = setTimeout(() => {
        if (!activeStream || !activeStream.getVideoTracks().length) {
          console.log(`[ScreenShareStage] Requesting screen renegotiation from ${presenterId}`);
          socket.emit('webrtc-request-renegotiate', { targetUserId: presenterId });
          syncAllRemoteStreams();
        }
      }, 1200);
      return () => clearTimeout(retryTimer);
    }
  }, [isSelfPresenting, presenterId, activeStream, syncAllRemoteStreams]);

  // Check if the stream has a video track
  const hasVideoTrack = Boolean(
    activeStream &&
    activeStream.getVideoTracks().length > 0
  );
  const hasAudioTrack = Boolean(
    activeStream &&
    activeStream.getAudioTracks().length > 0
  );

  // Debug logging for remote stream state
  useEffect(() => {
    if (!isSelfPresenting && presenterId) {
      const stream = remoteScreenStreams?.[presenterId] || remoteStreams[presenterId];
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        console.log(`[ScreenShareStage] Remote screen stream for ${presenterId}:`, {
          streamId: stream.id,
          videoTracks: videoTracks.map(t => ({ id: t.id, muted: t.muted, readyState: t.readyState, enabled: t.enabled })),
          audioTracks: audioTracks.map(t => ({ id: t.id, muted: t.muted, readyState: t.readyState, enabled: t.enabled })),
        });
        setStreamReady(videoTracks.some(t => t.readyState === 'live'));
      } else {
        console.log(`[ScreenShareStage] No remote screen stream yet for presenter ${presenterId}`);
        console.log(`[ScreenShareStage] Available screen streams:`, Object.keys(remoteScreenStreams || {}));
        setStreamReady(false);
      }
    }
  }, [isSelfPresenting, presenterId, remoteScreenStreams, remoteStreams]);

  // Callback ref guarantees srcObject and play() are invoked the instant <video> mounts
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && activeStream) {
      node.defaultMuted = true;
      node.muted = true;
      node.playsInline = true;
      if (node.srcObject !== activeStream) {
        node.srcObject = activeStream;
      }
      const playPromise = node.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(err => {
          console.warn('[ScreenShare] Video autoplay awaiting user interaction or frame:', err);
          setIsPlaying(false);
        });
      }
    }
  }, [activeStream]);

  // Effect to re-bind when activeStream or tracks change
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && activeStream) {
      videoEl.defaultMuted = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      if (videoEl.srcObject !== activeStream) {
        videoEl.srcObject = activeStream;
      }
      videoEl.play().then(() => setIsPlaying(true)).catch(err => {
        console.warn('[ScreenShare] Video play error:', err);
      });

      const onTrackChange = () => {
        if (videoEl.srcObject !== activeStream) {
          videoEl.srcObject = activeStream;
        }
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
      };

      const handlePlaying = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      videoEl.addEventListener('playing', handlePlaying);
      videoEl.addEventListener('pause', handlePause);
      videoEl.addEventListener('loadeddata', onTrackChange);
      videoEl.addEventListener('canplay', onTrackChange);
      activeStream.addEventListener('addtrack', onTrackChange);
      activeStream.addEventListener('removetrack', onTrackChange);

      // Listen on tracks directly for unmute events
      const tracks = activeStream.getVideoTracks();
      tracks.forEach(track => {
        track.addEventListener('unmute', onTrackChange);
      });

      return () => {
        videoEl.removeEventListener('playing', handlePlaying);
        videoEl.removeEventListener('pause', handlePause);
        videoEl.removeEventListener('loadeddata', onTrackChange);
        videoEl.removeEventListener('canplay', onTrackChange);
        activeStream.removeEventListener('addtrack', onTrackChange);
        activeStream.removeEventListener('removetrack', onTrackChange);
        tracks.forEach(track => {
          track.removeEventListener('unmute', onTrackChange);
        });
      };
    }
  }, [activeStream]);

  // Dedicated screen audio for remote viewers
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!isSelfPresenting && audioEl && activeStream && hasAudioTrack) {
      audioEl.srcObject = activeStream;
      audioEl.muted = isAudioMuted;
      audioEl.play().catch(e => console.warn('[ScreenShare] Audio blocked:', e));
    }
  }, [activeStream, isSelfPresenting, hasAudioTrack, isAudioMuted]);

  // Fullscreen management with cross-browser and iOS support
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
    <div className="flex flex-col w-full h-full p-2 md:p-4 max-w-6xl mx-auto items-center justify-center">
      <div
        ref={containerRef}
        className={`w-full h-full flex flex-col bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative ${
          isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-none' : ''
        }`}
      >
        {/* Top Header Banner */}
        <div className="bg-lounge-850/95 border-b border-white/10 px-4 py-3 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
              <Monitor className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2 truncate">
                <span className="truncate">
                  {isSelfPresenting ? 'You are sharing your screen' : `${presenter?.name || 'Someone'} is sharing their screen`}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400">Streamed at native resolution with maximum sharpness</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Screen audio toggle if stream includes audio and not presenting self */}
            {!isSelfPresenting && hasAudioTrack && (
              <button
                type="button"
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className={`p-2 rounded-xl border transition shadow-sm ${
                  isAudioMuted
                    ? 'bg-red-500/20 border-red-500/30 text-red-400'
                    : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                }`}
                title={isAudioMuted ? 'Unmute Screen Audio' : 'Mute Screen Audio'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Stop Sharing button for presenter */}
            {isSelfPresenting && (
              <button
                type="button"
                onClick={toggleScreenShare}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition shadow-md cursor-pointer active:scale-95"
              >
                <StopCircle className="w-4 h-4" /> Stop Sharing
              </button>
            )}
          </div>
        </div>

        {/* Video stream viewport */}
        <div className="flex-1 w-full relative flex items-center justify-center bg-black/95 overflow-hidden">
          {/* Floating Exit Fullscreen Button inside viewport */}
          {isFullscreen && (
            <button
              type="button"
              id="floating-screenshare-exit-fullscreen-btn"
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-black/80 hover:bg-black/95 text-white border border-white/20 shadow-2xl backdrop-blur-md transition transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation group"
              title="Exit Fullscreen (Floating)"
            >
              <Minimize2 className="w-4 h-4 text-brand-300 group-hover:text-white transition-colors" />
              <span className="text-xs font-semibold tracking-wide">Exit Fullscreen</span>
            </button>
          )}
          {activeStream && hasVideoTrack ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted={true} // Always muted so iOS and desktop browsers autoplay instantly without blocking
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  el.play().then(() => setIsPlaying(true)).catch(err => console.warn('[ScreenShare] onLoadedMetadata play err:', err));
                }}
                onCanPlay={(e) => {
                  const el = e.currentTarget;
                  el.play().then(() => setIsPlaying(true)).catch(err => console.warn('[ScreenShare] onCanPlay play err:', err));
                }}
                className="w-full h-full object-contain cursor-pointer"
                style={{
                  imageRendering: 'auto',
                  WebkitFontSmoothing: 'antialiased',
                }}
                onClick={() => {
                  if (videoRef.current && !isPlaying) {
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
              />
              {!isPlaying && !isSelfPresenting && (
                <button
                  type="button"
                  onClick={() => videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {})}
                  className="absolute bottom-6 px-4 py-2 bg-brand-600/90 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2 cursor-pointer transition transform hover:scale-105"
                >
                  ▶️ Tap to Resume Stream
                </button>
              )}
            </div>
          ) : activeStream && !hasVideoTrack ? (
            /* Stream exists but video track not live yet - show waiting with more info */
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-brand-400 animate-pulse">
                <Monitor className="w-8 h-8" />
              </div>
              <p className="text-base font-medium text-slate-200">Receiving screen share...</p>
              <p className="text-xs text-slate-400 mt-1">Video track detected, waiting for frames</p>
            </div>
          ) : isSelfPresenting ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center mb-4 text-brand-400 shadow-lg">
                <Monitor className="w-8 h-8" />
              </div>
              <p className="text-lg font-bold text-slate-200">Share Your Screen or Browser Tab</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Stream YouTube, Netflix, games, presentations, or documents directly to everyone in this room.
              </p>
              <button
                type="button"
                onClick={toggleScreenShare}
                className="mt-5 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-bold rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 cursor-pointer"
              >
                <Monitor className="w-4 h-4" /> Select Screen / Window / Tab
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-brand-400 animate-pulse">
                <Monitor className="w-8 h-8" />
              </div>
              <p className="text-base font-medium text-slate-200">Screen share connecting...</p>
              <p className="text-xs text-slate-400 mt-1">
                Establishing high-resolution real-time stream
                {presenterId && ` from ${presenter?.name || presenterId}`}
              </p>
              <button
                type="button"
                onClick={() => {
                  syncAllRemoteStreams();
                  if (presenterId) {
                    socket.emit('webrtc-request-renegotiate', { targetUserId: presenterId });
                  }
                  if (videoRef.current) {
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                className="mt-4 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition shadow-lg cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Tap to Sync Stream
              </button>
            </div>
          )}

          {/* Hidden dedicated audio element for remote stream audio */}
          {!isSelfPresenting && hasAudioTrack && (
            <audio
              ref={audioRef}
              autoPlay
              playsInline
              style={{
                position: 'fixed',
                top: -9999,
                left: -9999,
                width: 1,
                height: 1,
                opacity: 0.01,
                pointerEvents: 'none'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
