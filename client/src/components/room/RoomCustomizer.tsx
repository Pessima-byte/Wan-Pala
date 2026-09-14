import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import { ROOM_THEMES } from '../../utils/themes';
import { Palette, X, Lock, Unlock, Check, Sparkles } from 'lucide-react';

export const RoomCustomizer: React.FC = () => {
  const { room, isSettingsOpen, setIsSettingsOpen, updateRoomSettings, currentUser } = useRoom();

  const [roomName, setRoomName] = useState(room?.name || '');
  const [selectedTheme, setSelectedTheme] = useState(room?.backgroundTheme || 'lofi-cafe');
  const [isLocked, setIsLocked] = useState(room?.isLocked || false);
  const [passcode, setPasscode] = useState('');

  if (!isSettingsOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateRoomSettings({
      name: roomName,
      backgroundTheme: selectedTheme,
      isLocked,
      passcode: isLocked ? passcode : undefined
    });
    setIsSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-lounge-850 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Room Ambiance & Settings</h2>
              <p className="text-xs text-slate-400">Personalize the virtual wallpaper, layout, and privacy</p>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
          {/* Room Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder="E.g., Friday Movie Night Lounge"
              className="w-full bg-lounge-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Theme Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" /> Virtual Wallpaper Theme
            </label>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.values(ROOM_THEMES).map(theme => (
                <div
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`group relative rounded-2xl overflow-hidden border cursor-pointer transition-all aspect-video ${
                    selectedTheme === theme.id
                      ? 'border-brand-500 ring-2 ring-brand-500/50 shadow-lg'
                      : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/20'
                  }`}
                >
                  <img
                    src={theme.previewUrl}
                    alt={theme.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-2.5">
                    <span className="text-xs font-bold text-white leading-tight">{theme.name}</span>
                  </div>

                  {selectedTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Room Lock & Passcode */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isLocked ? <Lock className="w-5 h-5 text-amber-400" /> : <Unlock className="w-5 h-5 text-slate-400" />}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Room Access Protection</h4>
                  <p className="text-xs text-slate-400">Require a passcode for new visitors to enter</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isLocked ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 text-slate-300'
                }`}
              >
                {isLocked ? 'Passcode Enabled' : 'Public / Open'}
              </button>
            </div>

            {isLocked && (
              <input
                type="password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Enter room entry passcode..."
                className="w-full bg-lounge-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
