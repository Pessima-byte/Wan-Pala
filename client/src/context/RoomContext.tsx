import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { socket } from '../socket';
import { RoomData, User, ChatMessage, MediaState, AppType, WhiteboardStroke, CardGameState, ChessGameState } from '../types';
import { useWebRTC } from '../hooks/useWebRTC';

interface RoomContextType {
  room: RoomData | null;
  currentUser: User;
  connected: boolean;
  isInRoom: boolean;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAppLauncherOpen: boolean;
  setIsAppLauncherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isInviteOpen: boolean;
  setIsInviteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isYouTubeSearchOpen: boolean;
  setIsYouTubeSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isTheaterMode: boolean;
  setIsTheaterMode: React.Dispatch<React.SetStateAction<boolean>>;
  joinRoom: (roomId: string, user: { name: string; avatar: string; color: string }, passcode?: string, roomName?: string) => void;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  sendMediaAction: (type: 'play' | 'pause' | 'seek' | 'set-media' | 'queue-add' | 'queue-remove', data?: any) => void;
  setActiveApp: (appType: AppType) => void;
  sendWhiteboardStroke: (stroke: WhiteboardStroke) => void;
  undoWhiteboardStroke: () => void;
  clearWhiteboard: () => void;
  sendWhiteboardCursor: (coords: { x: number; y: number }) => void;
  sendCardAction: (type: 'deal' | 'reset' | 'hit' | 'fold' | 'bet', amount?: number) => void;
  sendChessSeat: (color: 'white' | 'black' | 'leave') => void;
  sendChessMove: (move: { from: string; to: string; promotion?: string }) => void;
  sendChessReset: (timeControl?: number) => void;
  sendChessResign: (color?: 'white' | 'black') => void;
  updateRoomSettings: (settings: { backgroundTheme?: string; name?: string; isLocked?: boolean; passcode?: string }) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  startCustomMediaStream: (stream: MediaStream) => Promise<boolean>;
  stopCustomMediaStream: () => Promise<void>;
  // WebRTC
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteScreenStreams: Record<string, MediaStream>;
  speakingUsers: Record<string, boolean>;
  syncAllRemoteStreams: () => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

const DEFAULT_AVATARS = ['🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦄', '🚀', '⭐', '🍕', '🎮', '🎧'];
const DEFAULT_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

function getInitialUser(): User {
  const savedName = localStorage.getItem('wanpala_user_name') || localStorage.getItem('kosmi_user_name') || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  const savedAvatar = localStorage.getItem('wanpala_user_avatar') || localStorage.getItem('kosmi_user_avatar') || DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  const savedColor = localStorage.getItem('wanpala_user_color') || localStorage.getItem('kosmi_user_color') || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
  // Use sessionStorage for user ID so each browser tab has a distinct user identity
  let savedId = sessionStorage.getItem('wanpala_user_id') || sessionStorage.getItem('kosmi_user_id');
  if (!savedId) {
    savedId = `usr_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('wanpala_user_id', savedId);
  }

  return {
    id: savedId,
    socketId: '',
    name: savedName,
    avatar: savedAvatar,
    color: savedColor,
    isHost: false,
    isMuted: false,
    isCameraOff: true,
    isScreenSharing: false,
  };
}

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(getInitialUser);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [connected, setConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);

  // UI state (open by default on desktop, closed on mobile to maximize stage visibility)
  const [isChatOpen, setIsChatOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isYouTubeSearchOpen, setIsYouTubeSearchOpen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // WebRTC Hook
  const {
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    speakingUsers,
    startLocalMedia,
    toggleCamera: rtcToggleCamera,
    startScreenShare,
    stopScreenShare,
    startCustomMediaStream,
    stopCustomMediaStream,
    callPeer,
    syncAllRemoteStreams
  } = useWebRTC({
    currentUserId: currentUser.id,
    isMuted: currentUser.isMuted,
    isCameraOff: currentUser.isCameraOff,
    onScreenShareEnded: () => {
      setCurrentUser(prev => ({ ...prev, isScreenSharing: false }));
      socket.emit('update-user-state', { isScreenSharing: false });
      socket.emit('set-active-app', { appType: 'none' });
    }
  });

  // Socket setup
  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      setConnected(true);
      console.log('[Socket] Connected to server');
    };

    const onDisconnect = () => {
      setConnected(false);
      console.log('[Socket] Disconnected');
    };

    const onRoomJoined = (data: { room: RoomData; currentUserId: string }) => {
      setRoom(data.room);
      setIsInRoom(true);
      setCurrentUser(prev => ({
        ...prev,
        isHost: data.room.users[data.currentUserId]?.isHost ?? false
      }));

      // Initiate WebRTC connections to existing users in room
      Object.keys(data.room.users).forEach(peerId => {
        if (peerId !== data.currentUserId) {
          callPeer(peerId);
        }
      });
    };

    const onUserJoined = (data: { user: User; users: Record<string, User> }) => {
      setRoom(prev => prev ? { ...prev, users: data.users } : null);
      // Joining user initiates call via onRoomJoined; avoiding duplicate glare
    };

    const onUserUpdated = (data: { user: User; users: Record<string, User> }) => {
      setRoom(prev => prev ? { ...prev, users: data.users } : null);
      if (data.user.id === currentUser.id) {
        setCurrentUser(prev => ({ ...prev, ...data.user }));
      }
    };

    const onUserLeft = (data: { userId: string; users: Record<string, User>; newHost?: User }) => {
      setRoom(prev => prev ? { ...prev, users: data.users } : null);
      if (data.newHost && data.newHost.id === currentUser.id) {
        setCurrentUser(prev => ({ ...prev, isHost: true }));
      }
    };

    const onChatMessage = (message: ChatMessage) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          chatMessages: [...prev.chatMessages, message]
        };
      });
    };

    const onChatUpdated = (data: { messages: ChatMessage[] }) => {
      setRoom(prev => prev ? { ...prev, chatMessages: data.messages } : null);
    };

    const onMediaUpdated = (data: { mediaState: MediaState; senderUserId: string }) => {
      setRoom(prev => prev ? { ...prev, mediaState: data.mediaState } : null);
    };

    const onActiveAppChanged = (data: { activeApp: AppType; mediaState: MediaState }) => {
      setRoom(prev => prev ? { ...prev, activeApp: data.activeApp, mediaState: data.mediaState } : null);
    };

    const onWhiteboardStroke = (stroke: WhiteboardStroke) => {
      setRoom(prev => prev ? { ...prev, whiteboardStrokes: [...prev.whiteboardStrokes, stroke] } : null);
    };

    const onWhiteboardCleared = () => {
      setRoom(prev => prev ? { ...prev, whiteboardStrokes: [] } : null);
    };

    const onWhiteboardStrokeRemoved = (data: { strokeId: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          whiteboardStrokes: prev.whiteboardStrokes.filter(s => s.id !== data.strokeId)
        };
      });
    };

    const onCardGameUpdated = (cardState: CardGameState) => {
      setRoom(prev => prev ? { ...prev, cardGameState: cardState } : null);
    };

    const onChessGameUpdated = (chessState: ChessGameState) => {
      setRoom(prev => prev ? { ...prev, chessGameState: chessState } : null);
    };

    const onRoomSettingsUpdated = (settings: { backgroundTheme?: string; name?: string; isLocked?: boolean }) => {
      setRoom(prev => prev ? { ...prev, ...settings } : null);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('user-joined', onUserJoined);
    socket.on('user-updated', onUserUpdated);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('chat-updated', onChatUpdated);
    socket.on('media-updated', onMediaUpdated);
    socket.on('active-app-changed', onActiveAppChanged);
    socket.on('whiteboard-stroke', onWhiteboardStroke);
    socket.on('whiteboard-stroke-removed', onWhiteboardStrokeRemoved);
    socket.on('whiteboard-cleared', onWhiteboardCleared);
    socket.on('card-game-updated', onCardGameUpdated);
    socket.on('chess-game-updated', onChessGameUpdated);
    socket.on('room-settings-updated', onRoomSettingsUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('user-joined', onUserJoined);
      socket.off('user-updated', onUserUpdated);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('chat-updated', onChatUpdated);
      socket.off('media-updated', onMediaUpdated);
      socket.off('active-app-changed', onActiveAppChanged);
      socket.off('whiteboard-stroke', onWhiteboardStroke);
      socket.off('whiteboard-stroke-removed', onWhiteboardStrokeRemoved);
      socket.off('whiteboard-cleared', onWhiteboardCleared);
      socket.off('card-game-updated', onCardGameUpdated);
      socket.off('chess-game-updated', onChessGameUpdated);
      socket.off('room-settings-updated', onRoomSettingsUpdated);
      socket.disconnect();
    };
  }, [callPeer, currentUser.id]);

  const joinRoom = useCallback((roomId: string, user: { name: string; avatar: string; color: string }, passcode?: string, roomName?: string) => {
    localStorage.setItem('wanpala_user_name', user.name);
    localStorage.setItem('wanpala_user_avatar', user.avatar);
    localStorage.setItem('wanpala_user_color', user.color);

    const updatedUser = {
      ...currentUser,
      name: user.name,
      avatar: user.avatar,
      color: user.color
    };
    setCurrentUser(updatedUser);

    socket.emit('join-room', {
      roomId,
      user: updatedUser,
      passcode,
      roomName
    });

    // Start background local audio track so user is ready to speak
    startLocalMedia(true, false);
  }, [currentUser, startLocalMedia]);

  const leaveRoom = useCallback(() => {
    socket.emit('leave-room');
    setRoom(null);
    setIsInRoom(false);
    window.history.pushState({}, '', '/');
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    socket.emit('send-chat', { text });
  }, []);

  const sendMediaAction = useCallback((type: 'play' | 'pause' | 'seek' | 'set-media' | 'queue-add' | 'queue-remove', data?: any) => {
    socket.emit('media-action', { type, data });
  }, []);

  const setActiveApp = useCallback((appType: AppType) => {
    socket.emit('set-active-app', { appType });
  }, []);

  const sendWhiteboardStroke = useCallback((stroke: WhiteboardStroke) => {
    socket.emit('whiteboard-stroke', stroke);
    setRoom(prev => prev ? { ...prev, whiteboardStrokes: [...prev.whiteboardStrokes, stroke] } : null);
  }, []);

  const undoWhiteboardStroke = useCallback(() => {
    socket.emit('whiteboard-undo');
    setRoom(prev => {
      if (!prev || !prev.whiteboardStrokes.length) return prev;
      const strokes = [...prev.whiteboardStrokes];
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].userId === currentUser.id) {
          strokes.splice(i, 1);
          return { ...prev, whiteboardStrokes: strokes };
        }
      }
      strokes.pop();
      return { ...prev, whiteboardStrokes: strokes };
    });
  }, [currentUser.id]);

  const clearWhiteboard = useCallback(() => {
    socket.emit('whiteboard-clear');
    setRoom(prev => prev ? { ...prev, whiteboardStrokes: [] } : null);
  }, []);

  const sendWhiteboardCursor = useCallback((coords: { x: number; y: number }) => {
    socket.emit('whiteboard-cursor', coords);
  }, []);

  const sendCardAction = useCallback((type: 'deal' | 'reset' | 'hit' | 'fold' | 'bet', amount?: number) => {
    socket.emit('card-action', { type, amount });
  }, []);

  const sendChessSeat = useCallback((color: 'white' | 'black' | 'leave') => {
    socket.emit('chess-seat', { color });
  }, []);

  const sendChessMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    socket.emit('chess-move', move);
  }, []);

  const sendChessReset = useCallback((timeControl?: number) => {
    socket.emit('chess-reset', { timeControl });
  }, []);

  const sendChessResign = useCallback((color?: 'white' | 'black') => {
    socket.emit('chess-resign', { color });
  }, []);

  const updateRoomSettings = useCallback((settings: { backgroundTheme?: string; name?: string; isLocked?: boolean; passcode?: string }) => {
    socket.emit('update-room-settings', settings);
  }, []);

  const toggleMute = useCallback(async () => {
    if (!localStream) {
      setCurrentUser(prev => ({ ...prev, isMuted: false }));
      socket.emit('update-user-state', { isMuted: false });
      await startLocalMedia(true, false);
      return;
    }

    const nextMuted = !currentUser.isMuted;
    setCurrentUser(prev => ({ ...prev, isMuted: nextMuted }));
    socket.emit('update-user-state', { isMuted: nextMuted });
    if (!nextMuted) {
      await startLocalMedia(true, false);
    }
  }, [currentUser.isMuted, localStream, startLocalMedia]);

  const toggleCamera = useCallback(async () => {
    const nextCameraOff = !currentUser.isCameraOff;
    setCurrentUser(prev => ({ ...prev, isCameraOff: nextCameraOff }));
    await rtcToggleCamera(!nextCameraOff);
    socket.emit('update-user-state', { isCameraOff: nextCameraOff });
  }, [currentUser.isCameraOff, rtcToggleCamera]);

  const toggleScreenShare = useCallback(async () => {
    if (currentUser.isScreenSharing) {
      stopScreenShare();
      setCurrentUser(prev => ({ ...prev, isScreenSharing: false }));
      socket.emit('update-user-state', { isScreenSharing: false });
      if (room?.activeApp === 'screenshare') {
        setActiveApp('none');
      }
    } else {
      const stream = await startScreenShare();
      if (stream) {
        setCurrentUser(prev => ({ ...prev, isScreenSharing: true }));
        socket.emit('update-user-state', { isScreenSharing: true });
        setActiveApp('screenshare');
      }
    }
  }, [currentUser.isScreenSharing, room?.activeApp, setActiveApp, startScreenShare, stopScreenShare]);

  const value = useMemo(() => ({
    room,
    currentUser,
    connected,
    isInRoom,
    isChatOpen,
    setIsChatOpen,
    isAppLauncherOpen,
    setIsAppLauncherOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isInviteOpen,
    setIsInviteOpen,
    isYouTubeSearchOpen,
    setIsYouTubeSearchOpen,
    isTheaterMode,
    setIsTheaterMode,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendMediaAction,
    setActiveApp,
    sendWhiteboardStroke,
    undoWhiteboardStroke,
    clearWhiteboard,
    sendWhiteboardCursor,
    sendCardAction,
    sendChessSeat,
    sendChessMove,
    sendChessReset,
    sendChessResign,
    updateRoomSettings,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    startCustomMediaStream,
    stopCustomMediaStream,
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    speakingUsers,
    syncAllRemoteStreams
  }), [
    room,
    currentUser,
    connected,
    isInRoom,
    isChatOpen,
    isAppLauncherOpen,
    isSettingsOpen,
    isInviteOpen,
    isYouTubeSearchOpen,
    isTheaterMode,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendMediaAction,
    setActiveApp,
    sendWhiteboardStroke,
    undoWhiteboardStroke,
    clearWhiteboard,
    sendWhiteboardCursor,
    sendCardAction,
    sendChessSeat,
    sendChessMove,
    sendChessReset,
    sendChessResign,
    updateRoomSettings,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    startCustomMediaStream,
    stopCustomMediaStream,
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    speakingUsers,
    syncAllRemoteStreams
  ]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

export const useRoom = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
