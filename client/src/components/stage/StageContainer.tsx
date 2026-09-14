import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { YouTubeStage } from './YouTubeStage';
import { ScreenShareStage } from './ScreenShareStage';
import { LocalVideoStage } from './LocalVideoStage';
import { WhiteboardStage } from './WhiteboardStage';
import { RetroArcadeStage } from './RetroArcadeStage';
import { CardTableStage } from './CardTableStage';
import { AmbientSoundPlayer } from './AmbientSoundPlayer';
import { ChessStage } from './ChessStage';
import { Tv, Sparkles, PlusCircle } from 'lucide-react';

export const StageContainer: React.FC = () => {
  const { room, setIsAppLauncherOpen } = useRoom();

  const activeApp = room?.activeApp || 'none';

  switch (activeApp) {
    case 'youtube':
      return <YouTubeStage />;
    case 'screenshare':
      return <ScreenShareStage />;
    case 'localvideo':
      return <LocalVideoStage />;
    case 'whiteboard':
      return <WhiteboardStage />;
    case 'chess':
      return <ChessStage />;
    case 'retro-arcade':
      return <RetroArcadeStage />;
    case 'card-table':
      return <CardTableStage />;
    case 'ambient':
      return <AmbientSoundPlayer />;
    case 'none':
    default:
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center">
          <div className="glass-panel p-8 md:p-12 rounded-3xl max-w-lg border border-white/10 shadow-2xl flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-6 shadow-inner neon-glow">
              <Tv className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-slate-100 mb-2">Welcome to {room?.name || 'Your Lounge'}</h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              Launch a shared YouTube watch party, start screen sharing, play retro games, draw on the whiteboard, or shuffle cards with friends.
            </p>

            <button
              onClick={() => setIsAppLauncherOpen(true)}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 neon-glow"
            >
              <PlusCircle className="w-5 h-5" /> Launch Activity or Watch
            </button>
          </div>
        </div>
      );
  }
};
