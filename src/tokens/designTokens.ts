export type RoomId = 'main' | 'degen' | 'dev' | 'burner';

export interface RoomConfig {
  id: RoomId;
  label: string;
  shortLabel: string;
  accentColor: string;
  accentGlow: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
  keyIsolationId: string;
  publicKeyShort: string;
  isolationPolicy: string;
}

export const ROOM_CONFIGS: Record<RoomId, RoomConfig> = {
  main: {
    id: 'main',
    label: 'Main Room',
    shortLabel: 'Room: Main',
    accentColor: '#14f195',
    accentGlow: '0 0 8px #14f195',
    badgeBg: 'rgba(20, 241, 149, 0.14)',
    badgeBorder: 'rgba(20, 241, 149, 0.38)',
    description: 'Primary Sovereign Enclave • Cold/Warm Portfolio & Core Governance',
    keyIsolationId: 'ROOM-MAIN-9F4A',
    publicKeyShort: '7xKX...9f4A (nanda.solos)',
    isolationPolicy: 'Strict Hardware Passkey + 24-Word Lattice Split',
  },
  degen: {
    id: 'degen',
    label: 'Degen Room',
    shortLabel: 'Room: Degen',
    accentColor: '#f43f5e',
    accentGlow: '0 0 8px #f43f5e',
    badgeBg: 'rgba(244, 63, 94, 0.16)',
    badgeBorder: 'rgba(244, 63, 94, 0.42)',
    description: 'High-Frequency Memecoin Desk • GMGN Scanner & Rug Shield Sandbox',
    keyIsolationId: 'ROOM-DEGEN-3C8E',
    publicKeyShort: 'Dg9V...3c8E (degen.nanda.solos)',
    isolationPolicy: 'Capped Spend Allowance • Auto-Revoke Unknown Approvals',
  },
  dev: {
    id: 'dev',
    label: 'Dev Room',
    shortLabel: 'Room: Dev',
    accentColor: '#38bdf8',
    accentGlow: '0 0 8px #38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    badgeBorder: 'rgba(56, 189, 248, 0.42)',
    description: 'Anchor / Rust SVM Builder • Localnet Validator & Frozen Cursor IDE',
    keyIsolationId: 'ROOM-DEV-7B1D',
    publicKeyShort: 'Dv4L...7b1D (dev.nanda.solos)',
    isolationPolicy: 'Devnet / Testnet Signer • Mainnet Deploy Multisig Gate',
  },
  burner: {
    id: 'burner',
    label: 'Burner Room',
    shortLabel: 'Room: Burner',
    accentColor: '#f59e0b',
    accentGlow: '0 0 8px #f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    badgeBorder: 'rgba(245, 158, 11, 0.42)',
    description: 'Ephemeral Zero-Trace Sandbox • Auto-Shredding Session Keys',
    keyIsolationId: 'ROOM-BURNER-0X99',
    publicKeyShort: 'Br0X...0x99 (ephemeral.solos)',
    isolationPolicy: 'RAM-Only Ephemeral Subkey • Shreds on Room Exit or Lock',
  },
};

export const BRAND_ASSETS = {
  logoWhite: '/assets/logo-white.png',
  logoDark: '/assets/logo-dark.png',
  emblemWhite: '/assets/emblem-white.png',
  emblemDark: '/assets/emblem-dark.png',
  emblemOnlyWhite: '/assets/emblem-only-white.png',
  emblemOnlyDark: '/assets/emblem-only-dark.png',
} as const;

export const TRAFFIC_LIGHTS = {
  close: '#FF5F56',
  minimize: '#FFBD2E',
  maximize: '#27C93F',
} as const;

export const SQUIRCLE_GRADIENTS = {
  solos: '#14151c',
  cloner: '#0A84FF',
  phantom: '#7c5cbf',
  solflare: '#ea580c',
  backpack: '#b91c1c',
  browser: '#0A84FF',
  cursor: '#1e293b',
  anchor: '#059669',
  vault: '#7c3aed',
  burner: '#d97706',
} as const;
