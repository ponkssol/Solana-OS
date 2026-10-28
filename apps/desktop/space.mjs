import { createCipheriv, createDecipheriv, createPrivateKey, generateKeyPairSync, randomBytes, scryptSync, sign } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js"

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const SEED = {
  "/Island.txt":
    "This folder belongs to Solana OS.\n\nIt is not the Windows Desktop or Documents folder.\nFiles saved here stay in this upper OS.\n",
}

let root = ""
let session = null

export function init(dir) {
  root = dir
  mkdirSync(dir, { recursive: true })
}

export function status() {
  return { created: fileExists() }
}

export function isUnlocked() {
  return session !== null
}

export function create(passphrase) {
  if (passphrase.length < 8) return { ok: false, error: "Use at least 8 characters." }
  if (fileExists()) return { ok: false, error: "This space already exists." }
  const kem = ml_kem768.keygen()
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(kem.publicKey)
  const pair = generateKeyPairSync("ed25519")
  const address = base58(rawPublic(pair.publicKey))
  session = {
    cek: Buffer.from(sharedSecret),
    privateKey: pair.privateKey,
    address,
    files: { ...SEED },
    clones: [],
    frozen: [],
    kemCipher: Buffer.from(cipherText),
    publicKey: Buffer.from(kem.publicKey),
    secretKey: Buffer.from(kem.secretKey),
  }
  save(passphrase)
  return { ok: true, address, files: { ...session.files } }
}

export function unlock(passphrase) {
  if (!fileExists()) return { ok: false, error: "Create the space first." }
  try {
    const record = JSON.parse(readFileSync(vaultPath(), "utf8"))
    const secretKey = unwrap(passphrase, record)
    const shared = ml_kem768.decapsulate(b64(record.kemCipher), secretKey)
    const payload = JSON.parse(decrypt(Buffer.from(shared), record.dataIv, record.dataTag, record.data).toString("utf8"))
    session = {
      cek: Buffer.from(shared),
      privateKey: createPrivateKey({ key: b64(payload.pkcs8), format: "der", type: "pkcs8" }),
      address: payload.address,
      files: payload.files && typeof payload.files === "object" ? payload.files : { ...SEED },
      clones: Array.isArray(payload.clones) ? payload.clones : [],
      frozen: Array.isArray(payload.frozen) ? payload.frozen : [],
      kemCipher: b64(record.kemCipher),
      publicKey: b64(record.kemPublic),
      secretKey,
    }
    return { ok: true, address: session.address, files: { ...session.files }, clones: [...session.clones], frozen: [...session.frozen] }
  } catch {
    session = null
    return { ok: false, error: "Passphrase does not match." }
  }
}

export function lock() {
  session = null
}

export function writeFile(filePath, content) {
  if (!session) return { ok: false, error: "The space is locked." }
  if (!safePath(filePath)) return { ok: false, error: "That path is not in this OS." }
  session.files = { ...session.files, [filePath]: String(content) }
  save()
  return { ok: true }
}

export function catalog() {
  if (!session) return { clones: [], frozen: [] }
  return { clones: [...session.clones], frozen: [...session.frozen] }
}

export function setCatalog(clones, frozen) {
  if (!session) return { ok: false, error: "The space is locked." }
  session.clones = clones
  session.frozen = frozen
  save()
  return { ok: true }
}

export function signMessage(message, confirmed) {
  if (!session) return { ok: false, error: "The space is locked." }
  const warnings = inspectLocal(message)
  if (warnings.length > 0 && !confirmed) return { ok: false, error: "Review the warning before signing.", warnings }
  const signature = sign(null, Buffer.from(String(message), "utf8"), session.privateKey)
  return { ok: true, signature: base58(signature), warnings }
}

function inspectLocal(message) {
  const warnings = []
  const text = String(message || "")
  if (/setauthority/i.test(text)) warnings.push("This signature changes a token authority.")
  if (/approve/i.test(text) && /unlimited|max|all/i.test(text)) warnings.push("This signature approves spending.")
  if (/transfer/i.test(text) && /all|entire|drain/i.test(text)) warnings.push("This signature can move the whole balance.")
  return warnings
}

function save(passphrase) {
  if (!session) return
  const payload = Buffer.from(JSON.stringify({
    files: session.files,
    address: session.address,
    pkcs8: session.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    clones: session.clones,
    frozen: session.frozen,
  }))
  const data = encrypt(session.cek, payload)
  const previous = fileExists() ? JSON.parse(readFileSync(vaultPath(), "utf8")) : null
  const wrap = passphrase ? wrapSecret(passphrase, session.secretKey) : {
    salt: previous.salt,
    wrapIv: previous.wrapIv,
    wrapTag: previous.wrapTag,
    wrappedSecret: previous.wrappedSecret,
  }
  const record = {
    v: 1,
    ...wrap,
    kemPublic: session.publicKey.toString("base64"),
    kemCipher: session.kemCipher.toString("base64"),
    dataIv: data.iv,
    dataTag: data.tag,
    data: data.data,
  }
  const target = vaultPath()
  const temp = `${target}.tmp`
  writeFileSync(temp, JSON.stringify(record))
  renameSync(temp, target)
}

function wrapSecret(passphrase, secretKey) {
  const salt = randomBytes(16)
  const key = scryptSync(passphrase, salt, 32)
  const sealed = encrypt(key, secretKey)
  return { salt: salt.toString("base64"), wrapIv: sealed.iv, wrapTag: sealed.tag, wrappedSecret: sealed.data }
}

function unwrap(passphrase, record) {
  const key = scryptSync(passphrase, b64(record.salt), 32)
  return decrypt(key, record.wrapIv, record.wrapTag, record.wrappedSecret)
}

function encrypt(key, data) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(data), cipher.final()])
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: body.toString("base64") }
}

function decrypt(key, iv, tag, data) {
  const decipher = createDecipheriv("aes-256-gcm", key, b64(iv))
  decipher.setAuthTag(b64(tag))
  return Buffer.concat([decipher.update(b64(data)), decipher.final()])
}

function rawPublic(publicKey) {
  const der = publicKey.export({ format: "der", type: "spki" })
  return der.subarray(der.length - 32)
}

function vaultPath() {
  return path.join(root, "vault.json")
}

function fileExists() {
  try {
    readFileSync(vaultPath())
    return true
  } catch {
    return false
  }
}

function safePath(input) {
  return typeof input === "string" && input.startsWith("/") && !input.includes("..")
}

function b64(value) {
  return Buffer.from(value, "base64")
}

function base58(bytes) {
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
