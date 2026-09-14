import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { RoomManager, generateRoomSlug } from './roomManager.js';
import { User, AppType, WhiteboardStroke } from './types.js';

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'] : '*';

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const roomManager = new RoomManager();

// Track user socket mappings: socket.id -> { roomId, userId }
const socketUserMap = new Map<string, { roomId: string; userId: string }>();

// API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/youtube/search', async (req, res) => {
  const query = (req.query.q as string)?.trim();
  if (!query) {
    return res.json([]);
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await response.text();
    const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (!jsonMatch) {
      return res.json([]);
    }

    const parsed = JSON.parse(jsonMatch[1]);
    const contents = parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const videos: Array<{
      id: string;
      title: string;
      channel: string;
      duration: string;
      thumbnail: string;
      url: string;
    }> = [];

    for (const item of contents) {
      const v = item.videoRenderer;
      if (v && v.videoId) {
        videos.push({
          id: v.videoId,
          title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'YouTube Video',
          channel: v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'Channel',
          duration: v.lengthText?.simpleText || 'LIVE',
          thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${v.videoId}`
        });
      }
      if (videos.length >= 24) break;
    }

    res.json(videos);
  } catch (err: any) {
    console.error('[YouTube Search Error]', err?.message || err);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// Lichess Puzzle API proxy
app.get('/api/puzzle/next', async (req, res) => {
  try {
    const response = await fetch('https://lichess.org/api/puzzle/next', {
      headers: { 'User-Agent': 'WAN-PALA-Lounge' }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch puzzle from Lichess' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('[Puzzle Fetch Error]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to fetch puzzle' });
  }
});

app.get('/api/puzzle/daily', async (req, res) => {
  try {
    const response = await fetch('https://lichess.org/api/puzzle/daily', {
      headers: { 'User-Agent': 'WAN-PALA-Lounge' }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch daily puzzle from Lichess' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('[Daily Puzzle Fetch Error]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to fetch daily puzzle' });
  }
});

app.get('/api/rooms', (req, res) => {
  res.json(roomManager.listPublicRooms());
});

app.post('/api/rooms', (req, res) => {
  const { name, customSlug } = req.body;
  const slug = customSlug?.trim() ? customSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '-') : generateRoomSlug();
  const room = roomManager.getOrCreateRoom(slug, name);
  res.json({ id: room.id, slug: room.slug, name: room.name });
});

app.get('/api/rooms/:slug', (req, res) => {
  const room = roomManager.getRoom(req.params.slug);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    id: room.id,
    slug: room.slug,
    name: room.name,
    isLocked: room.isLocked,
    userCount: Object.keys(room.users).length,
    theme: room.backgroundTheme,
    activeApp: room.activeApp
  });
});

// Socket.io Real-time Event Handlers
io.on('connection', (socket: Socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Join Room
  socket.on('join-room', (payload: { roomId: string; user: Omit<User, 'socketId' | 'isHost'>; passcode?: string; roomName?: string }) => {
    const { roomId, user: userData, passcode, roomName } = payload;
    const room = roomManager.getOrCreateRoom(roomId, roomName?.trim() || undefined);

    if (room.isLocked && room.passcode && room.passcode !== passcode) {
      socket.emit('error-message', { message: 'Incorrect room passcode.' });
      return;
    }

    const user: User = {
      ...userData,
      socketId: socket.id,
      isHost: Object.keys(room.users).length === 0,
      isMuted: userData.isMuted ?? false,
      isCameraOff: userData.isCameraOff ?? true,
      isScreenSharing: false,
      color: userData.color || '#3b82f6'
    };

    socket.join(room.id);
    socketUserMap.set(socket.id, { roomId: room.id, userId: user.id });

    roomManager.addUserToRoom(room, user);

    // Send room snapshot to newly joined user
    socket.emit('room-joined', {
      room: {
        id: room.id,
        slug: room.slug,
        name: room.name,
        isLocked: room.isLocked,
        backgroundTheme: room.backgroundTheme,
        activeApp: room.activeApp,
        mediaState: room.mediaState,
        whiteboardStrokes: room.whiteboardStrokes,
        cardGameState: room.cardGameState,
        chessGameState: room.chessGameState,
        users: room.users,
        chatMessages: room.chatMessages
      },
      currentUserId: user.id
    });

    // Notify other users in room
    socket.to(room.id).emit('user-joined', {
      user,
      users: room.users
    });

    // Broadcast updated chat message (system join message)
    io.to(room.id).emit('chat-updated', {
      messages: room.chatMessages
    });

    console.log(`[User Joined] ${user.name} (${user.id}) joined room ${room.slug}`);
  });

  // User media controls update (mic / cam / screen toggle)
  socket.on('update-user-state', (updates: Partial<User>) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room || !room.users[session.userId]) return;

    room.users[session.userId] = {
      ...room.users[session.userId],
      ...updates
    };

    io.to(room.id).emit('user-updated', {
      user: room.users[session.userId],
      users: room.users
    });
  });

  // Real-time Chat
  socket.on('send-chat', (payload: { text: string }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room || !room.users[session.userId]) return;

    const user = room.users[session.userId];
    const message = roomManager.addChatMessage(room, {
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      senderColor: user.color,
      text: payload.text
    });

    io.to(room.id).emit('chat-message', message);
  });

  // Media Synchronization (Play, Pause, Seek, Set Media, Playlist)
  socket.on('media-action', (action: { type: 'play' | 'pause' | 'seek' | 'set-media' | 'queue-add' | 'queue-remove'; data?: any }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const user = room.users[session.userId];
    if (!user) return;

    switch (action.type) {
      case 'play': {
        const time = typeof action.data?.currentTime === 'number' ? action.data.currentTime : room.mediaState.currentTime;
        roomManager.updateMediaState(room, { playing: true, currentTime: time });
        break;
      }
      case 'pause': {
        const time = typeof action.data?.currentTime === 'number' ? action.data.currentTime : room.mediaState.currentTime;
        roomManager.updateMediaState(room, { playing: false, currentTime: time });
        break;
      }
      case 'seek': {
        const time = typeof action.data?.currentTime === 'number' ? action.data.currentTime : room.mediaState.currentTime;
        roomManager.updateMediaState(room, { currentTime: time });
        break;
      }
      case 'set-media': {
        const { url, title, appType } = action.data;
        roomManager.updateMediaState(room, {
          url,
          title: title || 'Shared Video',
          appType: appType || 'youtube',
          playing: true,
          currentTime: 0
        });
        if (appType) {
          roomManager.setActiveApp(room, appType);
        }
        roomManager.addChatMessage(room, {
          senderId: 'system',
          senderName: 'System',
          senderAvatar: '🎬',
          text: `${user.name} queued "${title || url}"`,
          isSystem: true
        });
        io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
        break;
      }
      case 'queue-add': {
        const item = action.data;
        if (item && item.url) {
          room.mediaState.queue.push(item);
          roomManager.addChatMessage(room, {
            senderId: 'system',
            senderName: 'System',
            senderAvatar: '🎵',
            text: `${user.name} added "${item.title || item.url}" to the playlist`,
            isSystem: true
          });
          io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
        }
        break;
      }
      case 'queue-remove': {
        const itemId = action.data?.id;
        if (itemId) {
          room.mediaState.queue = room.mediaState.queue.filter(q => q.id !== itemId);
        }
        break;
      }
    }

    io.to(room.id).emit('media-updated', {
      mediaState: room.mediaState,
      senderUserId: user.id
    });
  });

  // Switch Active Stage App
  socket.on('set-active-app', (payload: { appType: AppType; initialData?: any }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const user = room.users[session.userId];
    roomManager.setActiveApp(room, payload.appType);

    if (payload.appType === 'screenshare' || payload.appType === 'localvideo') {
      room.mediaState.screenSharingUserId = session.userId;
    } else {
      room.mediaState.screenSharingUserId = undefined;
    }

    roomManager.addChatMessage(room, {
      senderId: 'system',
      senderName: 'System',
      senderAvatar: '🚀',
      text: `${user?.name || 'Someone'} launched ${payload.appType.toUpperCase()}`,
      isSystem: true
    });

    io.to(room.id).emit('active-app-changed', {
      activeApp: room.activeApp,
      mediaState: room.mediaState
    });

    io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
  });

  // Whiteboard Real-time Events
  socket.on('whiteboard-stroke', (stroke: WhiteboardStroke) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    roomManager.addWhiteboardStroke(room, stroke);
    socket.to(room.id).emit('whiteboard-stroke', stroke);
  });

  socket.on('whiteboard-clear', () => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    roomManager.clearWhiteboard(room);
    io.to(room.id).emit('whiteboard-cleared');
  });

  socket.on('whiteboard-undo', () => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const removed = roomManager.undoWhiteboardStroke(room, session.userId);
    if (removed) {
      io.to(room.id).emit('whiteboard-stroke-removed', { strokeId: removed.id });
    }
  });

  socket.on('whiteboard-cursor', (payload: { x: number; y: number }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;
    const user = room.users[session.userId];
    if (!user) return;

    socket.to(room.id).emit('whiteboard-cursor', {
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      x: payload.x,
      y: payload.y
    });
  });

  // Card Game Events
  socket.on('card-action', (action: { type: 'deal' | 'reset' | 'hit' | 'fold' | 'bet'; amount?: number }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const user = room.users[session.userId];

    if (action.type === 'reset') {
      const state = roomManager.resetCardGame(room);
      roomManager.addChatMessage(room, {
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '🃏',
        text: `${user?.name || 'Host'} shuffled a new deck and dealt hands!`,
        isSystem: true
      });
      io.to(room.id).emit('card-game-updated', state);
      io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
    } else if (action.type === 'deal') {
      const state = roomManager.dealCard(room);
      io.to(room.id).emit('card-game-updated', state);
    }
  });

  // 1v1 Chess Lounge Events
  socket.on('chess-seat', ({ color }: { color: 'white' | 'black' | 'leave' }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;
    const user = room.users[session.userId];
    if (!user) return;

    const state = roomManager.seatChessPlayer(room, user, color);
    io.to(room.id).emit('chess-game-updated', state);

    if (color !== 'leave') {
      roomManager.addChatMessage(room, {
        senderId: 'system',
        senderName: 'Chess Arbiter',
        senderAvatar: '♟️',
        text: `${user.name} took the ${color === 'white' ? 'White ⚪' : 'Black ⚫'} seat!`,
        isSystem: true
      });
      io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
    }
  });

  socket.on('chess-move', (moveData: { from: string; to: string; promotion?: string }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const res = roomManager.makeChessMove(room, session.userId, moveData);
    if (res.success) {
      io.to(room.id).emit('chess-game-updated', res.state);

      if (res.state.isCheckmate) {
        roomManager.addChatMessage(room, {
          senderId: 'system',
          senderName: 'Chess Arbiter',
          senderAvatar: '🏆',
          text: `Checkmate! ${res.state.winner === 'white' ? 'White ⚪' : 'Black ⚫'} wins the match!`,
          isSystem: true
        });
        io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
      } else if (res.state.isDraw) {
        roomManager.addChatMessage(room, {
          senderId: 'system',
          senderName: 'Chess Arbiter',
          senderAvatar: '🤝',
          text: `Game drawn!`,
          isSystem: true
        });
        io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
      }
    } else {
      socket.emit('chess-error', { message: res.error });
    }
  });

  socket.on('chess-reset', ({ timeControl }: { timeControl?: number } = {}) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;
    const user = room.users[session.userId];

    const state = roomManager.resetChessGame(room, timeControl || 600);
    io.to(room.id).emit('chess-game-updated', state);

    roomManager.addChatMessage(room, {
      senderId: 'system',
      senderName: 'Chess Arbiter',
      senderAvatar: '♟️',
      text: `${user?.name || 'Someone'} started a new chess game (${Math.floor((timeControl || 600) / 60)}m clock)!`,
      isSystem: true
    });
    io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
  });

  socket.on('chess-resign', ({ color }: { color?: 'white' | 'black' } = {}) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;
    const user = room.users[session.userId];

    const state = roomManager.resignChessGame(room, session.userId, color);
    io.to(room.id).emit('chess-game-updated', state);

    roomManager.addChatMessage(room, {
      senderId: 'system',
      senderName: 'Chess Arbiter',
      senderAvatar: '🏳️',
      text: `${user?.name || 'Player'} resigned. ${state.winner === 'white' ? 'White ⚪' : 'Black ⚫'} wins!`,
      isSystem: true
    });
    io.to(room.id).emit('chat-updated', { messages: room.chatMessages });
  });

  // Room Theme and Settings Customization
  socket.on('update-room-settings', (settings: { backgroundTheme?: string; name?: string; isLocked?: boolean; passcode?: string }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    if (settings.backgroundTheme) room.backgroundTheme = settings.backgroundTheme;
    if (settings.name) room.name = settings.name;
    if (settings.isLocked !== undefined) room.isLocked = settings.isLocked;
    if (settings.passcode !== undefined) room.passcode = settings.passcode;

    io.to(room.id).emit('room-settings-updated', {
      backgroundTheme: room.backgroundTheme,
      name: room.name,
      isLocked: room.isLocked
    });
  });

  // ==========================================
  // WebRTC P2P Video/Voice Signaling
  // ==========================================
  socket.on('webrtc-offer', (payload: { targetUserId: string; offer: any; callerUserId: string }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const targetUser = room.users[payload.targetUserId];
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('webrtc-offer', {
        callerUserId: session.userId,
        offer: payload.offer
      });
    }
  });

  socket.on('webrtc-answer', (payload: { targetUserId: string; answer: any }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const targetUser = room.users[payload.targetUserId];
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('webrtc-answer', {
        responderUserId: session.userId,
        answer: payload.answer
      });
    }
  });

  socket.on('webrtc-ice-candidate', (payload: { targetUserId: string; candidate: any }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const targetUser = room.users[payload.targetUserId];
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('webrtc-ice-candidate', {
        senderUserId: session.userId,
        candidate: payload.candidate
      });
    }
  });

  socket.on('webrtc-request-renegotiate', (payload: { targetUserId: string }) => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;

    const targetUser = room.users[payload.targetUserId];
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('webrtc-request-renegotiate', {
        requesterUserId: session.userId
      });
    }
  });

  // Disconnection & Clean up
  const handleDisconnect = () => {
    const session = socketUserMap.get(socket.id);
    if (!session) return;

    const room = roomManager.getRoom(session.roomId);
    if (room) {
      const { removedUser, newHost } = roomManager.removeUserFromRoom(room, session.userId);
      if (removedUser) {
        socket.to(room.id).emit('user-left', {
          userId: session.userId,
          users: room.users,
          newHost
        });
        io.to(room.id).emit('chat-updated', {
          messages: room.chatMessages
        });
        console.log(`[User Left] ${removedUser.name} (${session.userId}) left room ${room.slug}`);
      }
    }

    socketUserMap.delete(socket.id);
  };

  socket.on('disconnect', handleDisconnect);
  socket.on('leave-room', handleDisconnect);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Live With You (Kosmi Clone) Server running on http://localhost:${PORT}`);
});
