import { useSyncExternalStore } from "react"

const STORAGE_KEY = "solana-os.vault.v1"
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

export type SignRequest = {
  id: string
  label: string
  message: string
  status: "pending" | "signed" | "denied"
  signature: string | null
}

type VaultRecord = {
  v: 1
  address: string
  salt: string
  iv: string
  cipher: string
}

type VaultSnap = {
  address: string | null
  unlocked: boolean
  requests: SignRequest[]
}

const listeners = new Set<() => void>()
let privateKey: CryptoKey | null = null
let requests: SignRequest[] = []
let address = readStoredAddress()
let snap: VaultSnap = { address, unlocked: false, requests }

function publish() {
  snap = { address, unlocked: privateKey !== null || desktop, requests: requests.slice() }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let desktop = false

export function adoptAddress(next: string | null, unlocked: boolean) {
  address = next
  privateKey = null
  desktop = unlocked && Boolean(next)
  publish()
}

export function useVault(): VaultSnap {
  return useSyncExternalStore(subscribe, () => snap, () => snap)
}

export function lockVault() {
  if (!privateKey) return
  privateKey = null
  publish()
}

export function requestSignature(label: string, message: string): string {
  const id = crypto.randomUUID()
  const next: SignRequest = { id, label, message, status: "pending", signature: null }
  requests = [next, ...requests].slice(0, 6)
  publish()
  return id
}

export function denyRequest(id: string) {
  requests = requests.map((item) =>
    item.id === id && item.status === "pending" ? { ...item, status: "denied" } : item,
  )
  publish()
}

export async function approveRequest(id: string, confirmed = false): Promise<"signed" | "locked" | "missing" | "review"> {
  const item = requests.find((entry) => entry.id === id)
  if (!item || item.status !== "pending") return "missing"
  if (window.solanaOs?.vault) {
    const signed = await window.solanaOs.vault.sign(item.message, confirmed)
    if (!signed.ok) return signed.warnings && signed.warnings.length > 0 ? "review" : "locked"
    requests = requests.map((entry) =>
      entry.id === id ? { ...entry, status: "signed", signature: signed.signature ?? null } : entry,
    )
    publish()
    return "signed"
  }
  if (!privateKey) return "locked"
  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(item.message)),
  )
  requests = requests.map((entry) =>
    entry.id === id ? { ...entry, status: "signed", signature: base58(signature) } : entry,
  )
  publish()
  return "signed"
}

export async function createVault(passphrase: string): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  if (passphrase.length < 8) return { ok: false, error: "Use at least 8 characters." }
  try {
    const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])
    if (!("privateKey" in generated)) return { ok: false, error: "This browser cannot create an Island key." }
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey))
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", generated.privateKey))
    const packed = await encrypt(passphrase, pkcs8)
    const next = base58(raw)
    const record: VaultRecord = { v: 1, address: next, ...packed }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    privateKey = await importKey(pkcs8)
    address = next
    publish()
    return { ok: true, address: next }
  } catch {
    return { ok: false, error: "This browser cannot create an Island key." }
  }
}

export async function unlockVault(passphrase: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const record = readRecord()
  if (!record) return { ok: false, error: "Island has no vault yet." }
  try {
    const pkcs8 = await decrypt(passphrase, record)
    privateKey = await importKey(pkcs8)
    address = record.address
    publish()
    return { ok: true }
  } catch {
    privateKey = null
    publish()
    return { ok: false, error: "Passphrase does not match." }
  }
}

function packed(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

async function importKey(pkcs8: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", packed(pkcs8), { name: "Ed25519" }, false, ["sign"])
}

async function encrypt(passphrase: string, data: Uint8Array): Promise<{ salt: string; iv: string; cipher: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed(data)))
  return { salt: bytesToB64(salt), iv: bytesToB64(iv), cipher: bytesToB64(cipher) }
}

async function decrypt(passphrase: string, record: VaultRecord): Promise<Uint8Array> {
  const salt = b64ToBytes(record.salt)
  const iv = b64ToBytes(record.iv)
  const key = await deriveKey(passphrase, salt)
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed(iv) }, key, packed(b64ToBytes(record.cipher)))
  return new Uint8Array(plain)
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: packed(salt), iterations: 100_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function readRecord(): VaultRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VaultRecord>
    if (parsed.v !== 1 || typeof parsed.address !== "string") return null
    if (typeof parsed.salt !== "string" || typeof parsed.iv !== "string" || typeof parsed.cipher !== "string") return null
    return { v: 1, address: parsed.address, salt: parsed.salt, iv: parsed.iv, cipher: parsed.cipher }
  } catch {
    return null
  }
}

function readStoredAddress(): string | null {
  return readRecord()?.address ?? null
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function base58(bytes: Uint8Array): string {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8
      digits[index] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let text = ""
  for (const byte of bytes) {
    if (byte !== 0) break
    text += "1"
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) text += ALPHABET[digits[index]]
  return text
}
