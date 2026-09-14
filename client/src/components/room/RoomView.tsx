import React, { useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { RoomTopBar } from './RoomTopBar';
import { ControlDock } from './ControlDock';
import { StageContainer } from '../stage/StageContainer';
import { VideoGrid } from '../webrtc/VideoGrid';
import { ChatDrawer } from '../chat/ChatDrawer';
import { AppLauncherModal } from './AppLauncherModal';
import { RoomCustomizer } from './RoomCustomizer';
import { InviteModal } from './InviteModal';
import { YouTubeSearchModal } from '../stage/YouTubeSearchModal';
import { ROOM_THEMES } from '../../utils/themes';
import { Minimize2 } from 'lucide-react';

export const RoomView: React.FC = () => {
  const { room, isTheaterMode, setIsTheaterMode } = useRoom();

  // Listen for Escape key to exit theater mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTheaterMode) {
        setIsTheaterMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTheaterMode, setIsTheaterMode]);

  const currentTheme = (room?.backgroundTheme && ROOM_THEMES[room.backgroundTheme]) || ROOM_THEMES['lofi-cafe'];

  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-hidden flex flex-col bg-lounge-900 select-none">
      {/* Dynamic Background Image & Subtle Vignette */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="w-full h-full bg-cover bg-center transition-all duration-700 ease-in-out scale-105 filter blur-[1px]"
          style={{ backgroundImage: `url(${currentTheme.previewUrl})` }}
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${currentTheme.overlayGradient || 'from-black/85 via-black/50 to-black/85'} backdrop-blur-[2px]`} />
      </div>

      {/* Top Bar */}
      {!isTheaterMode && <RoomTopBar />}

      {/* Floating Exit Button for Theater Mode */}
      {isTheaterMode && (
        <button
          type="button"
          onClick={() => setIsTheaterMode(false)}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-black/80 hover:bg-black/95 text-white border border-white/20 shadow-2xl backdrop-blur-md transition transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation group"
          title="Exit Theater Mode (Esc)"
        >
          <Minimize2 className="w-4 h-4 text-brand-300 group-hover:text-white transition-colors" />
          <span className="text-xs font-semibold tracking-wide">Exit Theater</span>
        </button>
      )}

      {/* Main Content Area (Center Stage + Side Chat Drawer) */}
      <div className="flex-1 flex min-h-0 relative z-10">
        {/* Stage & Video Avatars */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Active Activity Stage */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <StageContainer />
          </div>

          {/* Floating Video Avatars Grid */}
          <div className="px-2 md:px-4 pb-0.5 md:pb-1">
            <VideoGrid />
          </div>

          {/* Bottom Controls Dock */}
          {!isTheaterMode && <ControlDock />}
        </div>

        {/* Real-Time Chat & People Drawer */}
        <ChatDrawer />
      </div>

      {/* Modals */}
      <AppLauncherModal />
      <RoomCustomizer />
      <InviteModal />
      <YouTubeSearchModal />
    </div>
  );
};
