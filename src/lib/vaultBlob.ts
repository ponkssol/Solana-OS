const VAULT_SLOT = 'solana-os.vault.v1';

export function readSealedVault(): number[] | null {
  try {
    const raw = localStorage.getItem(VAULT_SLOT);
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

export function writeSealedVault(blob: number[]) {
  localStorage.setItem(VAULT_SLOT, JSON.stringify(blob));
}
