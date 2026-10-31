const KEY = 'solana-os.vault.v1';

export function readSealedVault(): number[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

export function writeSealedVault(blob: number[]) {
  localStorage.setItem(KEY, JSON.stringify(blob));
}
