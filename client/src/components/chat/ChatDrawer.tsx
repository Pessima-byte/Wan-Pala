import React, { useState, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Send, Users, MessageSquare, X, Smile, Crown, MicOff, UserPlus } from 'lucide-react';
import confetti from 'canvas-confetti';

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '👏', '🎉', '🍿', '👾', '💯'];

export const ChatDrawer: React.FC = () => {
  const { room, currentUser, sendMessage, isChatOpen, setIsChatOpen, setIsInviteOpen } = useRoom();
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'people'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [room?.chatMessages]);

  if (!isChatOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleQuickEmoji = (emoji: string) => {
    sendMessage(emoji);
    if (emoji === '🎉' || emoji === '🔥') {
      confetti({ particleCount: 30, spread: 50, origin: { x: 0.85, y: 0.8 } });
    }
  };

  const usersList = Object.values(room?.users || {});

  return (
    <div className="fixed top-[54px] md:top-0 bottom-0 right-0 z-40 w-full sm:w-80 md:relative md:w-80 md:inset-auto md:z-20 h-[calc(100%-54px)] md:h-full bg-lounge-900/95 md:bg-lounge-900/90 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl transition-all duration-200">
      {/* Top Header */}
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between min-h-[56px] flex-shrink-0">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'chat' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'people' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> People ({usersList.length})
          </button>
        </div>

        <button
          onClick={() => setIsChatOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'chat' ? (
        /* Chat View */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {room?.chatMessages?.map(msg => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-slate-400">
                      {msg.senderAvatar} {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.senderId === currentUser.id;

              return (
                <div key={msg.id} className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: `${msg.senderColor || '#8b5cf6'}30` }}
                  >
                    {msg.senderAvatar}
                  </div>

                  <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-400">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                        isMe
                          ? 'bg-brand-600 text-white rounded-tr-none'
                          : 'bg-lounge-750 text-slate-200 border border-white/5 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reaction Emojis */}
          <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-between overflow-x-auto gap-1">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleQuickEmoji(emoji)}
                className="hover:scale-125 transition-transform p-1 text-sm select-none"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-lounge-900/50 flex items-center gap-2">
            <input
              type="text"
              placeholder="Send message to room..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 bg-lounge-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl transition shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        /* People in Room View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <button
            onClick={() => setIsInviteOpen(true)}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 neon-glow"
          >
            <UserPlus className="w-4 h-4" /> Invite Friends
          </button>

          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
            In this room ({usersList.length})
          </div>

          <div className="space-y-2">
            {usersList.map(u => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg shadow border border-white/10"
                    style={{ backgroundColor: `${u.color}35` }}
                  >
                    {u.avatar}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      {u.name} {u.id === currentUser.id && <span className="text-slate-400 font-normal">(You)</span>}
                      {u.isHost && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> Host
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {u.isMuted ? 'Muted' : 'Mic Active'}
                    </span>
                  </div>
                </div>

                {u.isMuted && (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>
            ))}
          </div>

          {usersList.length === 1 && (
            <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center">
              <span className="text-2xl mb-2 block">🛋️</span>
              <p className="text-xs font-semibold text-slate-300">You're the only one here!</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Share the link or invite friends to watch videos or play games together.
              </p>
              <button
                onClick={() => setIsInviteOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 transition"
              >
                <UserPlus className="w-3.5 h-3.5" /> Invite Someone
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
