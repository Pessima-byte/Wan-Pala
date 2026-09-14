import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import { copyToClipboard } from '../../utils/copy';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  Lock,
  MessageCircle,
  Send,
  Mail,
  ExternalLink,
  Sparkles,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const InviteModal: React.FC = () => {
  const { room, isInviteOpen, setIsInviteOpen } = useRoom();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isInviteOpen || !room) return null;

  const roomUrl = window.location.href;
  const roomCode = room.slug;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomUrl)}&bgcolor=13-13-17&color=255-255-255&margin=10`;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(roomUrl);
    if (success) {
      setCopiedLink(true);
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.6 }
      });
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    const success = await copyToClipboard(roomCode);
    if (success) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const shareText = `Join me in ${room.name} on WAN PALA! Watch videos, hang out and play games together: ${roomUrl}`;

  const shareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent(`Join me in ${room.name}!`)}`, '_blank');
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareEmail = () => {
    window.open(`mailto:?subject=${encodeURIComponent(`Join my room: ${room.name}`)}&body=${encodeURIComponent(shareText)}`);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-lounge-850 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Invite Friends to {room.name}
              </h2>
              <p className="text-xs text-slate-400">
                Anyone with the link can join instantly with zero signup
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInviteOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Room URL Share Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Direct Room Link</span>
              {room.isLocked && (
                <span className="text-amber-400 text-[11px] font-normal flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Password Protected
                </span>
              )}
            </label>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-lounge-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-mono truncate select-all">
                {roomUrl}
              </div>

              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-md whitespace-nowrap ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-brand-600 hover:bg-brand-500 text-white neon-glow'
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Room Slug Code & QR Code Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Room Code Card */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Room Code</span>
                <span className="text-xs font-mono font-bold text-slate-200">{roomCode}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* QR Code Toggle Button */}
            <button
              onClick={() => setShowQr(!showQr)}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between text-left ${
                showQr
                  ? 'bg-brand-600/20 border-brand-500/50 text-white'
                  : 'bg-white/5 border-white/5 hover:border-white/10 text-slate-300'
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mobile Scan</span>
                <span className="text-xs font-semibold">{showQr ? 'Hide QR Code' : 'Show QR Code'}</span>
              </div>
              <QrCode className="w-4 h-4 text-brand-400" />
            </button>
          </div>

          {/* QR Code Display (if toggled) */}
          {showQr && (
            <div className="p-4 rounded-2xl bg-lounge-900 border border-white/10 flex flex-col items-center justify-center text-center animate-fadeIn">
              <img
                src={qrCodeUrl}
                alt="Room QR Code"
                className="w-44 h-44 rounded-xl border border-white/10 shadow-lg p-2 bg-lounge-850"
              />
              <p className="text-[11px] text-slate-400 mt-2">
                Point your phone camera at this QR code to join this room instantly!
              </p>
            </div>
          )}

          {/* Quick Share to Messaging Apps */}
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Share to Apps
            </span>

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={shareWhatsApp}
                className="p-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[#25D366] text-xs font-medium flex flex-col items-center gap-1.5 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-[10px]">WhatsApp</span>
              </button>

              <button
                onClick={shareTelegram}
                className="p-2.5 rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/20 text-[#0088cc] text-xs font-medium flex flex-col items-center gap-1.5 transition"
              >
                <Send className="w-4 h-4" />
                <span className="text-[10px]">Telegram</span>
              </button>

              <button
                onClick={shareTwitter}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium flex flex-col items-center gap-1.5 transition"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-[10px]">Twitter / X</span>
              </button>

              <button
                onClick={shareEmail}
                className="p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-medium flex flex-col items-center gap-1.5 transition"
              >
                <Mail className="w-4 h-4" />
                <span className="text-[10px]">Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
