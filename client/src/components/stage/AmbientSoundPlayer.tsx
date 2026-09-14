import React, { useState, useEffect, useRef } from 'react';
import { CloudRain, Coffee, Flame, Disc, Volume2, VolumeX, Play, Pause } from 'lucide-react';

interface SoundChannel {
  id: string;
  name: string;
  icon: any;
  volume: number;
  playing: boolean;
}

export const AmbientSoundPlayer: React.FC = () => {
  const [channels, setChannels] = useState<SoundChannel[]>([
    { id: 'rain', name: 'Cozy Rain', icon: CloudRain, volume: 60, playing: false },
    { id: 'cafe', name: 'Warm Cafe', icon: Coffee, volume: 40, playing: false },
    { id: 'fireplace', name: 'Crackling Fire', icon: Flame, volume: 50, playing: false },
    { id: 'vinyl', name: 'Vinyl Dust', icon: Disc, volume: 30, playing: false },
  ]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Record<string, { gain: GainNode; source: AudioNode }>>({});

  const startSynthesizedSound = (id: string, audioCtx: AudioContext) => {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    if (id === 'rain') {
      // Pink/Brownian noise for rain
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.15;
      }
    } else if (id === 'fireplace') {
      // Fireplace crackle
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() > 0.992 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.02;
      }
    } else if (id === 'vinyl') {
      // Vinyl pop & hiss
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.4 : (Math.random() * 2 - 1) * 0.015;
      }
    } else {
      // Cafe warm hum
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.04;
      }
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = id === 'rain' ? 'lowpass' : id === 'fireplace' ? 'bandpass' : 'lowpass';
    filter.frequency.value = id === 'rain' ? 800 : id === 'fireplace' ? 1200 : 500;

    const gainNode = audioCtx.createGain();
    const ch = channels.find(c => c.id === id);
    gainNode.gain.value = ((ch?.volume || 50) / 100) * 0.5;

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseSource.start();
    nodesRef.current[id] = { gain: gainNode, source: noiseSource };
  };

  const toggleChannel = (id: string) => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    setChannels(prev =>
      prev.map(c => {
        if (c.id === id) {
          const nextPlaying = !c.playing;
          if (nextPlaying) {
            startSynthesizedSound(id, audioCtx);
          } else {
            if (nodesRef.current[id]) {
              try {
                (nodesRef.current[id].source as AudioBufferSourceNode).stop();
                nodesRef.current[id].gain.disconnect();
              } catch (e) {}
              delete nodesRef.current[id];
            }
          }
          return { ...c, playing: nextPlaying };
        }
        return c;
      })
    );
  };

  const setVolume = (id: string, vol: number) => {
    setChannels(prev =>
      prev.map(c => {
        if (c.id === id) {
          if (nodesRef.current[id]) {
            nodesRef.current[id].gain.gain.value = (vol / 100) * 0.5;
          }
          return { ...c, volume: vol };
        }
        return c;
      })
    );
  };

  useEffect(() => {
    return () => {
      Object.values(nodesRef.current).forEach(n => {
        try {
          (n.source as AudioBufferSourceNode).stop();
          n.gain.disconnect();
        } catch (e) {}
      });
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full p-3 md:p-6 max-w-4xl mx-auto items-center justify-center">
      <div className="w-full glass-panel rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Disc className="w-6 h-6 text-brand-400 animate-spin" /> WAN PALA Ambient Soundscape
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Mix calming environmental audio for reading, coding, or sleeping together in the room
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {channels.map(channel => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.id}
                className={`p-5 rounded-2xl border transition-all ${
                  channel.playing
                    ? 'bg-brand-600/15 border-brand-500/40 shadow-lg shadow-brand-500/5'
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        channel.playing ? 'bg-brand-600 text-white shadow-md' : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{channel.name}</h4>
                      <span className="text-[11px] text-slate-400">
                        {channel.playing ? 'Active Sound' : 'Off'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleChannel(channel.id)}
                    className={`p-2 rounded-xl transition ${
                      channel.playing
                        ? 'bg-brand-500 text-white shadow'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {channel.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={channel.volume}
                    onChange={e => setVolume(channel.id, Number(e.target.value))}
                    disabled={!channel.playing}
                    className="flex-1 accent-brand-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">{channel.volume}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
