# WAN PALA - Native Mobile App (iOS & Android)

The native mobile client for WAN PALA, built with React Native and Expo. Connects in real-time to the WAN PALA backend room server.

## Features

- **Lounge Room Management**: Create instant rooms or join by room code with customizable avatars.
- **Synchronized Watch Party**: Native YouTube stage with real-time synchronized play, pause, and seek controls across all room members.
- **Instant YouTube Search**: In-app search modal with instant single-tap video launching.
- **Activity Launcher**: Launch and switch between shared lounge activities (YouTube, Whiteboard, Card Table, Chess).
- **Lounge Chat & Reactions**: Real-time room chat with one-tap emoji reaction bar.
- **Audio & Video Controls**: Toggle mic and camera with presence indicators.

## Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Expo Development Server:**
   ```bash
   npm start
   ```
   Or from the root directory:
   ```bash
   npm run mobile
   ```

3. **Run on Device or Simulator:**
   - **iOS Simulator:** Press `i` in the Expo terminal
   - **Android Emulator:** Press `a` in the Expo terminal
   - **Physical Phone (iOS/Android):** Scan the QR code using the **Expo Go** app from the App Store or Google Play Store.

## Connecting to Backend

In the mobile app home screen, tap the gear icon in the top right to configure your backend URL (e.g. `http://192.168.1.X:5001` for local network testing, or your Cloudflare tunnel URL).
