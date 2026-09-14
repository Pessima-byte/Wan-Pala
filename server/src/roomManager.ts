import { Room, User, MediaState, AppType, ChatMessage, WhiteboardStroke, CardGameState, ChessGameState, ChessPlayer } from './types.js';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';

const ADJECTIVES = ['cozy', 'velvet', 'cyber', 'retro', 'neon', 'chill', 'golden', 'stellar', 'midnight', 'astral', 'sunset', 'lofi'];
const NOUNS = ['lounge', 'rooftop', 'den', 'cinema', 'arcade', 'cafe', 'oasis', 'haven', 'cabin', 'space', 'loft', 'parlor'];

export function generateRoomSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}-${noun}-${num}`;
}

const DEFAULT_DECK = [
  'AH', '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH',
  'AD', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', 'JD', 'QD', 'KD',
  'AC', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC',
  'AS', '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS',
];

function shuffleDeck(deck: string[]): string[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  public getOrCreateRoom(slugOrId?: string, customName?: string): Room {
    let room: Room | undefined;
    if (slugOrId) {
      room = this.rooms.get(slugOrId);
      if (!room) {
        // Look for slug match
        for (const r of this.rooms.values()) {
          if (r.slug.toLowerCase() === slugOrId.toLowerCase() || r.id === slugOrId) {
            room = r;
            break;
          }
        }
      }
    }

    if (!room) {
      const id = uuidv4();
      const slug = slugOrId || generateRoomSlug();
      room = {
        id,
        slug,
        name: customName || slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        isLocked: false,
        backgroundTheme: 'lofi-cafe',
        activeApp: 'youtube',
        mediaState: {
          appType: 'youtube',
          url: 'https://www.youtube.com/watch?v=5qap5aO4i9A', // Always-active Lofi Girl 24/7 stream
          title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
          playing: false,
          currentTime: 0,
          playbackRate: 1,
          lastUpdated: Date.now(),
          queue: [
            {
              id: uuidv4(),
              url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
              title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
              addedBy: 'WAN PALA DJ'
            }
          ]
        },
        whiteboardStrokes: [],
        cardGameState: {
          deck: shuffleDeck(DEFAULT_DECK),
          hands: {},
          communityCards: [],
          pot: 0,
          dealerIndex: 0,
          status: 'waiting'
        },
        chessGameState: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: '',
          whitePlayer: null,
          blackPlayer: null,
          turn: 'w',
          isCheck: false,
          isCheckmate: false,
          isDraw: false,
          winner: null,
          lastMove: null,
          history: [],
          whiteTime: 600,
          blackTime: 600,
          timeControl: 600,
          timerRunning: false
        },
        users: {},
        chatMessages: [
          {
            id: uuidv4(),
            senderId: 'system',
            senderName: 'WAN PALA Bot',
            senderAvatar: '🤖',
            text: 'Welcome to your private lounge! Share the link with friends to watch videos, hang out, or play games together.',
            timestamp: Date.now(),
            isSystem: true
          }
        ],
        createdAt: Date.now()
      };
      this.rooms.set(room.id, room);
      this.rooms.set(room.slug, room);
    }

    return room;
  }

  public getRoom(roomIdOrSlug: string): Room | undefined {
    let room = this.rooms.get(roomIdOrSlug);
    if (!room) {
      for (const r of this.rooms.values()) {
        if (r.slug === roomIdOrSlug || r.id === roomIdOrSlug) {
          return r;
        }
      }
    }
    return room;
  }

  public listPublicRooms(): { id: string; slug: string; name: string; userCount: number; theme: string; activeApp: string }[] {
    const seen = new Set<string>();
    const list = [];
    for (const r of this.rooms.values()) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (!r.isLocked) {
        list.push({
          id: r.id,
          slug: r.slug,
          name: r.name,
          userCount: Object.keys(r.users).length,
          theme: r.backgroundTheme,
          activeApp: r.activeApp
        });
      }
    }
    return list;
  }

  public addUserToRoom(room: Room, user: User): void {
    const isFirstUser = Object.keys(room.users).length === 0;
    user.isHost = isFirstUser;
    room.users[user.id] = user;

    const joinMessage: ChatMessage = {
      id: uuidv4(),
      senderId: 'system',
      senderName: 'System',
      senderAvatar: '👋',
      text: `${user.name} joined the room.`,
      timestamp: Date.now(),
      isSystem: true
    };
    room.chatMessages.push(joinMessage);
    if (room.chatMessages.length > 200) {
      room.chatMessages.shift();
    }
  }

  public removeUserFromRoom(room: Room, userId: string): { removedUser?: User; newHost?: User } {
    const user = room.users[userId];
    if (!user) return {};

    delete room.users[userId];

    let newHost: User | undefined;
    if (user.isHost) {
      const remainingUserIds = Object.keys(room.users);
      if (remainingUserIds.length > 0) {
        newHost = room.users[remainingUserIds[0]];
        newHost.isHost = true;
      }
    }

    const leaveMessage: ChatMessage = {
      id: uuidv4(),
      senderId: 'system',
      senderName: 'System',
      senderAvatar: '🚪',
      text: `${user.name} left the room.`,
      timestamp: Date.now(),
      isSystem: true
    };
    room.chatMessages.push(leaveMessage);
    if (room.chatMessages.length > 200) {
      room.chatMessages.shift();
    }

    return { removedUser: user, newHost };
  }

  public addChatMessage(room: Room, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const fullMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now()
    };
    room.chatMessages.push(fullMessage);
    if (room.chatMessages.length > 200) {
      room.chatMessages.shift();
    }
    return fullMessage;
  }

  public updateMediaState(room: Room, update: Partial<MediaState>): MediaState {
    room.mediaState = {
      ...room.mediaState,
      ...update,
      lastUpdated: Date.now()
    };
    return room.mediaState;
  }

  public setActiveApp(room: Room, appType: AppType): void {
    room.activeApp = appType;
    room.mediaState.appType = appType;
  }

  public addWhiteboardStroke(room: Room, stroke: WhiteboardStroke): void {
    room.whiteboardStrokes.push(stroke);
    // Keep max 2000 strokes to prevent memory bloat
    if (room.whiteboardStrokes.length > 2000) {
      room.whiteboardStrokes.shift();
    }
  }

  public clearWhiteboard(room: Room): void {
    room.whiteboardStrokes = [];
  }

  public undoWhiteboardStroke(room: Room, userId?: string): WhiteboardStroke | undefined {
    if (!room.whiteboardStrokes.length) return undefined;
    if (userId) {
      // Find and remove the last stroke made by this user
      for (let i = room.whiteboardStrokes.length - 1; i >= 0; i--) {
        if (room.whiteboardStrokes[i].userId === userId) {
          const [removed] = room.whiteboardStrokes.splice(i, 1);
          return removed;
        }
      }
    }
    // Fallback: pop the last stroke
    return room.whiteboardStrokes.pop();
  }

  public resetCardGame(room: Room): CardGameState {
    const userIds = Object.keys(room.users);
    const newDeck = shuffleDeck(DEFAULT_DECK);
    const hands: Record<string, string[]> = {};

    userIds.forEach(uid => {
      hands[uid] = [newDeck.pop()!, newDeck.pop()!];
    });

    const communityCards = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];

    room.cardGameState = {
      deck: newDeck,
      hands,
      communityCards,
      pot: userIds.length * 10,
      dealerIndex: 0,
      status: 'playing',
      currentTurn: userIds[0]
    };

    return room.cardGameState;
  }

  public dealCard(room: Room): CardGameState {
    if (room.cardGameState.deck.length > 0 && room.cardGameState.communityCards.length < 5) {
      room.cardGameState.communityCards.push(room.cardGameState.deck.pop()!);
    }
    return room.cardGameState;
  }

  public getOrCreateChessGame(room: Room): ChessGameState {
    if (!room.chessGameState) {
      room.chessGameState = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        whitePlayer: null,
        blackPlayer: null,
        turn: 'w',
        isCheck: false,
        isCheckmate: false,
        isDraw: false,
        winner: null,
        lastMove: null,
        history: [],
        whiteTime: 600,
        blackTime: 600,
        timeControl: 600,
        timerRunning: false
      };
    }
    return room.chessGameState;
  }

  public seatChessPlayer(room: Room, user: User, color: 'white' | 'black' | 'leave'): ChessGameState {
    const game = this.getOrCreateChessGame(room);
    const playerObj: ChessPlayer = {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      color: user.color
    };

    if (color === 'leave') {
      if (game.whitePlayer?.id === user.id) game.whitePlayer = null;
      if (game.blackPlayer?.id === user.id) game.blackPlayer = null;
      return game;
    }

    if (color === 'white') {
      if (game.blackPlayer?.id === user.id) game.blackPlayer = null;
      game.whitePlayer = playerObj;
    } else if (color === 'black') {
      if (game.whitePlayer?.id === user.id) game.whitePlayer = null;
      game.blackPlayer = playerObj;
    }

    return game;
  }

  public makeChessMove(room: Room, userId: string, moveData: { from: string; to: string; promotion?: string }): { success: boolean; state: ChessGameState; error?: string } {
    const game = this.getOrCreateChessGame(room);

    if (game.isCheckmate || game.isDraw || game.winner) {
      return { success: false, state: game, error: 'Game is already over' };
    }

    // If both seats are occupied, enforce turn
    if (game.whitePlayer && game.blackPlayer) {
      if (game.turn === 'w' && game.whitePlayer.id !== userId) {
        return { success: false, state: game, error: 'It is White turn' };
      }
      if (game.turn === 'b' && game.blackPlayer.id !== userId) {
        return { success: false, state: game, error: 'It is Black turn' };
      }
    }

    try {
      const chess = new Chess(game.fen);
      const move = chess.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion || 'q'
      });

      if (!move) {
        return { success: false, state: game, error: 'Illegal move' };
      }

      const now = Date.now();
      if (game.timerRunning && game.lastMoveTimestamp) {
        const elapsedSeconds = Math.max(0, Math.floor((now - game.lastMoveTimestamp) / 1000));
        if (game.turn === 'w') {
          game.whiteTime = Math.max(0, game.whiteTime - elapsedSeconds);
          if (game.whiteTime === 0) {
            game.winner = 'black';
            game.timerRunning = false;
          }
        } else {
          game.blackTime = Math.max(0, game.blackTime - elapsedSeconds);
          if (game.blackTime === 0) {
            game.winner = 'white';
            game.timerRunning = false;
          }
        }
      }

      game.fen = chess.fen();
      game.pgn = chess.pgn();
      game.turn = chess.turn();
      game.isCheck = chess.isCheck();
      game.isCheckmate = chess.isCheckmate();
      game.isDraw = chess.isDraw();
      game.lastMove = { from: move.from, to: move.to, san: move.san };
      game.history.push({
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece,
        color: move.color
      });

      if (game.isCheckmate) {
        game.winner = move.color === 'w' ? 'white' : 'black';
        game.timerRunning = false;
      } else if (game.isDraw) {
        game.winner = 'draw';
        game.timerRunning = false;
      } else {
        game.timerRunning = true;
        game.lastMoveTimestamp = now;
      }

      return { success: true, state: game };
    } catch (err: any) {
      return { success: false, state: game, error: err.message || 'Failed to make move' };
    }
  }

  public resetChessGame(room: Room, timeControl: number = 600): ChessGameState {
    const game = this.getOrCreateChessGame(room);
    room.chessGameState = {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      whitePlayer: game.whitePlayer,
      blackPlayer: game.blackPlayer,
      turn: 'w',
      isCheck: false,
      isCheckmate: false,
      isDraw: false,
      winner: null,
      lastMove: null,
      history: [],
      whiteTime: timeControl,
      blackTime: timeControl,
      timeControl,
      timerRunning: false
    };
    return room.chessGameState;
  }

  public resignChessGame(room: Room, userId: string, color?: 'white' | 'black'): ChessGameState {
    const game = this.getOrCreateChessGame(room);
    if (game.winner) return game;

    if (color === 'white' || game.whitePlayer?.id === userId) {
      game.winner = 'black';
      game.timerRunning = false;
    } else if (color === 'black' || game.blackPlayer?.id === userId) {
      game.winner = 'white';
      game.timerRunning = false;
    }
    return game;
  }
}
