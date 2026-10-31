import { invoke } from '@tauri-apps/api/core';
import type { RoomId } from '../tokens/designTokens';

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

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
}

function requireTauri() {
  if (!isTauriRuntime()) throw new Error('This needs the Solana OS desktop app.');
}

export async function ipcUnlockVaultSolos(passphrase: string): Promise<VaultStatusPayload> {
  requireTauri();
  return await invoke<VaultStatusPayload>('unlock_vault_solos', { passphrase });
}

export async function ipcLockVaultSolos(): Promise<VaultStatusPayload> {
  requireTauri();
  return await invoke<VaultStatusPayload>('lock_vault_solos');
}

export async function ipcSwitchRoom(room: RoomId): Promise<VaultStatusPayload> {
  requireTauri();
  return await invoke<VaultStatusPayload>('switch_room', { room });
}

export type ShellPresentation = 'os' | 'windows';

export async function ipcSetShellPresentation(mode: ShellPresentation): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('set_shell_presentation', { mode });
}

export async function ipcMinimizeShell(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('minimize_shell');
}

export interface ContainmentEvent {
  kind: 'appeared' | 'title' | 'minimized' | 'restored' | 'destroyed' | 'exited';
  instanceId: string;
  hwnd: string;
  title: string;
  primary: boolean;
  appName: string;
  roomId: string;
}

export interface DeskArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function ipcContainmentSetDesk(desk: DeskArea): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('containment_set_desk', { desk });
}

export async function ipcDiagLog(message: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('diag_log', { message });
}

export async function ipcContainmentFocus(hwnd: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('containment_focus', { hwnd });
}

export async function ipcGetShellPresentation(): Promise<ShellPresentation> {
  if (!isTauriRuntime()) return 'os';
  const mode = await invoke<string>('get_shell_presentation');
  return mode === 'windows' ? 'windows' : 'os';
}

export async function ipcGetVaultStatus(): Promise<VaultStatusPayload> {
  requireTauri();
  return await invoke<VaultStatusPayload>('get_vault_status');
}

export async function ipcSealVault(passphrase: string, plaintext: Uint8Array): Promise<number[]> {
  requireTauri();
  return await invoke<number[]>('seal_vault_solos', { passphrase, plaintext: Array.from(plaintext) });
}

export async function ipcOpenVault(passphrase: string, blob: number[]): Promise<number[]> {
  requireTauri();
  return await invoke<number[]>('open_vault_solos', { passphrase, blob });
}

export async function ipcReadDiagLog(): Promise<string> {
  requireTauri();
  return await invoke<string>('read_diag_log');
}
