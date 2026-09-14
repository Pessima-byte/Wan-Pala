import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Play, Pause, Search } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const YouTubeStage: React.FC = () => {
  const { room, sendMediaAction, setIsYouTubeSearchOpen } = useRoom();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const isUpdatingFromSocket = useRef(false);
  const currentLoadedVideoIdRef = useRef<string | null>(null);

  const mediaState = room?.mediaState;
  const activeVideoId = mediaState?.url ? extractYouTubeId(mediaState.url) || '5qap5aO4i9A' : '5qap5aO4i9A';

  const initPlayer = useCallback((videoId: string) => {
    if (!containerRef.current || playerRef.current) return;

    // Ensure the container has the youtube-player-element div
    let playerEl = document.getElementById('youtube-player-element');
    if (!playerEl && containerRef.current) {
      playerEl = document.createElement('div');
      playerEl.id = 'youtube-player-element';
      playerEl.className = 'w-full h-full';
      containerRef.current.appendChild(playerEl);
    }

    try {
      currentLoadedVideoIdRef.current = videoId;
      playerRef.current = new window.YT.Player('youtube-player-element', {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            // Check if activeVideoId changed while player was initializing
            if (activeVideoId && activeVideoId !== currentLoadedVideoIdRef.current) {
              currentLoadedVideoIdRef.current = activeVideoId;
              event.target.loadVideoById(activeVideoId, mediaState?.currentTime || 0);
            } else {
              if (mediaState?.playing) {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
              }
              if (mediaState?.currentTime) {
                event.target.seekTo(mediaState.currentTime, true);
              }
            }
          },
          onStateChange: (event: any) => {
            if (isUpdatingFromSocket.current) return;

            // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
            if (event.data === 1) {
              const time = event.target.getCurrentTime ? event.target.getCurrentTime() : 0;
              sendMediaAction('play', { currentTime: time });
            } else if (event.data === 2) {
              const time = event.target.getCurrentTime ? event.target.getCurrentTime() : 0;
              sendMediaAction('pause', { currentTime: time });
            } else if (event.data === 0) {
              // Video ended - advance queue if items present
              if (mediaState?.queue && mediaState.queue.length > 1) {
                const nextItem = mediaState.queue[1];
                sendMediaAction('set-media', { url: nextItem.url, title: nextItem.title, appType: 'youtube' });
                sendMediaAction('queue-remove', { id: mediaState.queue[0].id });
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('[YouTubeStage] Failed to initialize YT.Player:', err);
    }
  }, [activeVideoId, mediaState?.currentTime, mediaState?.playing, mediaState?.queue, sendMediaAction]);

  // Load YouTube IFrame API script or initialize player if API ready
  useEffect(() => {
    let checkInterval: any = null;

    const tryInit = () => {
      if (window.YT && window.YT.Player) {
        initPlayer(activeVideoId);
        return true;
      }
      return false;
    };

    if (!tryInit()) {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        tryInit();
      };

      // Also check periodically in case onYouTubeIframeAPIReady was already fired
      checkInterval = setInterval(() => {
        if (tryInit()) {
          clearInterval(checkInterval);
        }
      }, 100);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      setIsReady(false);
      currentLoadedVideoIdRef.current = null;
    };
  }, []);

  // Sync state from server changes (video URL, play/pause, time seek)
  useEffect(() => {
    if (!playerRef.current || !isReady || !mediaState) return;

    const player = playerRef.current;
    isUpdatingFromSocket.current = true;

    // Check if video source changed
    const targetVideoId = extractYouTubeId(mediaState.url);
    if (targetVideoId && targetVideoId !== currentLoadedVideoIdRef.current) {
      currentLoadedVideoIdRef.current = targetVideoId;
      if (typeof player.loadVideoById === 'function') {
        player.loadVideoById(targetVideoId, mediaState.currentTime || 0);
      }
    }

    // Sync play/pause
    const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
    if (mediaState.playing && playerState !== 1) {
      if (typeof player.playVideo === 'function') player.playVideo();
    } else if (!mediaState.playing && playerState === 1) {
      if (typeof player.pauseVideo === 'function') player.pauseVideo();
    }

    // Check drift (if local time differs from synced time by > 2.5 seconds)
    const localTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
    const elapsedSinceUpdate = mediaState.playing ? (Date.now() - (mediaState.lastUpdated || Date.now())) / 1000 : 0;
    const expectedTime = (mediaState.currentTime || 0) + elapsedSinceUpdate;

    if (Math.abs(localTime - expectedTime) > 2.5 && typeof player.seekTo === 'function') {
      player.seekTo(expectedTime, true);
    }

    const timer = setTimeout(() => {
      isUpdatingFromSocket.current = false;
    }, 400);

    return () => clearTimeout(timer);
  }, [mediaState, isReady]);

  return (
    <div className="flex flex-col w-full h-full p-2 md:p-4 max-w-5xl mx-auto min-h-0 justify-center">
      {/* Video Player Box */}
      <div className="w-full flex flex-col bg-black rounded-2xl border border-white/10 shadow-2xl relative max-h-[calc(100vh-230px)]">
        <div ref={containerRef} className="w-full flex-1 relative aspect-video flex items-center justify-center bg-black min-h-0 rounded-t-2xl overflow-hidden">
          <div id="youtube-player-element" className="w-full h-full" />
        </div>

        {/* Video Title Bar */}
        <div className="bg-lounge-850/95 border-t border-white/10 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="font-medium text-xs sm:text-sm text-slate-200 truncate">
              {mediaState?.title || 'YouTube Watch Party'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              onClick={() => setIsYouTubeSearchOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/30 transition shadow-sm font-semibold cursor-pointer active:scale-95"
              title="Search YouTube or play another video"
            >
              <Search className="w-3.5 h-3.5 text-red-400" />
              <span>Search / Change Video</span>
            </button>

            <div className="h-4 w-[1px] bg-white/10" />

            {mediaState?.playing ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Play className="w-3 h-3 fill-current" /> Synced
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <Pause className="w-3 h-3" /> Paused
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
