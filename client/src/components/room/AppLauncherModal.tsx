import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { AppType } from '../../types';
import {
  Tv,
  Monitor,
  Film,
  Palette,
  Swords,
  X,
  Sparkles
} from 'lucide-react';

interface AppOption {
  type: AppType;
  title: string;
  category: 'Watch' | 'Play' | 'Create' | 'Relax';
  description: string;
  icon: any;
  color: string;
  badge?: string;
}

const APPS: AppOption[] = [
  {
    type: 'youtube',
    title: 'YouTube Watch Party',
    category: 'Watch',
    description: 'Watch YouTube videos together with millisecond play/pause/seek synchronization and collaborative queues.',
    icon: Tv,
    color: 'from-red-600 to-rose-600',
    badge: 'Popular'
  },
  {
    type: 'screenshare',
    title: 'Screen & Tab Share',
    category: 'Watch',
    description: 'Stream Netflix, Disney+, Anime, or your favorite game directly from your browser tab or desktop with audio.',
    icon: Monitor,
    color: 'from-blue-600 to-cyan-600',
    badge: 'HD Stream'
  },
  {
    type: 'localvideo',
    title: 'Local Video Player',
    category: 'Watch',
    description: 'Play local MP4/MKV movies directly from your computer synced across everyone with zero cloud upload.',
    icon: Film,
    color: 'from-amber-600 to-orange-600',
    badge: 'P2P No Upload'
  },
  {
    type: 'whiteboard',
    title: 'Collaborative Whiteboard',
    category: 'Create',
    description: 'Draw, sketch, brainstorm, and play guess-the-drawing games with real-time shared strokes.',
    icon: Palette,
    color: 'from-pink-600 to-rose-600'
  },
  {
    type: 'chess',
    title: 'Chess & Puzzles',
    category: 'Play',
    description: '1v1 challenge matches, Lichess daily tactical puzzles, and live Grandmaster TV.',
    icon: Swords,
    color: 'from-amber-600 to-yellow-600',
    badge: '1v1 & Puzzles'
  }
];

export const AppLauncherModal: React.FC = () => {
  const { isAppLauncherOpen, setIsAppLauncherOpen, setActiveApp, toggleScreenShare, setIsYouTubeSearchOpen } = useRoom();

  if (!isAppLauncherOpen) return null;

  const handleLaunch = async (appType: AppType) => {
    setIsAppLauncherOpen(false);
    if (appType === 'screenshare') {
      await toggleScreenShare();
    } else if (appType === 'youtube') {
      setActiveApp('youtube');
      setIsYouTubeSearchOpen(true);
    } else {
      setActiveApp(appType);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-lounge-850 border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">WAN PALA Lounge & Arcade</h2>
              <p className="text-xs text-slate-400">Choose an activity to launch into the room's main stage</p>
            </div>
          </div>

          <button
            onClick={() => setIsAppLauncherOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {APPS.map(app => {
            const Icon = app.icon;
            return (
              <div
                key={app.type}
                onClick={() => handleLaunch(app.type)}
                className="group relative p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-500/40 cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${app.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {app.category}
                      </span>
                      {app.badge && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-bold border border-brand-500/30">
                          {app.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 mb-1 group-hover:text-brand-300 transition-colors">
                    {app.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{app.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-end">
                  <span className="text-xs font-semibold text-brand-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Launch in Room →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
