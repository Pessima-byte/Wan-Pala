# 🛋️ Live With You

A browser-native virtual hangout and watch party platform built to match **[Kosmi.io](https://app.kosmi.io/)**.

Host synchronized movie nights, screen share Netflix or games, talk over WebRTC voice and video, play retro arcade games, draw on a shared whiteboard, or shuffle cards—all directly in your browser with **zero plugins, zero downloads, and zero mandatory signups**.

---

## ✨ Features (Kosmi Clone Architecture)

### 1. 🎬 Synchronized Watch Parties
- **YouTube Watch Party:** Millisecond play/pause/seek synchronization across all room participants with a collaborative playlist queue and search.
- **Screen & Tab Sharing:** Stream Netflix, Disney+, Anime, or desktop games directly with audio via WebRTC.
- **Local Video Sync (P2P):** Load local `.mp4`, `.mkv`, or `.webm` files directly from your computer—synced playback across friends with **zero cloud upload**.

### 2. 🎮 Kosmi Arcade & Interactive Lounge Apps
- **👾 Retro Arcade & SNES:** Built-in playable retro canvas games (Galaxy Invaders, 2-Player Pong) with CRT scanline visuals and controller inputs.
- **🎨 Collaborative Whiteboard:** Real-time multi-user drawing canvas with color palette, brush sizes, and instant stroke broadcast.
- **🃏 Virtual Card Lounge:** Poker & card table with community cards, chip stacks, pot tracking, and dealing controls.
- **🌧️ Lo-Fi Ambient Soundscapes:** Web Audio API sound synthesizers for Cozy Rain, Warm Cafe, Crackling Fireplace, and Vinyl Dust.

### 3. 🎙️ WebRTC Voice & Video Mesh
- Browser-native WebRTC peer-to-peer audio and video mesh.
- Participant avatars, speaking glow rings, mic mute badges, and camera toggles.
- Google STUN traversal for NAT and firewall traversal.

### 4. 💬 Real-Time Chat & Room Customization
- Live chat drawer with instant messaging, system event notifications, and quick emoji reactions with confetti bursts.
- Dynamic virtual wallpapers: **Lo-Fi Rain Cafe**, **Cyberpunk Neon Loft**, **Retro Arcade**, **Sunset Drive-In**, and **Cozy Anime Room**.
- Instant guest onboarding: pick an emoji avatar and name, or join with 1-click shareable room links (`/room/<slug>`).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# In the root directory:
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Run Locally
```bash
# Start both backend and frontend concurrently:
npm run dev

# Or in separate terminal windows:
# Terminal 1 (Server on http://localhost:3001):
npm run dev --prefix server

# Terminal 2 (Client on http://localhost:5173):
npm run dev --prefix client
```

Open `http://localhost:5173` in your browser. Click **"Spin Up an Instant Room"**, share the URL with your friends (or open in another browser window/tab), and start hanging out!

### 3. Run Verification Tests
```bash
npm run test --prefix server
```
