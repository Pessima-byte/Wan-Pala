import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

async function runTests() {
  console.log('🧪 Starting End-to-End WebSocket & Room Synchronization Test...');

  // 1. Create Host and Guest Sockets with autoConnect: false
  const clientHost: Socket = io(SERVER_URL, { autoConnect: false, reconnection: false });
  const clientGuest: Socket = io(SERVER_URL, { autoConnect: false, reconnection: false });

  const roomId = `test-lounge-${Date.now()}`;

  // Connect Host
  await new Promise<void>((resolve, reject) => {
    clientHost.on('connect', () => {
      console.log('✅ Host connected to server');
      resolve();
    });
    clientHost.connect();
    setTimeout(() => reject(new Error('Host connection timeout')), 3000);
  });

  // 2. Join Room as Host
  await new Promise<void>((resolve) => {
    clientHost.on('room-joined', (data) => {
      console.log(`✅ Host joined room: ${data.room.slug}`);
      if (data.room.users['usr_host']?.isHost) {
        console.log('✅ Host privileges verified');
      }
      resolve();
    });

    clientHost.emit('join-room', {
      roomId,
      user: {
        id: 'usr_host',
        name: 'Host User',
        avatar: '👑',
        color: '#8b5cf6',
        isMuted: false,
        isCameraOff: true,
        isScreenSharing: false
      }
    });
  });

  // 3. Connect Guest and Join Room
  await new Promise<void>((resolve, reject) => {
    clientGuest.on('room-joined', (data) => {
      console.log(`✅ Guest joined room: ${data.room.slug}`);
      resolve();
    });

    clientGuest.on('connect', () => {
      console.log('✅ Guest connected to server');
      clientGuest.emit('join-room', {
        roomId,
        user: {
          id: 'usr_guest',
          name: 'Guest User',
          avatar: '🐱',
          color: '#ec4899',
          isMuted: false,
          isCameraOff: true,
          isScreenSharing: false
        }
      });
    });

    clientGuest.connect();
    setTimeout(() => reject(new Error('Guest join timeout')), 3000);
  });

  // 4. Test Chat Message Exchange
  await new Promise<void>((resolve, reject) => {
    clientGuest.on('chat-message', (msg) => {
      if (msg.text === 'Hello everyone in the lounge!') {
        console.log(`✅ Real-time chat verified: Received "${msg.text}" from ${msg.senderName}`);
        resolve();
      }
    });

    clientHost.emit('send-chat', { text: 'Hello everyone in the lounge!' });
    setTimeout(() => reject(new Error('Chat message timeout')), 3000);
  });

  // 5. Test Media Action Synchronization (YouTube Watch Party play/seek)
  await new Promise<void>((resolve, reject) => {
    clientGuest.on('media-updated', (data) => {
      if (data.mediaState.playing && data.mediaState.currentTime === 45) {
        console.log('✅ Media playback synchronization verified: currentTime = 45s, playing = true');
        resolve();
      }
    });

    clientHost.emit('media-action', {
      type: 'play',
      data: { currentTime: 45 }
    });
    setTimeout(() => reject(new Error('Media action timeout')), 3000);
  });

  // 6. Test App Launch Switch (Switch to Whiteboard)
  await new Promise<void>((resolve, reject) => {
    clientGuest.on('active-app-changed', (data) => {
      if (data.activeApp === 'whiteboard') {
        console.log('✅ Stage app switcher verified: Successfully switched to Whiteboard');
        resolve();
      }
    });

    clientHost.emit('set-active-app', { appType: 'whiteboard' });
    setTimeout(() => reject(new Error('Active app switch timeout')), 3000);
  });

  // 7. Test Whiteboard Stroke Sync
  await new Promise<void>((resolve, reject) => {
    const strokeData = {
      id: 'st_123',
      color: '#38bdf8',
      width: 4,
      points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
      userId: 'usr_host'
    };

    clientGuest.on('whiteboard-stroke', (stroke) => {
      if (stroke.id === 'st_123') {
        console.log('✅ Collaborative Whiteboard stroke synchronization verified');
        resolve();
      }
    });

    clientHost.emit('whiteboard-stroke', strokeData);
    setTimeout(() => reject(new Error('Whiteboard stroke timeout')), 3000);
  });

  // 8. Test Card Game State Reset/Deal
  await new Promise<void>((resolve, reject) => {
    clientGuest.on('card-game-updated', (cardState) => {
      if (cardState.status === 'playing') {
        console.log(`✅ Virtual Card Lounge game verified: ${cardState.communityCards.length} community cards dealt, pot: $${cardState.pot}`);
        resolve();
      }
    });

    clientHost.emit('card-action', { type: 'reset' });
    setTimeout(() => reject(new Error('Card game timeout')), 3000);
  });

  console.log('\n🎉 ALL REAL-TIME PROTOCOL TESTS PASSED WITH 100% SUCCESS!');

  clientHost.disconnect();
  clientGuest.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
