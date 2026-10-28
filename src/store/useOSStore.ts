import { create } from 'zustand';
import { ROOM_CONFIGS, RoomId } from '../tokens/designTokens';
import {
  ipcGetVaultStatus,
  ipcLockVaultSolos,
  ipcSwitchRoom,
  ipcUnlockVaultSolos,
  isTauriRuntime,
} from '../lib/tauriIpc';

export type OSScreenState = 'boot' | 'lock' | 'desktop';
export type ShellView = 'sandboxes' | 'vault' | 'shield' | 'builder' | 'terminal';
export type WalletBrandName = 'phantom' | 'solflare' | 'backpack';

export type WindowId =
  | 'vault-monitor'
  | 'degen-terminal'
  | 'dev-console'
  | 'burner-session'
  | 'app-cloner'
  | 'phantom-wallet'
  | 'solflare-wallet'
  | 'backpack-wallet';

export interface OSWindow {
  id: WindowId;
  title: string;
  subtitle: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isFrozen?: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  room: RoomId | 'all';
  badgeText: string;
}

export interface VaultEnclaveState {
  enclaveName: string;
  identity: string;
  cipherSuite: 'ML-KEM-1024';
  locked: boolean;
  keyIsolationId: string;
  shieldActive: boolean;
  onChainVerified: boolean;
  lastHandshakeMs: number;
  ipcBridgeMode: 'tauri-v2-native' | 'browser-enclave-sim';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: string;
  room: RoomId;
  cipher: string;
}

interface OSStoreState {
  screen: OSScreenState;
  bootProgress: number;
  bootStatusText: string;
  activeRoom: RoomId;
  vault: VaultEnclaveState;
  windows: OSWindow[];
  topZIndex: number;
  clonedAppsCount: number;
  auditLogs: AuditLogEntry[];
  spotlightOpen: boolean;
  displayBrightness: number;
  shellView: ShellView;
  roomFilter: string | null;
  walletBrand: WalletBrandName | null;
  settingsOpen: boolean;
  terminalOpen: boolean;
  processFreezeActive: boolean;
  frozenProcessCount: number;

