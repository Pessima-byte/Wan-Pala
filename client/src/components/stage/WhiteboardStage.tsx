import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRoom } from '../../context/RoomContext';
import { socket } from '../../socket';
import {
  Palette,
  Trash2,
  Eraser,
  Download,
  Undo2,
  PenTool,
  Square,
  Circle,
  Minus,
  Sparkles,
  Users
} from 'lucide-react';
import { WhiteboardStroke } from '../../types';

type ToolType = 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle';

interface RemoteCursor {
  userId: string;
  userName: string;
  userColor: string;
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  lastSeen: number;
}

const COLORS = [
  '#ffffff',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#38bdf8',
  '#818cf8',
  '#c084fc',
  '#f472b6',
  '#94a3b8'
];

const STROKE_WIDTHS = [2, 4, 8, 16, 28];

export const WhiteboardStage: React.FC = () => {
  const { room, sendWhiteboardStroke, undoWhiteboardStroke, clearWhiteboard, currentUser } = useRoom();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [currentColor, setCurrentColor] = useState('#38bdf8');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});

  const lastCursorBroadcast = useRef<number>(0);

  // Redraw all committed strokes on the main canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = room?.whiteboardStrokes || [];
    const w = canvas.width;
    const h = canvas.height;

    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Check if points are normalized (0 to 1) or absolute pixel coordinates
      const isNorm = stroke.points[0].x <= 1 && stroke.points[0].y <= 1;
      const getX = (pt: { x: number; y: number }) => (isNorm ? pt.x * w : pt.x);
      const getY = (pt: { x: number; y: number }) => (isNorm ? pt.y * h : pt.y);

      if (stroke.points.length === 1) {
        // Single tap dot
        ctx.arc(getX(stroke.points[0]), getY(stroke.points[0]), stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        return;
      }

      ctx.moveTo(getX(stroke.points[0]), getY(stroke.points[0]));
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(getX(stroke.points[i]), getY(stroke.points[i]));
      }
      ctx.stroke();
    });
  }, [room?.whiteboardStrokes]);

  // Sync canvas redraw on stroke updates
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize canvas resolution to container size
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!container || !canvas || !previewCanvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width);
      const displayHeight = Math.floor(rect.height);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        previewCanvas.width = displayWidth;
        previewCanvas.height = displayHeight;
        redrawCanvas();
      }
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [redrawCanvas]);

  // Listen for remote cursors
  useEffect(() => {
    const handleRemoteCursor = (data: { userId: string; userName: string; userColor: string; x: number; y: number }) => {
      if (data.userId === currentUser.id) return;
      setRemoteCursors(prev => ({
        ...prev,
        [data.userId]: {
          ...data,
          lastSeen: Date.now()
        }
      }));
    };

    socket.on('whiteboard-cursor', handleRemoteCursor);

    // Clean up stale cursors every 3 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(uid => {
          if (now - next[uid].lastSeen > 3500) {
            delete next[uid];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      socket.off('whiteboard-cursor', handleRemoteCursor);
      clearInterval(interval);
    };
  }, [currentUser.id]);

  // Helper to get coordinates normalized (0 to 1) and absolute
  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, normX: 0, normY: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    return {
      x,
      y,
      normX: x / rect.width,
      normY: y / rect.height
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    setIsDrawing(true);
    const { x, y, normX, normY } = getPointerCoords(e);
    setStartPos({ x, y });
    setCurrentPoints([{ x: normX, y: normY }]);

    // Live preview initial point
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeTool === 'brush' || activeTool === 'eraser') {
      ctx.beginPath();
      ctx.arc(x, y, (activeTool === 'eraser' ? currentWidth * 2 : currentWidth) / 2, 0, Math.PI * 2);
      ctx.fillStyle = activeTool === 'eraser' ? '#0f172a' : currentColor;
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getPointerCoords(e);

    // Broadcast cursor position (throttled to ~30fps)
    const now = Date.now();
    if (now - lastCursorBroadcast.current > 33) {
      socket.emit('whiteboard-cursor', { x: coords.normX, y: coords.normY });
      lastCursorBroadcast.current = now;
    }

    if (!isDrawing) return;

    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (activeTool === 'brush' || activeTool === 'eraser') {
      const newPoints = [...currentPoints, { x: coords.normX, y: coords.normY }];
      setCurrentPoints(newPoints);

      ctx.beginPath();
      ctx.strokeStyle = activeTool === 'eraser' ? '#0f172a' : currentColor;
      ctx.lineWidth = activeTool === 'eraser' ? currentWidth * 2 : currentWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const w = previewCanvas.width;
      const h = previewCanvas.height;

      ctx.moveTo(newPoints[0].x * w, newPoints[0].y * h);
      for (let i = 1; i < newPoints.length; i++) {
        ctx.lineTo(newPoints[i].x * w, newPoints[i].y * h);
      }
      ctx.stroke();
    } else if (startPos) {
      // Shape tools: line, rectangle, circle
      ctx.beginPath();
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      } else if (activeTool === 'rectangle') {
        const rx = Math.min(startPos.x, coords.x);
        const ry = Math.min(startPos.y, coords.y);
        const rw = Math.abs(coords.x - startPos.x);
        const rh = Math.abs(coords.y - startPos.y);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (activeTool === 'circle') {
        const radius = Math.hypot(coords.x - startPos.x, coords.y - startPos.y);
        ctx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = previewCanvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    const { x, y, normX, normY } = getPointerCoords(e);

    let finalPoints: { x: number; y: number }[] = [];

    if (activeTool === 'brush' || activeTool === 'eraser') {
      if (currentPoints.length > 0) {
        finalPoints = [...currentPoints, { x: normX, y: normY }];
      }
    } else if (startPos && canvas) {
      const w = canvas.width;
      const h = canvas.height;

      if (activeTool === 'line') {
        finalPoints = [
          { x: startPos.x / w, y: startPos.y / h },
          { x: normX, y: normY }
        ];
      } else if (activeTool === 'rectangle') {
        const x1 = startPos.x / w;
        const y1 = startPos.y / h;
        const x2 = normX;
        const y2 = normY;
        // Perimeter points
        finalPoints = [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
          { x: x1, y: y1 }
        ];
      } else if (activeTool === 'circle') {
        const cx = startPos.x / w;
        const cy = startPos.y / h;
        const radiusX = Math.abs(normX - cx);
        const radiusY = Math.abs(normY - cy);
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          finalPoints.push({
            x: cx + Math.cos(angle) * radiusX,
            y: cy + Math.sin(angle) * radiusY
          });
        }
      }
    }

    if (finalPoints.length > 0) {
      const stroke: WhiteboardStroke = {
        id: Math.random().toString(36).substring(2, 9),
        color: activeTool === 'eraser' ? '#0f172a' : currentColor,
        width: activeTool === 'eraser' ? currentWidth * 2 : currentWidth,
        points: finalPoints,
        userId: currentUser.id
      };
      sendWhiteboardStroke(stroke);
    }

    setCurrentPoints([]);
    setStartPos(null);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create temporary high-res export canvas with background fill
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Background slate fill
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `wanpala-whiteboard-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const totalStrokes = room?.whiteboardStrokes?.length || 0;
  const userCount = Object.keys(room?.users || {}).length;

  return (
    <div className="flex flex-col w-full h-full p-2 md:p-4 max-w-6xl mx-auto min-h-0 select-none">
      {/* Modern Structured Whiteboard Toolbar */}
      <div className="glass-panel p-2 md:px-4 md:py-2.5 rounded-2xl mb-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 shadow-xl border border-white/10 shrink-0 select-none">
        {/* Top Row on Mobile / Left Section on Desktop: Tools & Actions */}
        <div className="flex items-center justify-between gap-1.5 w-full md:w-auto">
          {/* Tool Selectors */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTool('brush')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-xs font-semibold ${
                activeTool === 'brush'
                  ? 'bg-brand-500 text-slate-950 shadow-md scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title="Brush / Freehand"
            >
              <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Draw</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('eraser')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-xs font-semibold ${
                activeTool === 'eraser'
                  ? 'bg-brand-500 text-slate-950 shadow-md scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Eraser</span>
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

            {/* Shape Tools */}
            <button
              type="button"
              onClick={() => setActiveTool('line')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                activeTool === 'line' ? 'bg-brand-500 text-slate-950' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title="Line Tool"
            >
              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('rectangle')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                activeTool === 'rectangle' ? 'bg-brand-500 text-slate-950' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title="Rectangle Tool"
            >
              <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('circle')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                activeTool === 'circle' ? 'bg-brand-500 text-slate-950' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title="Circle Tool"
            >
              <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Action Buttons (Undo, Download, Clear) */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={undoWhiteboardStroke}
              disabled={totalStrokes === 0}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Undo your last stroke"
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              title="Export drawing as PNG"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={clearWhiteboard}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 bg-red-600/30 hover:bg-red-600/50 text-red-200 hover:text-white border border-red-500/30 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              title="Clear whiteboard for everyone"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Bottom Row on Mobile / Center Section on Desktop: Color Palette & Widths */}
        <div className="flex items-center justify-between md:justify-start gap-2 pt-1 md:pt-0 border-t border-white/5 md:border-t-0">
          {/* Colors (disabled when eraser active) */}
          <div className={`flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 ${activeTool === 'eraser' ? 'opacity-40 pointer-events-none' : ''}`}>
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  setCurrentColor(color);
                  if (activeTool === 'eraser') setActiveTool('brush');
                }}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border transition-transform cursor-pointer flex-shrink-0 ${
                  currentColor === color && activeTool !== 'eraser'
                    ? 'scale-120 border-white ring-2 ring-brand-400 shadow-md'
                    : 'border-white/20 hover:scale-110 active:scale-95'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="w-[1px] h-4 bg-white/10 hidden md:block" />

          {/* Width Selection */}
          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 sm:p-1 rounded-xl border border-white/5 flex-shrink-0">
            {STROKE_WIDTHS.map(width => (
              <button
                key={width}
                type="button"
                onClick={() => setCurrentWidth(width)}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                  currentWidth === width
                    ? 'bg-brand-500/30 text-brand-300 border border-brand-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
                title={`${width}px stroke`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: Math.max(2.5, width / 2), height: Math.max(2.5, width / 2) }}
                />
              </button>
            ))}
          </div>

          {/* Live presence counter */}
          <div className="ml-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold items-center gap-1.5 hidden lg:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Users className="w-3 h-3" />
            <span>{userCount} Live</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Drawing Stage */}
      <div
        ref={containerRef}
        className="flex-1 w-full bg-[#0f172a] rounded-3xl overflow-hidden border border-white/15 shadow-2xl relative cursor-crosshair min-h-0"
        style={{ touchAction: 'none' }}
      >
        {/* Grid pattern background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Committed strokes canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pointer-events-none" />

        {/* Interactive preview canvas capturing pointer/touch events */}
        <canvas
          ref={previewCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full block touch-none"
        />

        {/* Real-time collaborator cursors */}
        {Object.values(remoteCursors).map(cursor => (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none transition-all duration-75 z-20 flex items-center gap-1 transform -translate-x-1 -translate-y-1"
            style={{
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-lg animate-ping"
              style={{ backgroundColor: cursor.userColor || '#38bdf8' }}
            />
            <div
              className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md backdrop-blur-md whitespace-nowrap"
              style={{ backgroundColor: `${cursor.userColor || '#38bdf8'}cc` }}
            >
              {cursor.userName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
