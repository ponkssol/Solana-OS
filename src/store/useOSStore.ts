import { create } from 'zustand';
import { ROOM_CONFIGS, RoomId } from '../tokens/designTokens';
import {
  ipcGetVaultStatus,
  ipcLockVaultSolos,
  ipcSetShellPresentation,
  ipcSwitchRoom,
  ipcUnlockVaultSolos,
  ipcOpenVault,
  isTauriRuntime,
  type ContainmentEvent,
  type ShellPresentation,
} from '../lib/tauriIpc';
import { readSealedVault } from '../lib/vaultBlob';
import {
  getEnclaveStatus,
  launchInstalledApp,
  listInstalledApps,
  loadAppIcons,
  toggleFreezeProcess,
  type InstalledApp,
  type SandboxInstance,
} from '../lib/tauriBridge';

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

export interface HostedAppWindow {
  key: string;
  hwnd: string | null;
  instanceId: string;
  title: string;
  appName: string;
  roomId: string;
  primary: boolean;
  isMinimized: boolean;
}

export interface InstanceBadge {
  exePath: string;
  cloned: boolean;
  cloneNumber: number;
}

export interface ShellNotification {
  id: string;
  title: string;
  body: string;
  at: number;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

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
  cipherSuite: string;
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
  hosted: HostedAppWindow[];
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
  shellMode: ShellPresentation;
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
  updateWindowFrame: (
    id: WindowId,
    frame: { x: number; y: number; width: number; height: number },
  ) => void;
  openHostedApp: (seed: { instanceId: string; appName: string; roomId: string } & InstanceBadge) => void;
  applyContainmentEvent: (event: ContainmentEvent) => void;
  focusHosted: (key: string) => string | null;
  focusHostedInstance: (instanceId: string) => string | null;
  removeHostedInstance: (instanceId: string) => void;
  toggleShellMode: () => Promise<void>;
  spawnClonedInstance: (targetApp: string, targetRoom: RoomId) => void;
  syncVaultStatus: () => Promise<void>;
  toggleWindowFreeze: (id: WindowId) => void;
  toggleProcessFreeze: () => Promise<void>;
  setSpotlightOpen: (open: boolean) => void;
  setDisplayBrightness: (value: number) => void;
  setShellView: (view: ShellView) => void;
  setRoomFilter: (room: string | null) => void;
  setWalletBrand: (brand: WalletBrandName | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  installedApps: InstalledApp[];
  appsState: LoadState;
  appsError: string;
  icons: Record<string, string>;
  instanceBadges: Record<string, InstanceBadge>;
  launchpadOpen: boolean;
  notifications: ShellNotification[];
  setLaunchpadOpen: (open: boolean) => void;
  loadInstalledApps: () => Promise<void>;
  requestIcons: (paths: string[]) => Promise<void>;
  launchApp: (app: InstalledApp, clone: boolean) => Promise<void>;
  rememberInstances: (instances: SandboxInstance[]) => void;
  notify: (title: string, body: string) => void;
  dismissNotification: (id: string) => void;
}

const pendingIcons = new Set<string>();

const INITIAL_WINDOWS: OSWindow[] = [
  {
    id: 'vault-monitor',
    title: 'vault.solos — Post-Quantum Enclave Monitor',
    subtitle: 'Argon2id + XChaCha20-Poly1305 sealed container',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 12,
    position: { x: 72, y: 64 },
    size: { width: 920, height: 540 },
    room: 'all',
    badgeText: 'SEALED',
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
    isOpen: false,
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
    identity: '',
    cipherSuite: 'Argon2id + XChaCha20-Poly1305',
    locked: true,
    keyIsolationId: ROOM_CONFIGS.main.keyIsolationId,
    shieldActive: false,
    onChainVerified: false,
    lastHandshakeMs: 0,
    ipcBridgeMode: isTauriRuntime() ? 'tauri-v2-native' : 'browser-enclave-sim',
  },
  windows: INITIAL_WINDOWS,
  hosted: [],
  topZIndex: 20,
  clonedAppsCount: 0,
  spotlightOpen: false,
  displayBrightness: 100,
  shellView: 'sandboxes',
  roomFilter: null,
  walletBrand: null,
  settingsOpen: false,
  terminalOpen: false,
  shellMode: 'os',
  processFreezeActive: false,
  frozenProcessCount: 0,
  auditLogs: [],
  installedApps: [],
  appsState: 'idle',
  appsError: '',
  icons: {},
  instanceBadges: {},
  launchpadOpen: false,
  notifications: [],

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
      bootStatusText: 'vault.solos ready',
    }),

  unlockVault: async (passphrase = '••••••••') => {
    try {
      const blob = readSealedVault();
      if (blob) await ipcOpenVault(passphrase, blob);
      const payload = await ipcUnlockVaultSolos(passphrase);
      set((state) => ({
        screen: 'desktop',
        vault: {
          ...state.vault,
          locked: payload.locked,
          identity: payload.identity,
          enclaveName: payload.enclaveName,
          shieldActive: payload.shieldActive,
          onChainVerified: payload.onChainVerified,
          keyIsolationId: payload.keyIsolationId,
          lastHandshakeMs: payload.lastHandshakeMs,
        },
        auditLogs: [
          {
            id: `unlock-${Date.now()}`,
            timestamp: nowTimeLabel(),
            event: `Unsealed vault.solos for ${payload.identity} (${ROOM_CONFIGS[state.activeRoom].label})`,
            room: state.activeRoom,
            cipher: 'XChaCha20-Poly1305',
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
          cipher: 'XChaCha20-Poly1305',
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
          cipher: 'XChaCha20-Poly1305',
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
          cipher: 'XChaCha20-Poly1305',
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

  updateWindowFrame: (id, frame) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id
          ? { ...w, position: { x: frame.x, y: frame.y }, size: { width: frame.width, height: frame.height } }
          : w
      ),
    })),

  openHostedApp: (seed) =>
    set((state) => {
      const instanceBadges = {
        ...state.instanceBadges,
        [seed.instanceId]: { exePath: seed.exePath, cloned: seed.cloned, cloneNumber: seed.cloneNumber },
      };
      if (state.hosted.some((win) => win.instanceId === seed.instanceId)) return { instanceBadges };
      return {
        instanceBadges,
        hosted: [
          ...state.hosted,
          {
            key: `host-pending-${seed.instanceId}`,
            hwnd: null,
            instanceId: seed.instanceId,
            title: seed.appName,
            appName: seed.appName,
            roomId: seed.roomId,
            primary: true,
            isMinimized: false,
          },
        ],
      };
    }),

  applyContainmentEvent: (event) =>
    set((state) => {
      if (event.kind === 'exited') {
        return { hosted: state.hosted.filter((win) => win.instanceId !== event.instanceId) };
      }
      if (event.kind === 'destroyed') {
        return { hosted: state.hosted.filter((win) => win.hwnd !== event.hwnd) };
      }
      if (event.kind === 'title') {
        return {
          hosted: state.hosted.map((win) =>
            win.hwnd === event.hwnd ? { ...win, title: event.title || win.title } : win,
          ),
        };
      }
      if (event.kind === 'minimized' || event.kind === 'restored') {
        const isMinimized = event.kind === 'minimized';
        return {
          hosted: state.hosted.map((win) => (win.hwnd === event.hwnd ? { ...win, isMinimized } : win)),
        };
      }
      const existing = state.hosted.find((win) => win.hwnd === event.hwnd);
      if (existing) {
        return {
          hosted: state.hosted.map((win) =>
            win.key === existing.key
              ? { ...win, title: event.title || win.title, isMinimized: false, primary: event.primary || win.primary }
              : win,
          ),
        };
      }
      const pending = state.hosted.find((win) => win.instanceId === event.instanceId && win.hwnd === null && event.primary);
      if (pending) {
        return {
          hosted: state.hosted.map((win) =>
            win.key === pending.key
              ? {
                  ...win,
                  key: `host-${event.hwnd}`,
                  hwnd: event.hwnd,
                  title: event.title || win.title,
                  appName: event.appName || win.appName,
                  roomId: event.roomId || win.roomId,
                  primary: true,
                }
              : win,
          ),
        };
      }
      return {
        hosted: [
          ...state.hosted,
          {
            key: `host-${event.hwnd}`,
            hwnd: event.hwnd,
            instanceId: event.instanceId,
            title: event.title || event.appName,
            appName: event.appName,
            roomId: event.roomId,
            primary: event.primary,
            isMinimized: false,
          },
        ],
      };
    }),

  focusHosted: (key) => {
    const win = get().hosted.find((item) => item.key === key);
    if (!win) return null;
    set((state) => ({
      hosted: state.hosted.map((item) => (item.key === key ? { ...item, isMinimized: false } : item)),
    }));
    return win.hwnd;
  },

  focusHostedInstance: (instanceId) => {
    const group = get().hosted.filter((item) => item.instanceId === instanceId);
    const win = group.find((item) => item.primary) ?? group[0];
    if (!win) return null;
    return get().focusHosted(win.key);
  },

  removeHostedInstance: (instanceId) =>
    set((state) => ({ hosted: state.hosted.filter((item) => item.instanceId !== instanceId) })),

  toggleShellMode: async () => {
    const next = get().shellMode === 'os' ? 'windows' : 'os';
    set({ shellMode: next });
    try {
      await ipcSetShellPresentation(next);
    } catch {
      set({ shellMode: next === 'os' ? 'windows' : 'os' });
    }
  },

  spawnClonedInstance: (targetApp, targetRoom) =>
    set((state) => ({
      clonedAppsCount: state.clonedAppsCount + 1,
      auditLogs: [
        {
          id: `clone-${Date.now()}`,
          timestamp: nowTimeLabel(),
          event: `Cloned isolated ${targetApp} container bound to ${ROOM_CONFIGS[targetRoom].label}`,
          room: targetRoom,
          cipher: 'XChaCha20-Poly1305',
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

  toggleProcessFreeze: async () => {
    const freeze = !get().processFreezeActive;
    try {
      const status = await getEnclaveStatus();
      const targets = status.sandboxes.filter((item) => item.status === (freeze ? 'Running' : 'Frozen'));
      await Promise.all(targets.map((item) => toggleFreezeProcess(item.instanceId)));
      set({ processFreezeActive: freeze, frozenProcessCount: freeze ? targets.length : 0 });
    } catch (error) {
      get().notify('Freeze failed', String(error));
    }
  },

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
    try {
      const status = await ipcGetVaultStatus();
      set((state) => ({
        vault: {
          ...state.vault,
          locked: status.locked,
          identity: status.identity,
          enclaveName: status.enclaveName,
          shieldActive: status.shieldActive,
          onChainVerified: status.onChainVerified,
          keyIsolationId: status.keyIsolationId,
          lastHandshakeMs: status.lastHandshakeMs,
        },
      }));
    } catch {
      // Outside the desktop app there is no vault to read; the lock screen reports it on unlock.
    }
  },

  setLaunchpadOpen: (launchpadOpen) => set({ launchpadOpen }),

  loadInstalledApps: async () => {
    if (get().appsState === 'loading') return;
    set({ appsState: 'loading', appsError: '' });
    try {
      const apps = await listInstalledApps();
      set({ installedApps: apps, appsState: 'ready' });
      void get().requestIcons(apps.map((app) => app.path));
    } catch (error) {
      set({ appsState: 'error', appsError: String(error) });
    }
  },

  requestIcons: async (paths) => {
    const known = get().icons;
    const missing = [...new Set(paths)].filter((path) => path && !known[path] && !pendingIcons.has(path));
    if (missing.length === 0) return;
    missing.forEach((path) => pendingIcons.add(path));
    // Small batches let the first icons paint while the rest are still extracting.
    for (let i = 0; i < missing.length; i += 12) {
      try {
        const found = await loadAppIcons(missing.slice(i, i + 12));
        set((state) => ({ icons: { ...state.icons, ...found } }));
      } catch {
        // Tiles keep their letter fallback when an icon can't be extracted.
      }
    }
  },

  launchApp: async (app, clone) => {
    try {
      const inst = await launchInstalledApp(app, get().activeRoom, clone);
      get().openHostedApp({
        instanceId: inst.instanceId,
        appName: inst.appName,
        roomId: inst.roomId,
        exePath: inst.exePath,
        cloned: inst.cloned,
        cloneNumber: inst.cloneNumber,
      });
      if (clone) set((state) => ({ clonedAppsCount: state.clonedAppsCount + 1 }));
    } catch (error) {
      get().notify(`Couldn't open ${app.name}`, String(error));
    }
  },

  rememberInstances: (instances) => {
    set((state) => {
      const instanceBadges = { ...state.instanceBadges };
      for (const inst of instances) {
        instanceBadges[inst.instanceId] = { exePath: inst.exePath, cloned: inst.cloned, cloneNumber: inst.cloneNumber };
      }
      return { instanceBadges };
    });
    void get().requestIcons(instances.map((inst) => inst.exePath));
  },

  notify: (title, body) =>
    set((state) => ({
      notifications: [{ id: `${Date.now()}-${state.notifications.length}`, title, body, at: Date.now() }, ...state.notifications].slice(0, 4),
    })),

  dismissNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((note) => note.id !== id) })),
}));
