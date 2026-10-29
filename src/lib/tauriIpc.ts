import { invoke } from '@tauri-apps/api/core';
import { ROOM_CONFIGS, RoomId } from '../tokens/designTokens';

export interface VaultStatusPayload {
  enclaveName: string;
  identity: string;
  cipherSuite: string;
  locked: boolean;
  activeRoom: RoomId;
  keyIsolationId: string;
  shieldActive: boolean;
  onChainVerified: boolean;
  lastHandshakeMs: number;
}

const fallbackState: VaultStatusPayload = {
  enclaveName: 'vault.solos',
  identity: 'nanda.solos',
  cipherSuite: 'ML-KEM-1024',
  locked: true,
  activeRoom: 'main',
  keyIsolationId: ROOM_CONFIGS.main.keyIsolationId,
  shieldActive: true,
  onChainVerified: true,
  lastHandshakeMs: 12,
};

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
}

export async function ipcUnlockVaultSolos(passphrase: string): Promise<VaultStatusPayload> {
  if (isTauriRuntime()) {
    return await invoke<VaultStatusPayload>('unlock_vault_solos', { passphrase });
  }
  await new Promise((r) => setTimeout(r, 180));
  if (!passphrase.trim()) {
    throw new Error('Passphrase or passkey signature required to unseal vault.solos');
  }
  fallbackState.locked = false;
  fallbackState.lastHandshakeMs = Math.floor(9 + Math.random() * 7);
  return { ...fallbackState };
}

export async function ipcLockVaultSolos(): Promise<VaultStatusPayload> {
  if (isTauriRuntime()) {
    return await invoke<VaultStatusPayload>('lock_vault_solos');
  }
  await new Promise((r) => setTimeout(r, 100));
  fallbackState.locked = true;
  return { ...fallbackState };
}

export async function ipcSwitchRoom(room: RoomId): Promise<VaultStatusPayload> {
  if (isTauriRuntime()) {
    return await invoke<VaultStatusPayload>('switch_room', { room });
  }
  await new Promise((r) => setTimeout(r, 90));
  fallbackState.activeRoom = room;
  fallbackState.keyIsolationId = ROOM_CONFIGS[room].keyIsolationId;
  fallbackState.lastHandshakeMs = Math.floor(8 + Math.random() * 8);
  return { ...fallbackState };
}

export type ShellPresentation = 'os' | 'windows';

export async function ipcSetShellPresentation(mode: ShellPresentation): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('set_shell_presentation', { mode });
}

export async function ipcGetShellPresentation(): Promise<ShellPresentation> {
  if (!isTauriRuntime()) return 'os';
  const mode = await invoke<string>('get_shell_presentation');
  return mode === 'windows' ? 'windows' : 'os';
}

export async function ipcGetVaultStatus(): Promise<VaultStatusPayload> {
  if (isTauriRuntime()) {
    return await invoke<VaultStatusPayload>('get_vault_status');
  }
  return { ...fallbackState };
}
