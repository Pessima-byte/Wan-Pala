import React, { useEffect, useState, useRef } from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { LobbyView } from './components/lobby/LobbyView';
import { RoomView } from './components/room/RoomView';

function AppContent() {
  const { isInRoom, joinRoom, currentUser } = useRoom();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const joinedSlugRef = useRef<string | null>(null);

  // Ensure mobile devices connecting via IP address use HTTPS (required for WebRTC microphone)
  useEffect(() => {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }, []);

  // Parse path for /room/:slug
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const match = currentPath.match(/\/room\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const roomSlug = match[1];
      if (!isInRoom && joinedSlugRef.current !== roomSlug) {
        joinedSlugRef.current = roomSlug;
        joinRoom(roomSlug, {
          name: currentUser.name,
          avatar: currentUser.avatar,
          color: currentUser.color
        });
      }
    } else {
      joinedSlugRef.current = null;
    }
  }, [currentPath, isInRoom]);

  if (isInRoom) {
    return <RoomView />;
  }

  return <LobbyView />;
}

export default function App() {
  return (
    <RoomProvider>
      <AppContent />
    </RoomProvider>
  );
}
