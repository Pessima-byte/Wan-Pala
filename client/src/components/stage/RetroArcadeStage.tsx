import React, { useRef, useEffect, useState } from 'react';
import { Gamepad2, Play, RotateCcw, Upload, Sparkles, Volume2, VolumeX } from 'lucide-react';

export const RetroArcadeStage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedGame, setSelectedGame] = useState<'invaders' | 'pong' | 'snake'>('invaders');
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Playable Canvas Game Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let localScore = 0;
    setScore(0);
    setGameOver(false);

    // Setup Game State based on selectedGame
    if (selectedGame === 'invaders') {
      let playerX = canvas.width / 2 - 20;
      const playerY = canvas.height - 40;
      const playerSpeed = 6;
      let leftPressed = false;
      let rightPressed = false;
      let spacePressed = false;

      let bullets: { x: number; y: number }[] = [];
      let invaders: { x: number; y: number; alive: boolean }[] = [];
      const rows = 3;
      const cols = 8;
      let invaderDirection = 1;
      let invaderStepDown = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          invaders.push({
            x: 60 + c * 50,
            y: 40 + r * 35,
            alive: true
          });
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') leftPressed = true;
        if (e.key === 'ArrowRight' || e.key === 'd') rightPressed = true;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (bullets.length < 4) {
            bullets.push({ x: playerX + 18, y: playerY });
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') leftPressed = false;
        if (e.key === 'ArrowRight' || e.key === 'd') rightPressed = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      let frameCount = 0;

      const loop = () => {
        frameCount++;
        ctx.fillStyle = '#06070d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scanlines effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let y = 0; y < canvas.height; y += 4) {
          ctx.fillRect(0, y, canvas.width, 1);
        }

        // Move player
        if (leftPressed && playerX > 10) playerX -= playerSpeed;
        if (rightPressed && playerX < canvas.width - 50) playerX += playerSpeed;

        // Draw Player Tank
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(playerX, playerY + 8, 40, 14);
        ctx.fillRect(playerX + 15, playerY, 10, 8);

        // Move and Draw Bullets
        ctx.fillStyle = '#facc15';
        bullets.forEach((b, i) => {
          b.y -= 7;
          ctx.fillRect(b.x, b.y, 4, 10);
          if (b.y < 0) bullets.splice(i, 1);
        });

        // Invaders logic
        let shiftDown = false;
        if (frameCount % 30 === 0) {
          const aliveInvaders = invaders.filter(inv => inv.alive);
          const rightmost = Math.max(...aliveInvaders.map(inv => inv.x), 0);
          const leftmost = Math.min(...aliveInvaders.map(inv => inv.x), canvas.width);

          if (rightmost > canvas.width - 70 || leftmost < 30) {
            invaderDirection *= -1;
            shiftDown = true;
          }

          invaders.forEach(inv => {
            if (!inv.alive) return;
            inv.x += invaderDirection * 15;
            if (shiftDown) inv.y += 12;
            if (inv.y > playerY - 20) {
              setGameOver(true);
            }
          });
        }

        // Draw Invaders
        invaders.forEach(inv => {
          if (!inv.alive) return;
          ctx.fillStyle = '#ec4899';
          ctx.fillRect(inv.x, inv.y, 30, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(inv.x + 6, inv.y + 6, 4, 4);
          ctx.fillRect(inv.x + 20, inv.y + 6, 4, 4);
        });

        // Bullet collisions
        bullets.forEach((b, bIdx) => {
          invaders.forEach(inv => {
            if (inv.alive && b.x > inv.x && b.x < inv.x + 30 && b.y > inv.y && b.y < inv.y + 20) {
              inv.alive = false;
              bullets.splice(bIdx, 1);
              localScore += 100;
              setScore(localScore);
            }
          });
        });

        animationId = requestAnimationFrame(loop);
      };

      animationId = requestAnimationFrame(loop);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        cancelAnimationFrame(animationId);
      };
    } else if (selectedGame === 'pong') {
      // 2 Player Pong
      let ballX = canvas.width / 2;
      let ballY = canvas.height / 2;
      let ballSpeedX = 4;
      let ballSpeedY = 3;
      let p1Y = canvas.height / 2 - 30;
      let p2Y = canvas.height / 2 - 30;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'w' && p1Y > 10) p1Y -= 20;
        if (e.key === 's' && p1Y < canvas.height - 70) p1Y += 20;
        if (e.key === 'ArrowUp' && p2Y > 10) p2Y -= 20;
        if (e.key === 'ArrowDown' && p2Y < canvas.height - 70) p2Y += 20;
      };

      window.addEventListener('keydown', handleKeyDown);

      const loop = () => {
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ball movement
        ballX += ballSpeedX;
        ballY += ballSpeedY;

        if (ballY < 10 || ballY > canvas.height - 10) ballSpeedY *= -1;

        // Paddle collisions
        if (ballX < 35 && ballY > p1Y && ballY < p1Y + 60) ballSpeedX = Math.abs(ballSpeedX);
        if (ballX > canvas.width - 45 && ballY > p2Y && ballY < p2Y + 60) ballSpeedX = -Math.abs(ballSpeedX);

        if (ballX < 0 || ballX > canvas.width) {
          ballX = canvas.width / 2;
          ballY = canvas.height / 2;
          ballSpeedX *= -1;
        }

        // Draw paddles & ball
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(20, p1Y, 12, 60);

        ctx.fillStyle = '#ec4899';
        ctx.fillRect(canvas.width - 32, p2Y, 12, 60);

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
        ctx.fill();

        animationId = requestAnimationFrame(loop);
      };

      animationId = requestAnimationFrame(loop);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        cancelAnimationFrame(animationId);
      };
    }
  }, [selectedGame]);

  return (
    <div className="flex flex-col w-full h-full p-3 md:p-6 max-w-6xl mx-auto items-center">
      {/* Top Arcade Selector */}
      <div className="flex flex-wrap items-center justify-between w-full mb-4 bg-lounge-800/90 p-3 rounded-xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
          <span className="font-pixel text-xs text-purple-300">WAN PALA ARCADE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedGame('invaders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedGame === 'invaders' ? 'bg-purple-600 text-white shadow' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            👾 Galaxy Invaders
          </button>
          <button
            onClick={() => setSelectedGame('pong')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedGame === 'pong' ? 'bg-purple-600 text-white shadow' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            🏓 2-Player Pong
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-pixel text-xs text-amber-400">SCORE: {score.toString().padStart(5, '0')}</div>
        </div>
      </div>

      {/* Arcade CRT Cabinet Display */}
      <div className="relative w-full max-w-2xl aspect-[4/3] bg-black rounded-3xl p-4 border-4 border-slate-800 shadow-[0_0_50px_rgba(147,51,234,0.3)] flex flex-col items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={450}
          className="w-full h-full object-contain rounded-xl"
        />

        {/* CRT Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/[0.02] to-transparent bg-[length:100%_4px]" />

        {/* Gamepad HUD Guide */}
        <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
          <span className="text-[10px] text-slate-400 font-mono bg-black/70 px-2 py-0.5 rounded border border-white/5">
            Controls: Arrow Keys / WASD + Space to Fire
          </span>
        </div>
      </div>
    </div>
  );
};
