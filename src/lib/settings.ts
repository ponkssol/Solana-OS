import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { WALLPAPER } from '../components/macosMaterials';
import { isTauriRuntime } from './tauriIpc';

// Fallback until the host reports its built-in default (the Solana OS RPC proxy).
export const DEFAULT_RPC_URL = 'https://solana-os-rpc-proxy.vercel.app';
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

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
  /** Effective endpoint for this session: the custom RPC from the vault, else the default. */
  rpcUrl: string;
  /** Custom RPC opened from the vault; never written to localStorage. */
  customRpcUrl: string;
  defaultRpcUrl: string;
}

// Session-only fields: a custom RPC URL can embed a provider token.
const RUNTIME_KEYS = ['rpcUrl', 'customRpcUrl', 'defaultRpcUrl'] as const;

const PREFS_SLOT = 'solana-os.prefs.v1';

const DEFAULTS: Prefs = {
  autoLockMinutes: 10,
  idleFreezeMinutes: 0,
  wallpaperId: 'sonoma',
  customWallpaper: '',
  rpcUrl: DEFAULT_RPC_URL,
  customRpcUrl: '',
  defaultRpcUrl: DEFAULT_RPC_URL,
};

// Earlier builds kept a user-entered rpcUrl in localStorage; it moves into the vault on unlock.
let legacyRpcUrl = '';
// Defaults of earlier builds are not user choices, so they are not migrated.
const LEGACY_DEFAULTS = [DEFAULT_RPC_URL, 'https://api.mainnet-beta.solana.com'];

function load(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_SLOT) || '{}') as Record<string, unknown>;
    if (typeof stored.rpcUrl === 'string' && !LEGACY_DEFAULTS.includes(stored.rpcUrl)) legacyRpcUrl = stored.rpcUrl;
    for (const key of RUNTIME_KEYS) delete stored[key];
    return { ...DEFAULTS, ...stored };
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
    const { update: _update, ...prefs } = { ...get(), ...patch } as Partial<PrefsStore>;
    for (const key of RUNTIME_KEYS) delete prefs[key];
    try {
      localStorage.setItem(PREFS_SLOT, JSON.stringify(prefs));
    } catch {
      // A custom image too large for localStorage still applies for this session.
    }
  },
}));

export async function loadRpcDefaults(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { mainnet } = await invoke<{ mainnet: string; devnet: string }>('rpc_defaults');
    const { customRpcUrl } = usePrefs.getState();
    usePrefs.setState({ defaultRpcUrl: mainnet, rpcUrl: customRpcUrl || mainnet });
  } catch {
    // Keep the built-in fallback.
  }
}

/** Applies the custom RPC opened from the vault (or clears it with null). */
export function applyCustomRpc(url: string | null): void {
  const custom = url?.trim() ?? '';
  usePrefs.setState((s) => ({ customRpcUrl: custom, rpcUrl: custom || s.defaultRpcUrl }));
}

/** Seals the custom RPC in the vault; an empty URL restores the default endpoint. */
export async function saveCustomRpc(passphrase: string, url: string): Promise<void> {
  await invoke('set_custom_rpc', { passphrase, url: url.trim() });
  applyCustomRpc(url);
}

/** After unlock: apply the vault's custom RPC, migrating a legacy plaintext one once. */
export async function restoreCustomRpc(passphrase: string, sealed: string | null | undefined): Promise<void> {
  if (!sealed && legacyRpcUrl && isTauriRuntime()) {
    try {
      await saveCustomRpc(passphrase, legacyRpcUrl);
      legacyRpcUrl = '';
      usePrefs.getState().update({});
      return;
    } catch {
      // Fall through and use the default endpoint.
    }
  }
  applyCustomRpc(sealed ?? null);
}

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

