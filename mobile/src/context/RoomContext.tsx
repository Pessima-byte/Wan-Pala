import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, updateSocketUrl } from '../services/socket';
import { RoomData, User, ChatMessage, AppType, MediaState } from '../types';

interface RoomContextType {
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
  joinRoom: (roomSlug: string, userName: string, avatar?: string) => Promise<boolean>;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  sendMediaAction: (type: 'play' | 'pause' | 'seek' | 'set-media' | 'queue-add' | 'queue-remove', data?: any) => void;
  setActiveApp: (appType: AppType) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
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
    };
  }, [currentUser.id]);

  const joinRoom = useCallback(
    (roomSlug: string, userName: string, avatar?: string): Promise<boolean> => {
      return new Promise(resolve => {
        const socket = socketRef.current;
        const userPayload = {
          name: userName || 'Mobile Guest',
          avatar: avatar || '📱',
          isMuted: currentUser.isMuted,
          isCameraOff: currentUser.isCameraOff,
        };

        socket.emit('join-room', {
          roomSlug: roomSlug.trim().toLowerCase(),
          user: userPayload,
        });

        const handleSuccess = () => {
          socket.off('room-joined', handleSuccess);
          resolve(true);
        };

        socket.once('room-joined', handleSuccess);
        setTimeout(() => resolve(false), 8000);
      });
    },
    [currentUser.isMuted, currentUser.isCameraOff]
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

  return (
    <RoomContext.Provider
      value={{
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
        joinRoom,
        leaveRoom,
        sendMessage,
        sendMediaAction,
        setActiveApp,
        toggleMute,
        toggleCamera,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
