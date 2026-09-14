// Configuration for mobile connection to backend
export const DEFAULT_SERVER_URL = 'http://localhost:5001';

export const SERVER_CONFIG = {
  // Set your LAN IP (e.g., http://192.168.1.X:5001) or Cloudflare Tunnel URL when testing on physical phone
  BASE_URL: DEFAULT_SERVER_URL,
  SOCKET_URL: DEFAULT_SERVER_URL,
};
