import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { Layers, RotateCcw, Coins, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

function renderCard(cardStr: string) {
  if (!cardStr) return null;
  const suit = cardStr.slice(-1);
  const value = cardStr.slice(0, -1);

  const isRed = suit === 'H' || suit === 'D';
  const suitIcon = suit === 'H' ? '♥' : suit === 'D' ? '♦' : suit === 'C' ? '♣' : '♠';

  return (
    <div className={`w-14 h-20 md:w-16 md:h-24 bg-white rounded-lg border-2 border-slate-300 shadow-xl flex flex-col justify-between p-1.5 select-none transition-transform hover:-translate-y-1 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
      <div className="text-xs font-bold leading-none">{value}</div>
      <div className="text-xl text-center leading-none">{suitIcon}</div>
      <div className="text-xs font-bold leading-none text-right">{value}</div>
    </div>
  );
}

export const CardTableStage: React.FC = () => {
  const { room, sendCardAction, currentUser } = useRoom();

  const gameState = room?.cardGameState;
  const myHand = gameState?.hands?.[currentUser.id] || [];
  const communityCards = gameState?.communityCards || [];

  const handleDeal = () => {
    sendCardAction('deal');
  };

  const handleReset = () => {
    sendCardAction('reset');
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

  return (
    <div className="flex flex-col w-full h-full p-3 md:p-6 max-w-6xl mx-auto items-center justify-center">
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full mb-4 bg-lounge-800/80 p-3 rounded-xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100">WAN PALA Card Lounge</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-semibold">
            <Coins className="w-4 h-4 text-amber-400" /> Pot: ${gameState?.pot || 0}
          </div>

          <button
            onClick={handleDeal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow"
          >
            Deal Card
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New Hand
          </button>
        </div>
      </div>

      {/* Poker Table (Felt Green Ellipse) */}
      <div className="relative w-full max-w-3xl aspect-[16/10] bg-emerald-850 rounded-[100px] border-8 border-amber-950/80 shadow-[inset_0_0_80px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.6)] flex flex-col items-center justify-between p-8 overflow-hidden">
        {/* Table Logo watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <span className="text-7xl font-extrabold tracking-widest text-emerald-300">LIVE POKER</span>
        </div>

        {/* Top / Other Players area */}
        <div className="flex items-center gap-4 z-10">
          {Object.values(room?.users || {})
            .filter(u => u.id !== currentUser.id)
            .map(u => (
              <div key={u.id} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-xl shadow">
                  {u.avatar}
                </div>
                <span className="text-[11px] font-medium text-emerald-200">{u.name}</span>
                {/* Face down cards representation */}
                <div className="flex -space-x-4">
                  <div className="w-6 h-9 rounded bg-blue-900 border border-white/20 shadow-sm" />
                  <div className="w-6 h-9 rounded bg-blue-900 border border-white/20 shadow-sm" />
                </div>
              </div>
            ))}
        </div>

        {/* Center Community Cards */}
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="flex items-center gap-2 md:gap-3 min-h-[96px]">
            {communityCards.length > 0 ? (
              communityCards.map((c, i) => <div key={i}>{renderCard(c)}</div>)
            ) : (
              <div className="text-emerald-200/50 text-xs font-medium border border-dashed border-emerald-400/30 px-6 py-4 rounded-xl">
                Click "New Hand" or "Deal Card" to begin
              </div>
            )}
          </div>
        </div>

        {/* Bottom / My Hand */}
        <div className="flex flex-col items-center gap-2 z-10">
          <div className="text-xs font-semibold text-emerald-200 bg-black/40 px-3 py-1 rounded-full border border-emerald-500/30">
            Your Hand ({currentUser.name})
          </div>
          <div className="flex items-center gap-2">
            {myHand.length > 0 ? (
              myHand.map((c, i) => <div key={i}>{renderCard(c)}</div>)
            ) : (
              <div className="text-emerald-300/60 text-xs">Waiting for deal...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
