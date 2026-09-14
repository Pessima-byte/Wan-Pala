export interface User {
  id: string;
  socketId: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  color: string;
}

export type AppType = 'none' | 'youtube' | 'screenshare' | 'localvideo' | 'directvideo' | 'whiteboard' | 'chess' | 'retro-arcade' | 'card-table' | 'ambient';

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  duration?: number;
  addedBy: string;
}

export interface MediaState {
  appType: AppType;
  url: string;
  title: string;
  playing: boolean;
  currentTime: number;
  playbackRate: number;
  lastUpdated: number;
  queue: PlaylistItem[];
  screenSharingUserId?: string;
}

export interface WhiteboardStroke {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  userId: string;
}

export interface CardGameState {
  deck: string[];
  hands: Record<string, string[]>;
  communityCards: string[];
  pot: number;
  currentTurn?: string;
  dealerIndex: number;
  status: 'waiting' | 'dealing' | 'playing' | 'round-over';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderColor?: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface ChessPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface ChessGameState {
  fen: string;
  pgn: string;
  whitePlayer: ChessPlayer | null;
  blackPlayer: ChessPlayer | null;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  winner: 'white' | 'black' | 'draw' | null;
  lastMove: { from: string; to: string; san?: string } | null;
  history: { san: string; from: string; to: string; piece: string; color: string }[];
  whiteTime: number;
  blackTime: number;
  timeControl: number;
  timerRunning: boolean;
  lastMoveTimestamp?: number;
}

export interface RoomData {
  id: string;
  slug: string;
  name: string;
  isLocked: boolean;
  backgroundTheme: string;
  activeApp: AppType;
  mediaState: MediaState;
  whiteboardStrokes: WhiteboardStroke[];
  cardGameState: CardGameState;
  chessGameState?: ChessGameState;
  users: Record<string, User>;
  chatMessages: ChatMessage[];
}
