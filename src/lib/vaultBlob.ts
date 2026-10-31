import { invoke } from '@tauri-apps/api/core';
import { ipcSealVault, isTauriRuntime } from './tauriIpc';

// Alpha.3 kept the sealed blob in localStorage; it is moved to the app data file once.
const LEGACY_SLOT = 'solana-os.vault.v1';

export async function migrateLegacyVault(): Promise<void> {
  if (!isTauriRuntime()) return;
  const raw = localStorage.getItem(LEGACY_SLOT);
  if (!raw) return;
  if (!(await invoke<boolean>('vault_file_exists'))) {
    await invoke('write_vault_file', { blob: JSON.parse(raw) as number[] });
  }
  localStorage.removeItem(LEGACY_SLOT);
}

export async function vaultExists(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  await migrateLegacyVault();
  return await invoke<boolean>('vault_file_exists');
}

export async function verifyVaultPassphrase(passphrase: string): Promise<void> {
  await invoke('unlock_vault_file', { passphrase });
}

export async function createVault(passphrase: string, mnemonic: string): Promise<void> {
  const blob = await ipcSealVault(passphrase, new TextEncoder().encode(mnemonic));
  await invoke('write_vault_file', { blob });
}

export async function vaultFilePath(): Promise<string> {
  return await invoke<string>('vault_file_path');
}

export async function exportVaultBackup(destination: string): Promise<void> {
  await invoke('export_vault_backup', { destination });
}

export async function importVaultBackup(source: string, passphrase: string): Promise<void> {
  await invoke('import_vault_backup', { source, passphrase });
}
