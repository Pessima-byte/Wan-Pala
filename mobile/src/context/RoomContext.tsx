import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, updateSocketUrl } from '../services/socket';
import { RoomData, User, ChatMessage, AppType, MediaState, WhiteboardStroke } from '../types';

interface RoomContextType {
  socket: Socket;
  room: RoomData | null;
  currentUser: User;
  connected: boolean;
  isInRoom: boolean;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isAppLauncherOpen: boolean;
  setIsAppLauncherOpen: (open: boolean) => void;
  isYouTubeSearchOpen: boolean;
  setIsYouTubeSearchOpen: (open: boolean) => void;
  isThemeModalOpen: boolean;
  setIsThemeModalOpen: (open: boolean) => void;
  joinRoom: (roomSlug: string, userName: string, avatar?: string, roomName?: string, passcode?: string) => Promise<boolean>;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  sendMediaAction: (type: 'play' | 'pause' | 'seek' | 'set-media' | 'queue-add' | 'queue-remove', data?: any) => void;
  setActiveApp: (appType: AppType) => void;
  updateRoomSettings: (settings: { backgroundTheme?: string; name?: string; isLocked?: boolean }) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  sendWhiteboardStroke: (stroke: WhiteboardStroke) => void;
  undoWhiteboardStroke: () => void;
  clearWhiteboard: () => void;
  speakingUsers: Record<string, boolean>;
  setSpeakingUsers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const DEFAULT_USER: User = {
  id: 'mobile-user-' + Math.random().toString(36).substring(2, 8),
  socketId: '',
  name: 'Mobile Guest',
  avatar: '📱',
  isHost: false,
  isMuted: true,
  isCameraOff: true,
  isScreenSharing: false,
  color: '#6366f1',
};

const RoomContext = createContext<RoomContextType | null>(null);

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [connected, setConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [serverUrl, setServerUrlState] = useState('https://wan-pala.onrender.com');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [isYouTubeSearchOpen, setIsYouTubeSearchOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({});

  const socketRef = useRef<Socket>(getSocket(serverUrl));

  const setServerUrl = (url: string) => {
    setServerUrlState(url);
    socketRef.current = updateSocketUrl(url);
  };

  useEffect(() => {
    const socket = socketRef.current;
    socket.connect();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onRoomJoined = (data: { room: RoomData; currentUserId: string }) => {
      setRoom(data.room);
      setIsInRoom(true);
      setCurrentUser(prev => ({
        ...prev,
        id: data.currentUserId,
        isHost: data.room.users[data.currentUserId]?.isHost ?? false,
      }));
    };

    const onUserJoined = (data: { user: User; users: Record<string, User> }) => {
      setRoom(prev => (prev ? { ...prev, users: data.users } : null));
    };

    const onUserUpdated = (data: { user: User; users: Record<string, User> }) => {
      setRoom(prev => (prev ? { ...prev, users: data.users } : null));
      if (data.user.id === currentUser.id) {
        setCurrentUser(prev => ({ ...prev, ...data.user }));
      }
    };

    const onUserLeft = (data: { userId: string; users: Record<string, User>; newHost?: User }) => {
      setRoom(prev => (prev ? { ...prev, users: data.users } : null));
      if (data.newHost && data.newHost.id === currentUser.id) {
        setCurrentUser(prev => ({ ...prev, isHost: true }));
      }
    };

    const onChatMessage = (message: ChatMessage) => {
      setRoom(prev => (prev ? { ...prev, chatMessages: [...prev.chatMessages, message] } : null));
    };

    const onChatUpdated = (data: { messages: ChatMessage[] }) => {
      setRoom(prev => (prev ? { ...prev, chatMessages: data.messages } : null));
    };

    const onMediaUpdated = (data: { mediaState: MediaState }) => {
      setRoom(prev => (prev ? { ...prev, mediaState: data.mediaState } : null));
    };

    const onActiveAppChanged = (data: { activeApp: AppType; mediaState: MediaState }) => {
      setRoom(prev => (prev ? { ...prev, activeApp: data.activeApp, mediaState: data.mediaState } : null));
    };

    const onRoomSettingsUpdated = (settings: { backgroundTheme?: string; name?: string; isLocked?: boolean }) => {
      setRoom(prev => (prev ? { ...prev, ...settings } : null));
    };

    const onWhiteboardStroke = (stroke: WhiteboardStroke) => {
      setRoom(prev => (prev ? { ...prev, whiteboardStrokes: [...(prev.whiteboardStrokes || []), stroke] } : null));
    };

    const onWhiteboardCleared = () => {
      setRoom(prev => (prev ? { ...prev, whiteboardStrokes: [] } : null));
    };

    const onWhiteboardStrokeRemoved = (data: { strokeId: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          whiteboardStrokes: (prev.whiteboardStrokes || []).filter(s => s.id !== data.strokeId),
        };
      });
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
    socket.on('room-settings-updated', onRoomSettingsUpdated);
    socket.on('whiteboard-stroke', onWhiteboardStroke);
    socket.on('whiteboard-stroke-removed', onWhiteboardStrokeRemoved);
    socket.on('whiteboard-cleared', onWhiteboardCleared);

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
      socket.off('room-settings-updated', onRoomSettingsUpdated);
      socket.off('whiteboard-stroke', onWhiteboardStroke);
      socket.off('whiteboard-stroke-removed', onWhiteboardStrokeRemoved);
      socket.off('whiteboard-cleared', onWhiteboardCleared);
    };
  }, [currentUser.id]);

