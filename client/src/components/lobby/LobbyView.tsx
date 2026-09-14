import React, { useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import {
  Sparkles,
  ArrowRight,
  Tv,
  Gamepad2,
  Users,
  Film,
  Shuffle,
  Compass,
  Lock,
  Headphones,
  Plus
} from 'lucide-react';
import { apiUrl } from '../../config';

import confetti from 'canvas-confetti';

const AVATARS = ['🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦄', '🚀', '⭐', '🍕', '🎮', '🎧', '👾', '✨', '⚡'];
const COLORS = ['#10b981', '#34d399', '#06b6d4', '#3b82f6', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

export const LobbyView: React.FC = () => {
  const { currentUser, joinRoom } = useRoom();

  const [name, setName] = useState(currentUser.name);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [color, setColor] = useState(currentUser.color);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [mobileTab, setMobileTab] = useState<'create' | 'join'>('create');
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  // Interactive 3D tilt & cursor spotlight
  const handleMouseMoveCard = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6; // max 6 deg
    const rotateY = ((x - centerX) / centerX) * 6;

    setCardTilt({ rotateX, rotateY });
  };

  const handleMouseLeaveCard = () => {
    setCardTilt({ rotateX: 0, rotateY: 0 });
    setIsHoveringCard(false);
  };

  const handleGlobalMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#34d399', '#10b981', '#06b6d4', '#a7f3d0']
      });
    } catch (_) {}
  };

  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    triggerCelebration();
    const finalRoomName = newRoomName.trim() || `${name}'s Lounge`;
    try {
      const res = await fetch(apiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalRoomName })
      });
      const data = await res.json();
      window.history.pushState({}, '', `/room/${data.slug}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      joinRoom(data.slug, { name, avatar, color }, undefined, finalRoomName);
    } catch (e) {
      const randomSlug = `lounge-${Math.floor(100 + Math.random() * 900)}`;
      window.history.pushState({}, '', `/room/${randomSlug}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      joinRoom(randomSlug, { name, avatar, color }, undefined, finalRoomName);
    }
  };

  const handleJoin = (slug: string) => {
    if (!slug.trim()) return;
    const cleanSlug = slug.replace(/^.*\/room\//, '').trim();
    window.history.pushState({}, '', `/room/${cleanSlug}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    joinRoom(cleanSlug, { name, avatar, color }, passcode);
  };

  const randomizeAvatar = () => {
    setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  return (
    <div
      onMouseMove={handleGlobalMouseMove}
      className="w-full h-screen overflow-hidden flex flex-col justify-between bg-[#060b09] text-slate-100 relative select-none selection:bg-emerald-500/30 selection:text-emerald-200"
    >
      {/* Interactive Cursor Spotlight */}
      <div
        className="fixed pointer-events-none rounded-full w-[450px] h-[450px] bg-emerald-500/[0.04] blur-[100px] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 z-0"
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
      />

      {/* Aurora Ambient Background Lighting & Subtle Tech Dot Grid with Gold Accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-emerald-grid opacity-30" />
        <div className="absolute inset-0 bg-geo-pattern opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-gradient-to-b from-amber-500/10 via-emerald-500/12 to-transparent blur-[140px] rounded-full animate-aurora-slow" />
        <div className="absolute top-1/4 -left-40 w-[450px] h-[450px] bg-emerald-600/[0.1] blur-[150px] rounded-full animate-aurora-reverse" />
        <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] bg-amber-500/[0.08] blur-[150px] rounded-full animate-aurora-slow" />
      </div>

      {/* DESKTOP Header - Exactly unchanged for md+ screens */}
      <header className="hidden md:flex absolute top-0 inset-x-0 px-6 sm:px-10 pt-3 pb-1 w-full items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-4 group cursor-pointer select-none pointer-events-auto">
          {/* Popping 3D Emblem with Kinetic Aura & Holographic Orbital Ring */}
          <div className="relative flex items-center justify-center animate-logo-float">
            {/* Layer 1: Ambient Wide Nebula Glow */}
            <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-emerald-500/25 via-teal-400/20 to-emerald-600/25 blur-3xl opacity-80 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Layer 2: Radiant Golden-Emerald Core Halo */}
            <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400/30 via-emerald-400/35 to-teal-300/25 blur-xl animate-pulse-glow pointer-events-none" />

            {/* Main Floating 3D Emblem Container */}
            <div className="relative overflow-hidden rounded-[26px] p-1 transition-all duration-300 group-hover:scale-105">
              <img
                src="/wan-pala-logo.png"
                alt="WAN PALA Logo"
                className="relative w-[118px] h-[118px] object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.9)] drop-shadow-[0_0_30px_rgba(16,185,129,0.5)] filter brightness-110 contrast-105 transition-all duration-300 group-hover:drop-shadow-[0_0_45px_rgba(16,185,129,0.75)]"
              />

              {/* Holographic Sheen Sweep across the emblem */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[26px]">
                <div className="w-full h-36 bg-gradient-to-b from-transparent via-white/[0.18] to-transparent animate-sheen-sweep" />
              </div>
            </div>

            {/* Live Indicator Dot with Ripple */}
            <div className="absolute top-1.5 right-1.5 flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_10px_#10b981]"></span>
            </div>
          </div>
        </div>

        {/* Right header quick telemetry / status chip */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-amber-500/20 backdrop-blur-md shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs font-medium text-zinc-300">Wan Pala Mesh</span>
            <span className="text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25">Live</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. MOBILE NATIVE-FEEL LAYOUT (< md) - ZERO-SCROLL FIXED APP SHELL         */}
      {/* ========================================================================= */}
      <div className="flex md:hidden flex-col h-full h-[100dvh] max-h-screen w-full px-4 pt-2.5 pb-3 z-10 select-none justify-between overflow-hidden">
        {/* Mobile Top Navigation Bar */}
        <div className="flex items-center justify-between w-full pb-2 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center p-0.5 shadow-md">
              <img src="/wan-pala-logo.png" alt="WAN PALA" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-black tracking-widest text-amber-400 font-mono">WAN PALA</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-emerald-500/30 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-300">Live Mesh</span>
          </div>
        </div>

        {/* Mobile Hero Header */}
        <div className="flex flex-col items-center text-center my-auto flex-shrink-0 py-1">
          <div className="relative flex items-center justify-center mb-1.5">
            <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-400/25 via-emerald-400/30 to-teal-400/20 blur-xl opacity-90" />
            <div className="relative overflow-hidden rounded-2xl p-1 shadow-2xl">
              <img
                src="/wan-pala-logo.png"
                alt="WAN PALA"
                className="w-20 h-20 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] filter brightness-110"
              />
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div className="w-full h-24 bg-gradient-to-b from-transparent via-white/[0.2] to-transparent animate-sheen-sweep" />
              </div>
            </div>
            <div className="absolute top-1 right-1 flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[9px] font-extrabold text-amber-300 tracking-wider uppercase mb-1">
            Krio Virtual Lounge
          </span>

          <h1 className="text-xl font-black text-white tracking-tight leading-tight">
            Watch & Play <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200 bg-clip-text text-transparent">Together</span>
          </h1>
          <p className="text-[11px] text-zinc-400 max-w-xs leading-tight mt-0.5">
            Sync YouTube, movies, chess & crystal-clear voice chat.
          </p>
        </div>

        {/* Mobile Segmented Action Card */}
        <div className="w-full max-w-sm mx-auto bg-[#0a1411]/92 backdrop-blur-2xl p-3.5 rounded-3xl border border-emerald-500/25 shadow-[0_16px_36px_rgba(0,0,0,0.7),0_0_30px_rgba(16,185,129,0.1)] flex-shrink-0 my-auto">
          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-black/60 border border-white/10 rounded-2xl mb-3">
            <button
              type="button"
              onClick={() => setMobileTab('create')}
              className={`py-1.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileTab === 'create'
                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400 text-zinc-950 shadow-md scale-[1.02]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Create Lounge
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('join')}
              className={`py-1.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileTab === 'join'
                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400 text-zinc-950 shadow-md scale-[1.02]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" /> Join by Code
            </button>
          </div>

          {/* Profile Row (Active in both modes so user has name & avatar) */}
          <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-white/[0.08]">
            <div
              onClick={randomizeAvatar}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl border border-amber-500/30 cursor-pointer hover:border-amber-400 active:scale-95 transition-all flex-shrink-0 shadow-inner"
              style={{ backgroundColor: `${color}25` }}
              title="Tap avatar to shuffle"
            >
              {avatar}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your display name..."
                className="w-full bg-black/50 border border-emerald-500/25 focus:border-amber-400/70 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white placeholder-zinc-500 focus:outline-none transition shadow-inner"
              />
              <div className="flex items-center gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="p-0.5 rounded-full flex items-center justify-center cursor-pointer active:scale-90"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full transition-all block ${
                        color === c ? 'scale-125 ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0a1411]' : 'opacity-60'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab Content: Create Lounge */}
          {mobileTab === 'create' && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Lounge name (e.g. VIP Cinema)..."
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                className="w-full bg-black/50 border border-emerald-500/25 focus:border-amber-400/70 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition shadow-inner"
              />

              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-300 hover:from-amber-300 hover:to-emerald-300 text-zinc-950 font-black text-xs tracking-wide shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5 shimmer-button"
              >
                <Sparkles className="w-3.5 h-3.5" /> Launch Lounge Now
              </button>
            </div>
          )}

          {/* Tab Content: Join Lounge */}
          {mobileTab === 'join' && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Enter room code or link..."
                value={roomCode}
                onChange={e => setRoomCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin(roomCode)}
                className="w-full bg-black/50 border border-emerald-500/25 focus:border-amber-400/70 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition shadow-inner"
              />

              <button
                type="button"
                onClick={() => handleJoin(roomCode)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-zinc-950 font-black text-xs tracking-wide shadow-[0_4px_16px_rgba(16,185,129,0.3)] active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Enter Lounge
              </button>
            </div>
          )}
        </div>

        {/* Mobile 2x2 Feature Cards - Sleek & Visual */}
        <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm mx-auto flex-shrink-0 my-auto">
          <div className="p-2 rounded-xl bg-[#0a1411]/80 border border-emerald-500/20 flex items-center gap-2 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
              <Tv className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-white truncate">YouTube Party</h4>
              <p className="text-[9px] text-zinc-400 truncate">Synced 4K video</p>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#0a1411]/80 border border-emerald-500/20 flex items-center gap-2 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Film className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-white truncate">Local Movies</h4>
              <p className="text-[9px] text-zinc-400 truncate">Direct P2P stream</p>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#0a1411]/80 border border-emerald-500/20 flex items-center gap-2 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-white truncate">Chess & Arcade</h4>
              <p className="text-[9px] text-zinc-400 truncate">1v1 & puzzles</p>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#0a1411]/80 border border-emerald-500/20 flex items-center gap-2 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-300 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-white truncate">Voice & Cams</h4>
              <p className="text-[9px] text-zinc-400 truncate">Mesh audio room</p>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="text-center text-[10px] text-emerald-200/40 flex-shrink-0 pt-1">
          WAN PALA &bull; Private Peer-to-Peer Lounge
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PC / DESKTOP LAYOUT (md+) - 100% UNTOUCHED & INTACT                     */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-col h-screen justify-between w-full relative z-10">
        {/* Desktop Header */}
        <header className="absolute top-0 inset-x-0 px-6 sm:px-10 pt-3 pb-1 w-full flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center gap-4 group cursor-pointer select-none pointer-events-auto">
            <div className="relative flex items-center justify-center animate-logo-float">
              <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-emerald-500/25 via-teal-400/20 to-emerald-600/25 blur-3xl opacity-80 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400/30 via-emerald-400/35 to-teal-300/25 blur-xl animate-pulse-glow pointer-events-none" />

              <div className="relative overflow-hidden rounded-[26px] p-1 transition-all duration-300 group-hover:scale-105">
                <img
                  src="/wan-pala-logo.png"
                  alt="WAN PALA Logo"
                  className="relative w-[118px] h-[118px] object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.9)] drop-shadow-[0_0_30px_rgba(16,185,129,0.5)] filter brightness-110 contrast-105 transition-all duration-300 group-hover:drop-shadow-[0_0_45px_rgba(16,185,129,0.75)]"
                />
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[26px]">
                  <div className="w-full h-36 bg-gradient-to-b from-transparent via-white/[0.18] to-transparent animate-sheen-sweep" />
                </div>
              </div>

              <div className="absolute top-1.5 right-1.5 flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_10px_#10b981]"></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-amber-500/20 backdrop-blur-md shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-xs font-medium text-zinc-300">Wan Pala Mesh</span>
              <span className="text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25">Live</span>
            </div>
          </div>
        </header>

        {/* Desktop Main Container */}
        <main className="max-w-4xl mx-auto px-6 pt-11 pb-2 flex-1 flex flex-col items-center justify-between z-10 w-full min-h-0">
          <div className="text-center max-w-2xl mt-2 mb-3 animate-float">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 mb-2.5 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Krio Hangout & Cinema Lounge
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-[2.6rem] font-bold tracking-tight text-white mb-1.5 leading-[1.12]">
              Watch together. <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200 bg-clip-text text-transparent">
                No installs, pure sync.
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-lg mx-auto leading-relaxed">
              Stream YouTube, synced 4K local movies, arcade retro games, and crystal-clear voice chat right in your browser.
            </p>
          </div>

          <div
            onMouseEnter={() => setIsHoveringCard(true)}
            onMouseMove={handleMouseMoveCard}
            onMouseLeave={handleMouseLeaveCard}
            style={{
              transform: isHoveringCard
                ? `perspective(1000px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg) scale3d(1.02, 1.02, 1.02)`
                : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
              transition: isHoveringCard ? 'transform 0.1s ease-out' : 'transform 0.4s ease-out'
            }}
            className="w-full max-w-[620px] bg-[#0a1411]/92 backdrop-blur-2xl p-7 sm:p-9 rounded-3xl border border-emerald-500/25 shadow-[0_25px_55px_rgba(0,0,0,0.8),0_0_45px_rgba(245,158,11,0.12)] mb-3 sm:mb-4 transition-shadow duration-300 hover:border-amber-400/40 hover:shadow-[0_30px_65px_rgba(0,0,0,0.85),0_0_55px_rgba(245,158,11,0.22)] relative group"
          >
            <div className="mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-white/[0.08]">
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <span className="text-xs sm:text-base font-bold text-amber-200/90 tracking-wide">
                  Your Profile
                </span>
                <button
                  type="button"
                  onClick={randomizeAvatar}
                  className="text-xs sm:text-sm text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer active:scale-95 font-medium"
                >
                  <Shuffle className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" /> Randomize
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div
                  onClick={randomizeAvatar}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl border border-amber-500/30 cursor-pointer hover:border-amber-400/70 hover:scale-105 active:scale-95 transition-all flex-shrink-0 shadow-inner"
                  style={{ backgroundColor: `${color}25` }}
                  title="Click to randomize"
                >
                  {avatar}
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your display name..."
                    className="w-full bg-black/40 border border-emerald-500/25 focus:border-amber-400/60 rounded-xl px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white placeholder-zinc-500 focus:outline-none focus:bg-black/60 transition shadow-inner"
                  />
                  <div className="flex items-center gap-2.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-4 h-4 rounded-full transition-all ${
                          color === c ? 'scale-125 ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0a1411]' : 'opacity-60 hover:opacity-100 hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-amber-200/90 mb-1.5">
                  Room Name
                </label>
                <input
                  type="text"
                  placeholder="E.g. VIP Cinema, Game Night, Chillout..."
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                  className="w-full bg-black/40 border border-emerald-500/25 focus:border-amber-400/60 rounded-xl px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:bg-black/60 transition shadow-inner"
                />
              </div>

              <button
                onClick={handleCreateRoom}
                className="w-full py-3.5 sm:py-4 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-300 hover:from-amber-300 hover:to-emerald-300 text-zinc-950 font-black text-sm sm:text-base tracking-wide transition-all duration-200 transform active:scale-[0.98] hover:scale-[1.01] flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(245,158,11,0.35)] cursor-pointer shimmer-button"
              >
                <Plus className="w-4 h-4 text-zinc-950 stroke-[3]" /> Create & Enter Room
              </button>

              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-white/[0.08] w-full" />
                <span className="bg-[#0a1411] px-3 text-[10px] font-bold text-amber-400/90 tracking-wider absolute">
                  OR JOIN EXISTING
                </span>
              </div>

              <div className="flex gap-2.5">
                <input
                  type="text"
                  placeholder="Enter room code or link"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin(roomCode)}
                  className="flex-1 bg-black/40 border border-emerald-500/25 focus:border-amber-400/60 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition"
                />
                <button
                  onClick={() => handleJoin(roomCode)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-500/35 text-amber-200 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  Join <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full max-w-4xl">
            <div className="p-4 sm:p-4.5 min-h-[108px] sm:min-h-[116px] rounded-2xl bg-[#0a1411]/75 border border-emerald-500/20 hover:border-red-500/50 hover:bg-[#0f1d19]/90 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5),0_0_20px_rgba(239,68,68,0.2)] transition-all duration-300 flex flex-col justify-between group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-red-500/25 transition-all duration-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-[13px] text-white group-hover:text-red-300 transition-colors mb-0.5">YouTube Watch Party</h4>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed line-clamp-2">
                  Frame-accurate synchronized playback with shared playlists.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-4.5 min-h-[108px] sm:min-h-[116px] rounded-2xl bg-[#0a1411]/75 border border-emerald-500/20 hover:border-emerald-400/50 hover:bg-[#0f1d19]/90 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.2)] transition-all duration-300 flex flex-col justify-between group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/25 transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-[13px] text-white group-hover:text-emerald-300 transition-colors mb-0.5">Local Video Sync</h4>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed line-clamp-2">
                  Stream movies from your desktop with zero cloud upload.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-4.5 min-h-[108px] sm:min-h-[116px] rounded-2xl bg-[#0a1411]/75 border border-emerald-500/20 hover:border-teal-400/50 hover:bg-[#0f1d19]/90 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5),0_0_20px_rgba(20,184,166,0.2)] transition-all duration-300 flex flex-col justify-between group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-teal-500/25 transition-all duration-300 shadow-[0_0_12px_rgba(20,184,166,0.2)]">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-[13px] text-white group-hover:text-teal-300 transition-colors mb-0.5">WebRTC Video & Audio</h4>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed line-clamp-2">
                  Ultra-low latency mesh voice, HD webcams, and screen sharing.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-4.5 min-h-[108px] sm:min-h-[116px] rounded-2xl bg-[#0a1411]/75 border border-emerald-500/20 hover:border-amber-400/50 hover:bg-[#0f1d19]/90 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5),0_0_20px_rgba(245,158,11,0.2)] transition-all duration-300 flex flex-col justify-between group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/25 transition-all duration-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-[13px] text-white group-hover:text-amber-300 transition-colors mb-0.5">Retro Arcade & Cards</h4>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed line-clamp-2">
                  Play classic multiplayer titles and card games with friends.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Desktop Footer */}
        <footer className="h-10 border-t border-emerald-500/10 px-6 max-w-6xl mx-auto w-full flex items-center justify-between text-[11px] text-emerald-200/50 flex-shrink-0">
          <div>WAN PALA &bull; Private Virtual Lounge</div>
          <div className="flex items-center gap-4">
            <span>Peer-to-Peer</span>
            <span>Zero Signups</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