  setScreen: (screen: OSScreenState) => void;
  setBootProgress: (progress: number, statusText?: string) => void;
  advanceToLockScreen: () => void;
  unlockVault: (passphrase?: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
  toggleVaultLock: () => Promise<void>;
  toggleShield: () => void;
  switchRoom: (room: RoomId) => Promise<void>;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  minimizeWindow: (id: WindowId) => void;
  toggleMaximizeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  updateWindowPosition: (id: WindowId, x: number, y: number) => void;
  spawnClonedInstance: (targetApp: string, targetRoom: RoomId) => void;
  syncVaultStatus: () => Promise<void>;
  toggleWindowFreeze: (id: WindowId) => void;
  toggleProcessFreeze: () => void;
  setSpotlightOpen: (open: boolean) => void;
  setDisplayBrightness: (value: number) => void;
  setShellView: (view: ShellView) => void;
  setRoomFilter: (room: string | null) => void;
  setWalletBrand: (brand: WalletBrandName | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
}

const INITIAL_WINDOWS: OSWindow[] = [
  {
    id: 'vault-monitor',
    title: 'vault.solos — Post-Quantum Enclave Monitor',
    subtitle: 'ML-KEM-1024 Lattice Key Isolation & Hardware Shield',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 12,
    position: { x: 72, y: 64 },
    size: { width: 920, height: 540 },
    room: 'all',
    badgeText: 'ML-KEM-1024 • SEALED',
  },
  {
    id: 'degen-terminal',
    title: 'Degen Room — GMGN & Meme Alpha Scanner',
    subtitle: 'Research-Only Rug Shield • Authority & LP Lock Inspector',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 11,
    position: { x: 240, y: 110 },
    size: { width: 700, height: 460 },
    room: 'degen',
    badgeText: 'DEGEN ENCLAVE • SHIELD ON',
  },
  {
    id: 'dev-console',
    title: 'Solana Builder Terminal & Anchor SVM Console',
    subtitle: 'SVM Mainnet/Localnet RPC Telemetry & Frozen Cursor IDE Bridge',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
     isFrozen: true,
    zIndex: 10,
    position: { x: 290, y: 125 },
    size: { width: 680, height: 440 },
    room: 'dev',
    badgeText: 'DEV ENCLAVE • ANCHOR v0.31',
  },
  {
    id: 'burner-session',
    title: 'Burner Room — Ephemeral Zero-Trace Enclave',
    subtitle: 'RAM-Only Subkey • Auto-Shredding Disposable Wallet Sandbox',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 9,
    position: { x: 320, y: 140 },
    size: { width: 610, height: 410 },
    room: 'burner',
    badgeText: 'EPHEMERAL • RAM-ONLY',
  },
  {
    id: 'app-cloner',
    title: 'Solana OS App Cloner (+)',
    subtitle: 'Spawn Room-Isolated Standalone Instances (Phantom, Solflare, Cursor, Browser)',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    zIndex: 18,
    position: { x: 36, y: 48 },
    size: { width: 1040, height: 620 },
    room: 'all',
    badgeText: 'SANDBOX CLONER',
  },
  {
    id: 'phantom-wallet',
    title: 'Phantom Standalone — Enclave Bound',
    subtitle: 'Isolated Keychain Tunnel via vault.solos • Zero Browser Extension Leak',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 7,
    position: { x: 150, y: 88 },
    size: { width: 860, height: 500 },
    room: 'main',
    badgeText: 'STANDALONE WALLET',
  },
  {
    id: 'solflare-wallet',
    title: 'Solflare Standalone — Staking Enclave',
    subtitle: 'Marinade & native stake bound to vault.solos',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 6,
    position: { x: 180, y: 96 },
    size: { width: 860, height: 500 },
    room: 'main',
    badgeText: 'SOLFLARE',
  },
  {
    id: 'backpack-wallet',
    title: 'Backpack Standalone — xNFT Enclave',
    subtitle: 'Tensor & xNFT signer isolated from the host browser',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 5,
    position: { x: 220, y: 120 },
    size: { width: 860, height: 500 },
    room: 'degen',
    badgeText: 'BACKPACK',
  },
];

function nowTimeLabel(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const useOSStore = create<OSStoreState>((set, get) => ({
  screen: 'boot',
  bootProgress: 0,
  bootStatusText: 'Initializing Solana OS Microkernel • SVM Enclave Core',
  activeRoom: 'main',
  vault: {
    enclaveName: 'vault.solos',
    identity: 'nanda.solos',
    cipherSuite: 'ML-KEM-1024',
    locked: true,
    keyIsolationId: ROOM_CONFIGS.main.keyIsolationId,
    shieldActive: true,
    onChainVerified: true,
    lastHandshakeMs: 12,
    ipcBridgeMode: isTauriRuntime() ? 'tauri-v2-native' : 'browser-enclave-sim',
  },
  windows: INITIAL_WINDOWS,
  topZIndex: 20,
  clonedAppsCount: 2,
  spotlightOpen: false,
  displayBrightness: 100,
  shellView: 'sandboxes',
  roomFilter: null,
  walletBrand: null,
  settingsOpen: false,
  terminalOpen: false,
  processFreezeActive: true,
  frozenProcessCount: 3,
  auditLogs: [
    {
      id: 'init-1',
      timestamp: '01:14:02',
      event: 'Mounted vault.solos post-quantum lattice enclave',
      room: 'main',
      cipher: 'ML-KEM-1024',
    },
    {
      id: 'init-2',
      timestamp: '01:14:08',
      event: 'On-chain attestation verified for nanda.solos',
      room: 'main',
      cipher: 'ML-KEM-1024',
    },
  ],

  setScreen: (screen) => set({ screen }),

  setBootProgress: (bootProgress, bootStatusText) =>
    set((state) => ({
      bootProgress,
      bootStatusText: bootStatusText ?? state.bootStatusText,
    })),

  advanceToLockScreen: () =>
    set({
      screen: 'lock',
      bootProgress: 100,
      bootStatusText: 'vault.solos Enclave Ready • ML-KEM-1024 Verified',
    }),

  unlockVault: async (passphrase = '••••••••') => {
    try {
      const payload = await ipcUnlockVaultSolos(passphrase);
      set((state) => ({
        screen: 'desktop',
        vault: {
          ...state.vault,
          locked: payload.locked,
          keyIsolationId: payload.keyIsolationId,
          lastHandshakeMs: payload.lastHandshakeMs,
        },
        auditLogs: [
          {
            id: `unlock-${Date.now()}`,
            timestamp: nowTimeLabel(),
            event: `Unsealed vault.solos for ${payload.identity} (${ROOM_CONFIGS[state.activeRoom].label})`,
            room: state.activeRoom,
            cipher: 'ML-KEM-1024',
          },
          ...state.auditLogs.slice(0, 14),
        ],
      }));
      return true;
    } catch {
      return false;
    }
  },

  lockVault: async () => {
    const payload = await ipcLockVaultSolos();
    set((state) => ({
      screen: 'lock',
      vault: {
        ...state.vault,
        locked: payload.locked,
      },
      auditLogs: [
        {
          id: `lock-${Date.now()}`,
          timestamp: nowTimeLabel(),
          event: 'Sealed vault.solos enclave & zeroed ephemeral session buffers',
          room: state.activeRoom,
          cipher: 'ML-KEM-1024',
        },
        ...state.auditLogs.slice(0, 14),
      ],
    }));
  },

  toggleVaultLock: async () => {
    const { vault, lockVault, unlockVault } = get();
    if (vault.locked) {
      await unlockVault('passkey-enclave-token');
    } else {
      await lockVault();
    }
  },

  toggleShield: () =>
    set((state) => ({
      vault: {
        ...state.vault,
        shieldActive: !state.vault.shieldActive,
      },
      auditLogs: [
        {
          id: `shield-${Date.now()}`,
          timestamp: nowTimeLabel(),
          event: `Quantum Transaction Shield ${!state.vault.shieldActive ? 'ENABLED' : 'PAUSED'}`,
          room: state.activeRoom,
          cipher: 'ML-KEM-1024',
        },
        ...state.auditLogs.slice(0, 14),
      ],
    })),

  switchRoom: async (room) => {
    const payload = await ipcSwitchRoom(room);
    const nextZ = get().topZIndex + 1;

    const defaultRoomWindowMap: Record<RoomId, WindowId> = {
      main: 'vault-monitor',
      degen: 'degen-terminal',
      dev: 'dev-console',
      burner: 'burner-session',
    };
    const targetWinId = defaultRoomWindowMap[room];

    set((state) => ({
      activeRoom: room,
      topZIndex: nextZ,
      vault: {
        ...state.vault,
        keyIsolationId: payload.keyIsolationId,
        lastHandshakeMs: payload.lastHandshakeMs,
      },
      windows: state.windows.map((w) =>
        w.id === targetWinId
          ? { ...w, isOpen: true, isMinimized: false, zIndex: nextZ }
          : w
      ),
      auditLogs: [
        {
          id: `room-${Date.now()}`,
          timestamp: nowTimeLabel(),
          event: `Switched isolated namespace -> ${ROOM_CONFIGS[room].label} (${payload.keyIsolationId})`,
          room,
          cipher: 'ML-KEM-1024',
        },
        ...state.auditLogs.slice(0, 14),
      ],
    }));
  },

  openWindow: (id) =>
    set((state) => {
      const nextZ = state.topZIndex + 1;
      return {
        topZIndex: nextZ,
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, isOpen: true, isMinimized: false, zIndex: nextZ }
            : w
        ),
      };
    }),

  closeWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isOpen: false, isMinimized: false, isMaximized: false } : w
      ),
    })),

  minimizeWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true, isMaximized: false } : w
      ),
    })),

  toggleMaximizeWindow: (id) =>
    set((state) => {
      const nextZ = state.topZIndex + 1;
      return {
        topZIndex: nextZ,
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, isMaximized: !w.isMaximized, isMinimized: false, zIndex: nextZ }
            : w
        ),
      };
    }),

  focusWindow: (id) =>
    set((state) => {
      const nextZ = state.topZIndex + 1;
      return {
        topZIndex: nextZ,
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w
        ),
      };
    }),

  updateWindowPosition: (id, x, y) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, position: { x, y } } : w
      ),
    })),

  spawnClonedInstance: (targetApp, targetRoom) =>
    set((state) => ({
      clonedAppsCount: state.clonedAppsCount + 1,
      auditLogs: [
        {
          id: `clone-${Date.now()}`,
          timestamp: nowTimeLabel(),
          event: `Cloned isolated ${targetApp} container bound to ${ROOM_CONFIGS[targetRoom].label}`,
          room: targetRoom,
          cipher: 'ML-KEM-1024',
        },
        ...state.auditLogs.slice(0, 14),
      ],
    })),

  toggleWindowFreeze: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isFrozen: !w.isFrozen } : w
      ),
      frozenProcessCount: state.windows.filter((w) =>
        w.id === id ? !w.isFrozen : w.isFrozen
      ).length,
    })),

  toggleProcessFreeze: () =>
    set((state) => {
      const next = !state.processFreezeActive;
      return {
        processFreezeActive: next,
        frozenProcessCount: next ? 3 : 0,
        windows: state.windows.map((w) =>
          w.id === 'dev-console' ? { ...w, isFrozen: next } : w
        ),
        auditLogs: [
          {
            id: `freeze-${Date.now()}`,
            timestamp: nowTimeLabel(),
            event: next
              ? 'Process Freeze engaged • NtSuspendProcess (0% CPU)'
              : 'Process Freeze released • NtResumeProcess',
            room: state.activeRoom,
            cipher: 'ML-KEM-1024',
          },
          ...state.auditLogs.slice(0, 14),
        ],
      };
    }),

  setSpotlightOpen: (spotlightOpen) => set({ spotlightOpen }),

  setDisplayBrightness: (displayBrightness) => set({ displayBrightness }),

  setShellView: (shellView) => set({ shellView, terminalOpen: shellView === 'terminal' }),

  setRoomFilter: (roomFilter) => set({ roomFilter, shellView: 'sandboxes', terminalOpen: false }),

  setWalletBrand: (walletBrand) => set({ walletBrand }),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  setTerminalOpen: (terminalOpen) =>
    set((state) => ({
      terminalOpen,
      shellView: terminalOpen ? 'terminal' : state.shellView === 'terminal' ? 'builder' : state.shellView,
    })),

  syncVaultStatus: async () => {
    const status = await ipcGetVaultStatus();
    set((state) => ({
      vault: {
        ...state.vault,
        locked: status.locked,
        keyIsolationId: status.keyIsolationId,
        lastHandshakeMs: status.lastHandshakeMs,
      },
    }));
  },
}));
