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
    keyIsolationId: 'MLKEM1024-ENCLAVE-MAIN-9F4A',
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
    keyIsolationId: 'MLKEM1024-ENCLAVE-DEGEN-3C8E',
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
    keyIsolationId: 'MLKEM1024-ENCLAVE-DEV-7B1D',
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
    keyIsolationId: 'MLKEM1024-EPHEMERAL-BURNER-0X99',
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
  solos: 'linear-gradient(145deg, #1e1b4b, #090d16)',
  cloner: 'linear-gradient(145deg, #0ea5e9, #2563eb)',
  phantom: 'linear-gradient(145deg, #a855f7, #6366f1)',
  solflare: 'linear-gradient(145deg, #f97316, #ea580c)',
  backpack: 'linear-gradient(145deg, #ef4444, #b91c1c)',
  browser: 'linear-gradient(145deg, #3b82f6, #1d4ed8)',
  cursor: 'linear-gradient(145deg, #334155, #0f172a)',
  anchor: 'linear-gradient(145deg, #10b981, #059669)',
  vault: 'linear-gradient(145deg, #ec4899, #8b5cf6)',
  burner: 'linear-gradient(145deg, #f59e0b, #dc2626)',
} as const;