  const joinRoom = useCallback(
    (roomSlug: string, userName: string, avatar?: string, roomName?: string, passcode?: string): Promise<boolean> => {
      return new Promise(resolve => {
        const socket = socketRef.current;
        const targetRoom = (roomSlug || '').trim().toLowerCase();
        const userPayload = {
          id: currentUser.id || ('mobile-user-' + Math.random().toString(36).substring(2, 8)),
          name: userName || currentUser.name || 'Mobile Guest',
          avatar: avatar || currentUser.avatar || '📱',
          color: currentUser.color || '#6366f1',
          isMuted: currentUser.isMuted,
          isCameraOff: currentUser.isCameraOff,
        };

        let isDone = false;
        let timeoutId: any;

        const cleanup = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timeoutId);
          socket.off('room-joined', handleSuccess);
          socket.off('error-message', handleError);
          socket.off('connect_error', handleConnectError);
        };

        const handleSuccess = () => {
          cleanup();
          resolve(true);
        };

        const handleError = (data: any) => {
          console.warn('[RoomContext] Error from server during join:', data);
          cleanup();
          resolve(false);
        };

        const handleConnectError = (err: any) => {
          console.warn('[RoomContext] Socket connect error during join:', err);
        };

        socket.once('room-joined', handleSuccess);
        socket.once('error-message', handleError);
        socket.on('connect_error', handleConnectError);

        // Allow up to 25 seconds for Render spin-up cold start
        timeoutId = setTimeout(() => {
          console.warn('[RoomContext] Join room timed out after 25s for:', targetRoom);
          cleanup();
          resolve(false);
        }, 25000);

        const emitJoin = () => {
          socket.emit('join-room', {
            roomId: targetRoom,
            roomSlug: targetRoom,
            user: userPayload,
            roomName: roomName?.trim() || undefined,
            passcode: passcode?.trim() || undefined,
          });
        };

        if (socket.connected) {
          emitJoin();
        } else {
          socket.connect();
          socket.once('connect', emitJoin);
        }
      });
    },
    [currentUser]
  );

  const leaveRoom = useCallback(() => {
    socketRef.current.emit('leave-room');
    setRoom(null);
    setIsInRoom(false);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    socketRef.current.emit('send-chat', { text });
  }, []);

  const sendMediaAction = useCallback((type: string, data?: any) => {
    socketRef.current.emit('media-action', { type, data });
  }, []);

  const setActiveApp = useCallback((appType: AppType) => {
    socketRef.current.emit('set-active-app', { appType });
  }, []);

  const updateRoomSettings = useCallback((settings: { backgroundTheme?: string; name?: string; isLocked?: boolean }) => {
    socketRef.current.emit('update-room-settings', settings);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !currentUser.isMuted;
    setCurrentUser(prev => ({ ...prev, isMuted: next }));
    socketRef.current.emit('update-user-state', { isMuted: next });
  }, [currentUser.isMuted]);

  const toggleCamera = useCallback(() => {
    const next = !currentUser.isCameraOff;
    setCurrentUser(prev => ({ ...prev, isCameraOff: next }));
    socketRef.current.emit('update-user-state', { isCameraOff: next });
  }, [currentUser.isCameraOff]);

  const sendWhiteboardStroke = useCallback((stroke: WhiteboardStroke) => {
    socketRef.current.emit('whiteboard-stroke', stroke);
    setRoom(prev => (prev ? { ...prev, whiteboardStrokes: [...(prev.whiteboardStrokes || []), stroke] } : null));
  }, []);

  const undoWhiteboardStroke = useCallback(() => {
    socketRef.current.emit('whiteboard-undo');
    setRoom(prev => {
      if (!prev || !prev.whiteboardStrokes?.length) return prev;
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
    socketRef.current.emit('whiteboard-clear');
    setRoom(prev => (prev ? { ...prev, whiteboardStrokes: [] } : null));
  }, []);

  return (
    <RoomContext.Provider
      value={{
        socket: socketRef.current,
        room,
        currentUser,
        connected,
        isInRoom,
        serverUrl,
        setServerUrl,
        isChatOpen,
        setIsChatOpen,
        isAppLauncherOpen,
        setIsAppLauncherOpen,
        isYouTubeSearchOpen,
        setIsYouTubeSearchOpen,
        isThemeModalOpen,
        setIsThemeModalOpen,
        joinRoom,
        leaveRoom,
        sendMessage,
        sendMediaAction,
        setActiveApp,
        updateRoomSettings,
        toggleMute,
        toggleCamera,
        sendWhiteboardStroke,
        undoWhiteboardStroke,
        clearWhiteboard,
        speakingUsers,
        setSpeakingUsers,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
