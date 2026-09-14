export interface RoomTheme {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  ambientSound?: string;
}

export const ROOM_THEMES: Record<string, RoomTheme> = {
  'lofi-cafe': {
    id: 'lofi-cafe',
    name: 'Lo-Fi Rain Cafe',
    description: 'Cozy rainy cafe with warm lighting and chill vibes',
    previewUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    ambientSound: 'rain',
  },
  'cyberpunk-loft': {
    id: 'cyberpunk-loft',
    name: 'Cyberpunk Neon Loft',
    description: 'High-rise neon skyline apartment with holographic glow',
    previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    ambientSound: 'city',
  },
  'retro-arcade': {
    id: 'retro-arcade',
    name: 'Retro Arcade Lounge',
    description: '80s pixel-neon arcade cabinets and nostalgia',
    previewUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    ambientSound: 'arcade',
  },
  'sunset-drivein': {
    id: 'sunset-drivein',
    name: 'Sunset Drive-In',
    description: 'Outdoor sunset cinema under twilight stars',
    previewUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ambientSound: 'waves',
  },
  'anime-bedroom': {
    id: 'anime-bedroom',
    name: 'Cozy Anime Room',
    description: 'Pastel lo-fi bedroom with hanging fairy lights',
    previewUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    ambientSound: 'vinyl',
  },
  'minimal-dark': {
    id: 'minimal-dark',
    name: 'Minimal Deep Dark',
    description: 'Sleek, distraction-free matte black theater aesthetic',
    previewUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80',
    ambientSound: 'none',
  },
};
