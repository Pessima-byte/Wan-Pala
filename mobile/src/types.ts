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

export type AppType =
  | 'none'
  | 'youtube'
  | 'screenshare'
  | 'localvideo'
  | 'directvideo'
  | 'whiteboard'
  | 'chess'
  | 'retro-arcade'
  | 'card-table'
  | 'ambient';

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

export interface WhiteboardStroke {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  userId: string;
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
  cardGameState: any;
  chessGameState?: any;
  users: Record<string, User>;
  chatMessages: ChatMessage[];
}
