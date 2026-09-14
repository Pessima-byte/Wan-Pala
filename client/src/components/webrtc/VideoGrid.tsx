import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { VideoTile } from './VideoTile';

export const VideoGrid: React.FC = () => {
  const { room, currentUser, localStream, remoteStreams, speakingUsers } = useRoom();

  if (!room) return null;

  const usersList = Object.values(room.users);

  return (
    <div className="flex items-center gap-3 overflow-x-auto p-2 pb-3 scrollbar-thin max-w-full z-10 pointer-events-auto">
      {/* Current user */}
      <VideoTile
        user={currentUser}
        stream={localStream}
        isSpeaking={speakingUsers[currentUser.id]}
        isSelf={true}
      />

      {/* Remote peers */}
      {usersList
        .filter(u => u.id !== currentUser.id)
        .map(user => (
          <VideoTile
            key={user.id}
            user={user}
            stream={remoteStreams[user.id]}
            isSpeaking={speakingUsers[user.id]}
            isSelf={false}
          />
        ))}
    </div>
  );
};
