import React, { useRef, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { MicOff, Crown, Volume2, Monitor } from 'lucide-react';

interface VideoTileProps {
  user: User;
  stream?: MediaStream | null;
  isSpeaking?: boolean;
  isSelf?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({ user, stream, isSpeaking, isSelf }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const hasVideoTrack = Boolean(
    stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks()[0].enabled &&
    !user.isCameraOff
  );

  // Callback ref guarantees srcObject and play() are called the instant <video> mounts
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && stream) {
      if (node.srcObject !== stream) {
        node.srcObject = stream;
      }
      node.play().catch((err) => {
        console.warn(`[Video] Autoplay blocked for ${user.name}:`, err);
      });
    }
  }, [stream, user.name]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream && hasVideoTrack) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch((err) => {
        console.warn(`[Video] Autoplay blocked for ${user.name}:`, err);
      });

      const onTrackChange = () => {
        if (videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
        videoEl.play().catch(() => {});
      };

      stream.addEventListener('addtrack', onTrackChange);
      stream.addEventListener('removetrack', onTrackChange);

      return () => {
        stream.removeEventListener('addtrack', onTrackChange);
        stream.removeEventListener('removetrack', onTrackChange);
      };
    }
  }, [stream, hasVideoTrack, user.name]);

  // Unlock video on user gesture if needed
  useEffect(() => {
    const unlockVideo = () => {
      if (videoRef.current && hasVideoTrack) {
        videoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', unlockVideo, { passive: true });
    window.addEventListener('touchstart', unlockVideo, { passive: true });
    return () => {
      window.removeEventListener('click', unlockVideo);
      window.removeEventListener('touchstart', unlockVideo);
    };
  }, [hasVideoTrack]);

  // Dedicated audio playback for remote peers
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!isSelf && audioEl && stream) {
      audioEl.srcObject = stream;
      audioEl.volume = 1.0;

      const attemptPlay = () => {
        audioEl.play().catch((err) => {
          console.warn(`[Audio] Autoplay blocked for ${user.name}, waiting for gesture:`, err);
        });
      };

      attemptPlay();

      const onTrackChange = () => {
        if (audioEl.srcObject !== stream) {
          audioEl.srcObject = stream;
        }
        attemptPlay();
      };

      stream.addEventListener('addtrack', onTrackChange);
      stream.addEventListener('removetrack', onTrackChange);

      const unlockAudio = () => {
        if (audioEl) {
          audioEl.play().catch(() => {});
        }
      };

      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });

      return () => {
        stream.removeEventListener('addtrack', onTrackChange);
        stream.removeEventListener('removetrack', onTrackChange);
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
    }
  }, [stream, isSelf, user.name]);

  return (
    <div
      className={`relative group w-20 h-16 sm:w-28 sm:h-22 md:w-44 md:h-32 rounded-xl overflow-hidden glass-panel transition-all duration-200 shadow-lg flex-shrink-0 ${
        isSpeaking ? 'speaking-glow ring-2 ring-emerald-500' : 'hover:border-white/20'
      }`}
    >
      {/* Video stream */}
      {hasVideoTrack ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={true}
          className={`w-full h-full object-cover ${isSelf ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        /* Fallback Avatar view */
        <div
          className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
          style={{
            background: `radial-gradient(circle, ${user.color}25 0%, rgba(15, 15, 20, 0.9) 100%)`
          }}
        >
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg sm:text-xl md:text-3xl shadow-inner border border-white/10"
            style={{ backgroundColor: `${user.color}40` }}
          >
            {user.avatar}
          </div>
          {isSpeaking && (
            <div className="absolute inset-0 rounded-xl pointer-events-none border-2 border-emerald-400 animate-pulse" />
          )}
        </div>
      )}

      {/* Top badges: Host crown, Screen sharing badge & Mic indicator */}
      <div className="absolute top-1 left-1 right-1 md:top-2 md:left-2 md:right-2 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1">
          {user.isHost && (
            <span className="flex items-center gap-1 bg-amber-500/80 backdrop-blur-md px-1 py-0.2 md:px-1.5 md:py-0.5 rounded text-[8px] md:text-[10px] font-bold text-amber-950 shadow">
              <Crown className="w-2.5 h-2.5 md:w-3 md:h-3" /> <span className="hidden sm:inline">Host</span>
            </span>
          )}
          {user.isScreenSharing && (
            <span className="flex items-center gap-1 bg-emerald-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow animate-pulse">
              <Monitor className="w-3 h-3" /> Screen
            </span>
          )}
        </div>
        <div className="ml-auto">
          {user.isMuted ? (
            <span className="p-1 rounded-full bg-red-500/80 backdrop-blur-md text-white flex items-center justify-center shadow">
              <MicOff className="w-3 h-3" />
            </span>
          ) : isSpeaking ? (
            <span className="p-1 rounded-full bg-emerald-500/80 backdrop-blur-md text-white flex items-center justify-center shadow animate-bounce">
              <Volume2 className="w-3 h-3" />
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom Name Label */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-0.5 px-1.5 sm:p-1.5 sm:px-2 flex items-center justify-between">
        <span className="text-[9px] sm:text-xs font-medium text-slate-200 truncate max-w-[80px] sm:max-w-[100px]">
          {user.name} {isSelf && '(You)'}
        </span>
      </div>

      {/* Dedicated audio element for remote peers - kept in DOM with low opacity, NEVER display:none */}
      {!isSelf && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          style={{
            position: 'fixed',
            top: -9999,
            left: -9999,
            width: '1px',
            height: '1px',
            opacity: 0.01,
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
};
