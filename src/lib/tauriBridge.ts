import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauriIpc';

export type ShellKind = 'pwsh' | 'cmd' | 'solana-cli';

export interface SandboxInstance {
  instanceId: string;
  appId: string;
  appName: string;
  exePath: string;
  roomId: string;
  pid: number;
  status: 'Running' | 'Frozen' | 'Stopped';
  launchedAtMs: number;
  cloned: boolean;
  cloneNumber: number;
}

export interface EnclaveSnapshot {
  locked: boolean;
  cipherSuite: string;
  kdf: string;
  aead: string;
  kem: string;
  ramEnclave: string;
  hardwareShard: string;
  keyId: string;
  sandboxes: SandboxInstance[];
}

export interface InstalledApp {
  id: string;
  name: string;
  path: string;
  args: string[];
}

export interface CliResult {
  shell: string;
  roomId: string;
  prompt: string;
  output: string;
  exitCode: number;
  conpty: boolean;
}

const DESKTOP_ONLY = 'This needs the Solana OS desktop app.';

async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isTauriRuntime()) throw new Error(DESKTOP_ONLY);
  return await invoke<T>(command, args);
}

export function getEnclaveStatus(): Promise<EnclaveSnapshot> {
  return call('get_enclave_status');
}

export function listInstalledApps(): Promise<InstalledApp[]> {
  return call('list_installed_apps');
}

export async function loadAppIcons(paths: string[]): Promise<Record<string, string>> {
  if (!isTauriRuntime() || paths.length === 0) return {};
  return await invoke<Record<string, string>>('app_icons', { paths });
}

export function launchInstalledApp(app: InstalledApp, roomId: string, clone: boolean): Promise<SandboxInstance> {
  return call('launch_app', {
    request: { id: app.id, name: app.name, path: app.path, args: app.args, roomId, clone },
  });
}

export function toggleFreezeProcess(instanceId: string): Promise<unknown> {
  return call('toggle_freeze_process', { instanceId });
}

export function terminateSandbox(instanceId: string): Promise<SandboxInstance> {
  return call('terminate_sandbox', { instanceId });
}

export function runSandboxedCliCommand(roomId: string, shellType: ShellKind, command: string): Promise<CliResult> {
  return call('run_sandboxed_cli_command', { roomId, shellType, command });
}
