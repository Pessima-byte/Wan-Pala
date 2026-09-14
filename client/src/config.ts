// Production backend hosted on Render
export const BACKEND_URL =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://wan-pala.onrender.com');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return cleanPath;
  }
  return `${BACKEND_URL}${cleanPath}`;
}
