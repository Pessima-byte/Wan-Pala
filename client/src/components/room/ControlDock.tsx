import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { Mic, MicOff, Video, VideoOff, Monitor, Plus } from 'lucide-react';

export const ControlDock: React.FC = () => {
  const {
    currentUser,
    localStream,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    setIsAppLauncherOpen
  } = useRoom();

  const isMicWaitingPermission = !localStream && !currentUser.isMuted;

  return (
    <div className="flex items-center justify-center p-1.5 md:p-3 z-20">
      <div className="glass-panel px-3 py-1.5 md:px-4 md:py-2.5 rounded-2xl flex items-center gap-2 md:gap-3 shadow-2xl border border-white/10 pointer-events-auto">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={toggleMute}
          className={`p-2.5 md:p-3 rounded-xl transition shadow-md flex items-center justify-center cursor-pointer select-none active:scale-90 touch-manipulation ${
            currentUser.isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              : isMicWaitingPermission
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
          }`}
          title={
            currentUser.isMuted
              ? 'Unmute Microphone'
              : isMicWaitingPermission
              ? 'Tap to Enable Microphone & Speak'
              : 'Mute Microphone'
          }
        >
          {currentUser.isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : isMicWaitingPermission ? (
            <MicOff className="w-5 h-5 text-amber-400" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-xl transition shadow-md flex items-center justify-center ${
            currentUser.isCameraOff
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
          }`}
          title={currentUser.isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {currentUser.isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-xl transition shadow-md flex items-center justify-center ${
            currentUser.isScreenSharing
              ? 'bg-emerald-500 text-white shadow-emerald-500/30 shadow-lg'
              : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
          }`}
          title={currentUser.isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <div className="w-[1px] h-7 bg-white/10 mx-1" />

        {/* Big Launch App / Watch Button */}
        <button
          onClick={() => setIsAppLauncherOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-emerald-950 text-xs md:text-sm font-bold rounded-xl shadow-[0_2px_14px_rgba(16,185,129,0.35)] transition-all duration-150 transform active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-950 stroke-[3]" /> Add App / Watch
        </button>
      </div>
    </div>
  );
};
