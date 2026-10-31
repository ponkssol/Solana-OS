const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const LAMPORTS_PER_SOL = 1_000_000_000;

export function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const b of bytes) value = value * 256n + BigInt(b);
  let out = '';
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function base58Decode(text: string): Uint8Array {
  let value = 0n;
  for (const ch of text) {
    const digit = ALPHABET.indexOf(ch);
    if (digit < 0) throw new Error('Invalid base58 character');
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }
  for (const ch of text) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export function decodePublicKey(address: string): Uint8Array {
  const bytes = base58Decode(address.trim());
  if (bytes.length !== 32) throw new Error('That is not a valid Solana address.');
  return bytes;
}

// A legacy message with one System Program transfer: fee payer and source are the
// same signer, the destination is writable, the program id is read-only.
export function buildTransferMessage(from: string, to: string, lamports: bigint, blockhash: string): Uint8Array {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, lamports, true);
  return Uint8Array.from([
    1, 0, 1,
    3,
    ...decodePublicKey(from),
    ...decodePublicKey(to),
    ...decodePublicKey(SYSTEM_PROGRAM),
    ...decodePublicKey(blockhash),
    1,
    2, 2, 0, 1, data.length,
    ...data,
  ]);
}

export function wrapTransaction(message: Uint8Array, signature?: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + 64 + message.length);
  out[0] = 1;
  if (signature) out.set(signature, 1);
  out.set(message, 65);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
