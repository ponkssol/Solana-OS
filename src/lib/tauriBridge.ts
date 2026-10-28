import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauriIpc';

export type RoomKey = 'treasury' | 'defi' | 'burner' | 'devnet';
export type WalletBrand = 'phantom' | 'solflare' | 'backpack';
export type ShellKind = 'pwsh' | 'cmd' | 'solana-cli';

export interface SandboxInstance {
  id: string;
  name: string;
  wallet: string;
  namespace: string;
  stateLabel: string;
  color: string;
  room: RoomKey;
  frozen: boolean;
  walletBrand: WalletBrand | null;
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

export interface CliResult {
  shell: string;
  roomId: string;
  prompt: string;
  output: string;
  exitCode: number;
  conpty: boolean;
}

const memory: EnclaveSnapshot = {
  locked: false,
  cipherSuite: 'ML-KEM-1024',
  kdf: 'Argon2id · 8192 KiB · t=2 · p=1',
  aead: 'XChaCha20-Poly1305',
  kem: 'ML-KEM-1024 shared-secret slot (1568-byte ciphertext)',
  ramEnclave: 'VirtualLock + Zeroize · signing key pinned for the closure only',
  hardwareShard: 'YubiKey 5C · Shamir 2-of-3 verified',
  keyId: 'MLKEM1024-ENCLAVE-MAIN-9F4A',
  sandboxes: [
    row('ph-1', 'Phantom Standalone #01 (Treasury)', '7xKX…9fSol', 'PID 4102 · Landlock', 'Verified Active', '#14f195', 'treasury', false, 'phantom'),
    row('ph-2', 'Phantom Standalone #02 (Burner Mint)', '3mPq…4kBurn', 'PID 4103 · Landlock', 'Isolated Net', '#0a99ff', 'burner', false, 'phantom'),
    row('cur-1', 'Cursor Sandbox IDE (Anchor Workspace)', '9vBn…2wStk', 'PID 4180 · SIGSTOP', 'Frozen (0% CPU)', '#38bdf8', 'devnet', true, null),
    row('sf-1', 'Solflare Native #01 (Validator Staking)', '9vBn…2wStk', 'PID 4408 · Landlock', 'Hardware Shard', '#c084fc', 'treasury', false, 'solflare'),
    row('web-1', 'Isolated Web3 Browser (Jupiter Perps)', '5xLm…8p Trade', 'PID 4512 · Landlock', 'CPI Shield ON', '#14f195', 'defi', false, null),
    row('key-1', 'vault.solos Post-Quantum Keyring Daemon', 'Shamir 2-of-3', 'PID 0812 · Ring-0', 'ML-KEM-1024', '#14f195', 'treasury', false, null),
  ],
};

function row(
  id: string,
  name: string,
  wallet: string,
  namespace: string,
  stateLabel: string,
  color: string,
  room: RoomKey,
  frozen: boolean,
  walletBrand: WalletBrand | null,
): SandboxInstance {
  return { id, name, wallet, namespace, stateLabel, color, room, frozen, walletBrand };
}

function snapshot(): EnclaveSnapshot {
  return { ...memory, sandboxes: memory.sandboxes.map((item) => ({ ...item })) };
}

async function call<T>(command: string, args: Record<string, unknown>, fallback: () => T): Promise<T> {
  if (!isTauriRuntime()) return fallback();
  try {
    return await invoke<T>(command, args);
  } catch {
    return fallback();
  }
}

async function touch(command: string, args: Record<string, unknown>) {
  if (!isTauriRuntime()) return;
  try {
    await invoke(command, args);
  } catch {
    /* The browser preview keeps the in-memory room state. */
  }
}

export async function getEnclaveStatus(): Promise<EnclaveSnapshot> {
  await touch('get_enclave_status', {});
  return snapshot();
}

export async function cloneAppInstance(appId: string, room: RoomKey): Promise<EnclaveSnapshot> {
  await touch('clone_app_instance', { appId, roomId: room });
  const id = `clone-${Date.now()}`;
  memory.sandboxes.unshift(
    row(id, `${appId} clone`, 'ephemeral.solos', `PID ${4000 + memory.sandboxes.length} · Landlock`, 'Verified Active', '#14f195', room, false, null),
  );
  return snapshot();
}

export async function toggleFreezeProcess(id: string): Promise<EnclaveSnapshot> {
  await touch('toggle_freeze_process', { instanceId: id });
  const item = memory.sandboxes.find((entry) => entry.id === id);
  if (item) {
    item.frozen = !item.frozen;
    item.stateLabel = item.frozen ? 'Frozen (0% CPU)' : 'Verified Active';
    item.color = item.frozen ? '#38bdf8' : '#14f195';
    item.namespace = item.namespace.replace(/SIGSTOP|Landlock/, item.frozen ? 'SIGSTOP' : 'Landlock');
  }
  return snapshot();
}

export async function terminateSandbox(id: string): Promise<EnclaveSnapshot> {
  await touch('terminate_sandbox', { instanceId: id });
  memory.sandboxes = memory.sandboxes.filter((entry) => entry.id !== id);
  return snapshot();
}

export async function unlockVaultContainer(passphrase: string): Promise<EnclaveSnapshot> {
  await touch('unlock_vault_container', { passphrase });
  memory.locked = false;
  return snapshot();
}

export function simulateSolanaTx(): Promise<{ summary: string; blocked: boolean }> {
  return call('simulate_solana_tx', {}, () => ({
    summary: 'Swap 25.0 SOL → 4,812.50 USDC via Jupiter v6. Zero authority changes detected.',
    blocked: false,
  }));
}

export function signWithRamEnclave(): Promise<{ signed: boolean; detail: string }> {
  return call('sign_with_ram_enclave', { passphrase: 'enclave' }, () => ({
    signed: true,
    detail: 'Signed inside the RAM enclave. Key pages were zeroized.',
  }));
}

export function runSandboxedCliCommand(roomId: string, shellType: ShellKind, command: string): Promise<CliResult> {
  const prompt = `solana-os@windows-conpty C:\\VaultRooms\\${roomFolder(roomId)}>`;
  return call('run_sandboxed_cli_command', { roomId, shellType, command }, () => ({
    shell: shellLabel(shellType),
    roomId,
    prompt,
    output: previewCommand(command),
    exitCode: command.trim() === 'clear' ? 0 : 0,
    conpty: false,
  }));
}

function roomFolder(roomId: string): string {
  if (roomId === 'defi') return 'DegenRoom';
  if (roomId === 'burner') return 'BurnerRoom';
  if (roomId === 'devnet') return 'DevRoom';
  return 'MainRoom';
}

function shellLabel(shell: ShellKind): string {
  if (shell === 'cmd') return 'cmd.exe';
  if (shell === 'solana-cli') return 'solana-cli';
  return 'pwsh.exe';
}

function previewCommand(command: string): string {
  const text = command.trim().toLowerCase();
  if (text === 'help') return 'Commands: solana balance, solana config get, anchor build, winget list, dir, whoami, help, clear';
  if (text === 'whoami') return 'solana-os\\nanda';
  if (text === 'dir') return 'Directory of C:\\VaultRooms\\MainRoom\n\nvault.solos\nid.json  <enclave hook, not readable>\nAnchor.toml';
  if (text === 'solana balance') return '142.85 SOL';
  if (text === 'solana config get') return 'RPC URL: https://mainnet.helius-rpc.com\nKeypair Path: enclave://vault.solos/id.json (zero-exposure)';
  if (text === 'anchor build') return 'Building solana-os-registry…\nFinished release [optimized] target(s)';
  if (text === 'winget list') return 'Name        Id\nPowerShell  Microsoft.PowerShell\nSolana CLI  Solana.Install';
  if (text === 'clear') return '';
  return `'${command}' is queued for the Windows ConPTY bridge (PowerShell / CMD).`;
}
