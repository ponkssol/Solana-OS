import { create } from 'zustand';
import { WALLPAPER } from '../components/macosMaterials';

export const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';

export interface WallpaperOption {
  id: string;
  label: string;
  css: string;
}

export const BUILT_IN_WALLPAPERS: WallpaperOption[] = [
  { id: 'sonoma', label: 'Sonoma', css: `center / cover no-repeat url("${WALLPAPER}")` },
  { id: 'solana', label: 'Solana', css: 'linear-gradient(135deg, #1a0b3d 0%, #4b1f9e 45%, #14f195 120%)' },
  { id: 'midnight', label: 'Midnight', css: 'radial-gradient(circle at 30% 20%, #23395d 0%, #0b1020 60%, #05070d 100%)' },
  { id: 'ember', label: 'Ember', css: 'linear-gradient(160deg, #2b0f0f 0%, #8a2b12 55%, #f0a04b 120%)' },
  { id: 'graphite', label: 'Graphite', css: 'linear-gradient(180deg, #2a2a2e 0%, #141416 100%)' },
];

export interface Prefs {
  autoLockMinutes: number;
  idleFreezeMinutes: number;
  wallpaperId: string;
  customWallpaper: string;
  rpcUrl: string;
  walletAddress: string;
}

const KEY = 'solana-os.prefs.v1';

const DEFAULTS: Prefs = {
  autoLockMinutes: 10,
  idleFreezeMinutes: 0,
  wallpaperId: 'sonoma',
  customWallpaper: '',
  rpcUrl: DEFAULT_RPC_URL,
  walletAddress: '',
};

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

interface PrefsStore extends Prefs {
  update: (patch: Partial<Prefs>) => void;
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch);
    const { update: _update, ...prefs } = { ...get(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // A custom image too large for localStorage still applies for this session.
    }
  },
}));

export function wallpaperCss(prefs: Pick<Prefs, 'wallpaperId' | 'customWallpaper'>): string {
  if (prefs.wallpaperId === 'custom' && prefs.customWallpaper) {
    return `center / cover no-repeat url("${prefs.customWallpaper}")`;
  }
  return (BUILT_IN_WALLPAPERS.find((w) => w.id === prefs.wallpaperId) ?? BUILT_IN_WALLPAPERS[0]).css;
}

// localStorage caps out around 5 MB, so photos are re-encoded to at most 1920px wide.
export function downscaleImage(file: File, maxWidth = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image this app can read.'));
    };
    img.src = url;
  });
}

