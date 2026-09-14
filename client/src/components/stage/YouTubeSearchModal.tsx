import React, { useState, useEffect, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Search, X, Play, Clock, Sparkles, Tv, Loader2 } from 'lucide-react';

interface YouTubeVideoItem {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  url: string;
}

const POPULAR_TOPICS = [
  'Lo-Fi Hip Hop Beats',
  'Synthwave Chill',
  'Trending Music',
  'Gaming Highlights',
  'Anime OST',
  'Funny Memes'
];

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const YouTubeSearchModal: React.FC = () => {
  const { isYouTubeSearchOpen, setIsYouTubeSearchOpen, sendMediaAction, setActiveApp } = useRoom();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<any>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isYouTubeSearchOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      // If results are empty, fetch default popular category
      if (results.length === 0 && !query) {
        performSearch('lofi beats to study/relax to');
      }
    }
  }, [isYouTubeSearchOpen]);

  const performSearch = async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    // Check if it's a direct YouTube URL
    const directId = extractYouTubeId(trimmed);
    if (directId) {
      setResults([
        {
          id: directId,
          title: `YouTube Video (${directId})`,
          channel: 'Direct URL Link',
          duration: 'Video',
          thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${directId}`
        }
      ]);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('[YouTube Search Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (!val.trim()) {
      return;
    }

    // Direct YouTube URL paste handles quickly
    if (extractYouTubeId(val.trim())) {
      performSearch(val.trim());
      return;
    }

    // Debounce search query
    debounceTimeout.current = setTimeout(() => {
      performSearch(val);
    }, 450);
  };

  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const handleSelectVideo = (video: YouTubeVideoItem) => {
    setSelectedVideoId(video.id);

    // Send media action to room (server will update mediaState and activeApp automatically)
    sendMediaAction('set-media', {
      url: video.url,
      title: video.title,
      appType: 'youtube'
    });

    // Close search modal immediately so user sees the stage load
    setIsYouTubeSearchOpen(false);
  };

  if (!isYouTubeSearchOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 z-50 animate-fadeIn">
      <div className="bg-lounge-850 border border-white/10 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[85vh] max-h-[750px]">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center shadow-inner">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2">
                YouTube Watch Party
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  Search & Direct Play
                </span>
              </h2>
              <p className="text-xs text-slate-400">Search any video, music, or paste a YouTube link to watch together</p>
            </div>
          </div>

          <button
            onClick={() => setIsYouTubeSearchOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Quick Categories */}
        <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col gap-3">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  performSearch(query);
                }
              }}
              placeholder="Search YouTube videos, songs, podcasts or paste video URL..."
              className="w-full pl-11 pr-24 py-3 bg-white/5 border border-white/10 focus:border-red-500/60 focus:bg-white/10 rounded-2xl text-slate-100 placeholder-slate-400 text-sm outline-none transition duration-200 shadow-inner"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-20 text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => performSearch(query)}
              className="absolute right-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer"
            >
              Search
            </button>
          </div>

          {/* Quick Category Suggestion Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1 pr-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Suggestions:
            </span>
            {POPULAR_TOPICS.map(topic => (
              <button
                key={topic}
                onClick={() => {
                  setQuery(topic);
                  performSearch(topic);
                }}
                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/5 whitespace-nowrap transition cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 py-16">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              <p className="text-sm font-medium">Searching YouTube...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {results.map((video) => (
                <div
                  key={video.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectVideo(video)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectVideo(video);
                    }
                  }}
                  className={`group flex flex-col rounded-2xl bg-white/5 hover:bg-white/10 border ${
                    selectedVideoId === video.id ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/50' : 'border-white/5 hover:border-red-500/40'
                  } p-3 cursor-pointer transition-all duration-150 shadow-md hover:shadow-red-500/10 hover:-translate-y-0.5 active:scale-98 select-none touch-manipulation`}
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-2.5 pointer-events-none">
                    <img
                      src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                      alt={video.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback to standard ytimg url
                        const target = e.currentTarget;
                        if (!target.src.includes('hqdefault.jpg')) {
                          target.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
                        }
                      }}
                    />
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-semibold text-white tracking-wide flex items-center gap-1 pointer-events-none">
                        <Clock className="w-2.5 h-2.5 text-slate-300" />
                        {video.duration}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Title and Channel */}
                  <h3 className="text-xs md:text-sm font-semibold text-slate-100 line-clamp-2 mb-1 group-hover:text-red-400 transition-colors pointer-events-none">
                    {video.title}
                  </h3>
                  <div className="mt-auto flex items-center justify-between text-[11px] text-slate-400 pt-1 pointer-events-none">
                    <span className="truncate max-w-[140px] font-medium">{video.channel}</span>
                    <span className="text-red-400 font-bold group-hover:underline flex items-center gap-0.5">
                      ▶ Play Video
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 text-center">
              <Tv className="w-12 h-12 text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-300">No YouTube videos found</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Try searching for something else or paste a direct YouTube link above.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
