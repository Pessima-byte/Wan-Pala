import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import {
  Share2,
  Check,
  Palette,
  MessageSquare,
  LogOut,
  Lock,
  Pencil,
  Tv,
  Monitor,
  Film,
  Gamepad2,
  Layers,
  CloudRain,
  Sparkles,
  ChevronDown
} from 'lucide-react';

import { copyToClipboard } from '../../utils/copy';

export const RoomTopBar: React.FC = () => {
  const {
    room,
    currentUser,
    isChatOpen,
    setIsChatOpen,
    setIsSettingsOpen,
    setIsInviteOpen,
    setIsAppLauncherOpen,
    updateRoomSettings,
    leaveRoom
  } = useRoom();

  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameVal, setEditingNameVal] = useState('');

  const activeApp = room?.activeApp || 'none';
  const isPlaying = room?.mediaState?.playing || false;
  const currentTitle = (
    activeApp === 'whiteboard' ? 'Collaborative Canvas' :
    activeApp === 'screenshare' ? (room?.mediaState?.title || 'Screen & Tab Share') :
    activeApp === 'localvideo' ? (room?.mediaState?.title || 'Local Movie Player') :
    activeApp === 'youtube' ? (room?.mediaState?.title || 'YouTube Watch Party') :
    room?.mediaState?.title || 'Cinema & Media Lounge'
  );

  const getAppMeta = () => {
    switch (activeApp) {
      case 'youtube':
        return { label: 'YouTube', icon: Tv, color: 'text-red-400' };
      case 'screenshare':
        return { label: 'Screen Share', icon: Monitor, color: 'text-cyan-400' };
      case 'localvideo':
        return { label: 'Local Movie', icon: Film, color: 'text-amber-400' };
      case 'retro-arcade':
        return { label: 'Retro Arcade', icon: Gamepad2, color: 'text-purple-400' };
      case 'card-table':
        return { label: 'Card Table', icon: Layers, color: 'text-emerald-400' };
      case 'whiteboard':
        return { label: 'Whiteboard', icon: Palette, color: 'text-pink-400' };
      case 'ambient':
        return { label: 'Lo-Fi Audio', icon: CloudRain, color: 'text-indigo-400' };
      default:
        return { label: 'Wan Pala Stage', icon: Sparkles, color: 'text-amber-300' };
    }
  };

  const appMeta = getAppMeta();
  const AppIcon = appMeta.icon;
  const userList = room?.users ? Object.values(room.users) : [currentUser];
  const userCount = userList.length;

  const handleSaveName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingNameVal.trim() && editingNameVal.trim() !== room?.name) {
      updateRoomSettings({ name: editingNameVal.trim() });
    }
    setIsEditingName(false);
  };

  const handleInviteClick = async () => {
    setIsInviteOpen(true);
    const url = window.location.href;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="relative z-30 flex-shrink-0 min-h-[54px] md:min-h-[68px] pt-[max(env(safe-area-inset-top),6px)] pb-1.5 md:pb-2 px-3 sm:px-4 md:px-6 bg-[#08100d]/90 backdrop-blur-2xl border-b border-emerald-500/15 flex items-center justify-between gap-2 sm:gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Left: Brand Logo & Room Identity */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <div className="relative flex items-center justify-center flex-shrink-0 group cursor-pointer">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-amber-400/25 via-emerald-400/30 to-teal-400/20 blur-md pointer-events-none group-hover:scale-110 transition-transform duration-300" />
          <img
            src="/wan-pala-logo.png"
            alt="WAN PALA"
            className="relative w-9 h-9 sm:w-12 sm:h-12 md:w-[68px] md:h-[68px] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)] drop-shadow-[0_0_18px_rgba(16,185,129,0.4)] filter brightness-105 transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col min-w-0 justify-center">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editingNameVal}
                  onChange={e => setEditingNameVal(e.target.value)}
                  onBlur={handleSaveName}
                  autoFocus
                  className="bg-black/50 border border-amber-500/40 rounded-lg px-2.5 py-0.5 text-sm font-semibold text-white focus:outline-none shadow-inner"
                />
              </form>
            ) : (
              <div
                onClick={() => {
                  if (currentUser.isHost) {
                    setEditingNameVal(room?.name || '');
                    setIsEditingName(true);
                  }
                }}
                className={`flex items-center gap-2 group ${currentUser.isHost ? 'cursor-pointer' : ''}`}
                title={currentUser.isHost ? 'Click to rename room' : undefined}
              >
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight truncate leading-snug group-hover:text-amber-300 transition-colors">
                  {room?.name || 'WAN PALA'}
                </h1>
                {currentUser.isHost && (
                  <Pencil className="w-3.5 h-3.5 text-amber-500/60 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                )}
              </div>
            )}
            {room?.isLocked && (
              <span title="Password Protected Room" className="text-amber-400 flex items-center">
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Dynamic Island Lounge Capsule */}
      <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 z-10">
        <button
          type="button"
          onClick={() => setIsAppLauncherOpen(true)}
          className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[#0a1411]/90 hover:bg-[#0f1f1a] border border-emerald-500/25 hover:border-amber-400/40 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.6),0_0_20px_rgba(16,185,129,0.12)] transition-all duration-300 cursor-pointer group select-none active:scale-95"
          title="Click to switch activity or launch apps"
        >
          {/* Activity Badge & Live Indicator */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500/15 via-emerald-500/20 to-teal-500/15 border border-emerald-500/30 text-amber-300 shadow-inner group-hover:scale-105 transition-transform flex-shrink-0">
              <AppIcon className={`w-3.5 h-3.5 ${appMeta.color}`} />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>

            {/* Equalizer animation when media is playing */}
            {isPlaying ? (
              <div className="flex items-end gap-[2px] h-3.5 px-0.5">
                <span className="w-0.5 bg-emerald-400 rounded-full animate-soundwave-1" />
                <span className="w-0.5 bg-amber-400 rounded-full animate-soundwave-2" />
                <span className="w-0.5 bg-emerald-300 rounded-full animate-soundwave-3" />
                <span className="w-0.5 bg-teal-400 rounded-full animate-soundwave-4" />
              </div>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                LIVE
              </span>
            )}
          </div>

          {/* Activity Name & Title */}
          <div className="flex flex-col text-left max-w-[140px] md:max-w-[200px] lg:max-w-[280px]">
            <div className="flex items-center gap-1.5 leading-none mb-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300/90 font-mono">
                {appMeta.label}
              </span>
              <span className="text-[9px] text-zinc-500">&bull;</span>
              <span className="text-[9px] font-medium text-emerald-400">
                {isPlaying ? 'Live Stream' : 'Synced'}
              </span>
            </div>
            <span className="text-xs font-semibold text-zinc-100 truncate group-hover:text-amber-300 transition-colors">
              {currentTitle}
            </span>
          </div>

          {/* Divider */}
          <div className="w-[1px] h-5 bg-white/10" />

          {/* Connected Peers Counter & Avatars */}
          <div className="flex items-center gap-1.5 pl-0.5">
            <div className="flex -space-x-1.5 overflow-hidden">
              {userList.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="w-5 h-5 rounded-full border border-black/80 flex items-center justify-center text-[10px] shadow-sm flex-shrink-0"
                  style={{ backgroundColor: `${u.color}35` }}
                  title={u.name}
                >
                  {u.avatar}
                </div>
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-zinc-300">
              {userCount}
            </span>
          </div>

          {/* Switch Activity Chevron Dropdown Icon */}
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors group-hover:translate-y-0.5 transform duration-200" />
        </button>
      </div>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Copy Invite Link Button */}
        <button
          onClick={handleInviteClick}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-300 hover:from-amber-300 hover:to-emerald-300 text-zinc-950 shadow-[0_2px_14px_rgba(245,158,11,0.3)]'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>Invite</span>
            </>
          )}
        </button>

        {/* Change Theme Wallpaper */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 transition hover:border-white/20"
          title="Room Ambiance & Wallpaper Settings"
        >
          <Palette className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden md:inline">Theme</span>
        </button>

        {/* Chat Drawer toggle */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`relative p-2 md:px-2.5 rounded-xl border transition ${
            isChatOpen
              ? 'bg-white/[0.12] border-white/30 text-white'
              : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:border-white/20'
          }`}
          title="Toggle Chat"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Exit Room */}
        <button
          onClick={leaveRoom}
          className="p-2 md:px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
          title="Leave Room"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
