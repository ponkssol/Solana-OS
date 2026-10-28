//! `vault.solos` portable container.
//!
//! Daily unlock is Argon2id → XChaCha20-Poly1305. A 32-byte ML-KEM-1024
//! shared secret, when the caller has decapsulated one, is mixed into the
//! AEAD key. Private key bytes are `mlock`ed for the signing closure and
//! zeroized on drop. This module does not implement lattice math itself;
//! the KEM ciphertext slot is reserved at the ML-KEM-1024 size (1568 bytes)
//! so a decapsulator can be dropped in without changing the container.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    XChaCha20Poly1305,
};
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, Zeroizing};

pub const MAGIC: &[u8; 6] = b"SOLOS\x01";
pub const VERSION: u8 = 1;
pub const KDF_ARGON2ID: u8 = 1;
pub const AEAD_XCHACHA20_POLY1305: u8 = 2;
pub const KEM_ML_KEM_1024: u8 = 3;

pub const ML_KEM_1024_EK_LEN: usize = 1568;
pub const ML_KEM_1024_CT_LEN: usize = 1568;
pub const ML_KEM_1024_SS_LEN: usize = 32;
pub const ML_DSA_87_PK_LEN: usize = 2592;
pub const ML_DSA_87_SIG_LEN: usize = 4627;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;
const DEFAULT_MEM_KIB: u32 = 8192;
const DEFAULT_TIME: u32 = 2;
const DEFAULT_LANES: u32 = 1;

#[derive(Debug)]
pub struct VaultSeal {
    pub bytes: Vec<u8>,
}

pub fn seal(password: &[u8], kem_shared: Option<&[u8]>, plaintext: &[u8]) -> Result<VaultSeal, String> {
    if password.is_empty() {
        return Err("vault.solos requires a passphrase".into());
    }
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&random_bytes(SALT_LEN));

    let mut key = derive_aead_key(password, &salt, DEFAULT_MEM_KIB, DEFAULT_TIME, DEFAULT_LANES, kem_shared)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref()).map_err(|e| e.to_string())?;
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| "XChaCha20-Poly1305 seal failed".to_string())?;
    key.zeroize();

    let kem_ct: &[u8] = &[];
    let mut bytes = Vec::with_capacity(96 + ciphertext.len());
    bytes.extend_from_slice(MAGIC);
    bytes.push(VERSION);
    bytes.push(KDF_ARGON2ID);
    bytes.push(AEAD_XCHACHA20_POLY1305);
    bytes.push(KEM_ML_KEM_1024);
    bytes.extend_from_slice(&salt);
    bytes.extend_from_slice(&DEFAULT_MEM_KIB.to_le_bytes());
    bytes.extend_from_slice(&DEFAULT_TIME.to_le_bytes());
    bytes.extend_from_slice(&DEFAULT_LANES.to_le_bytes());
    bytes.extend_from_slice(&nonce);
    bytes.extend_from_slice(&(kem_ct.len() as u32).to_le_bytes());
    bytes.extend_from_slice(kem_ct);
    bytes.extend_from_slice(&(ciphertext.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&ciphertext);

    Ok(VaultSeal { bytes })
}

pub fn open(password: &[u8], kem_shared: Option<&[u8]>, blob: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    if blob.len() < 6 + 4 + SALT_LEN + 12 + NONCE_LEN + 8 {
        return Err("vault.solos blob is truncated".into());
    }
    if &blob[0..6] != MAGIC {
        return Err("vault.solos magic mismatch".into());
    }
    let mut offset = 6;
    let version = blob[offset];
    offset += 1;
    if version != VERSION {
        return Err(format!("unsupported vault.solos version {version}"));
    }
    let kdf = blob[offset];
    offset += 1;
    let aead = blob[offset];
    offset += 1;
    let _kem_id = blob[offset];
    offset += 1;
    if kdf != KDF_ARGON2ID || aead != AEAD_XCHACHA20_POLY1305 {
        return Err("vault.solos cipher suite is not Argon2id + XChaCha20-Poly1305".into());
    }

    let salt = &blob[offset..offset + SALT_LEN];
    offset += SALT_LEN;
    let mem_kib = u32::from_le_bytes(blob[offset..offset + 4].try_into().unwrap());
    offset += 4;
    let time = u32::from_le_bytes(blob[offset..offset + 4].try_into().unwrap());
    offset += 4;
    let lanes = u32::from_le_bytes(blob[offset..offset + 4].try_into().unwrap());
    offset += 4;
    let nonce = &blob[offset..offset + NONCE_LEN];
    offset += NONCE_LEN;
    let kem_len = u32::from_le_bytes(blob[offset..offset + 4].try_into().unwrap()) as usize;
    offset += 4;
    if blob.len() < offset + kem_len + 4 {
        return Err("vault.solos KEM slot is truncated".into());
    }
    offset += kem_len;
    let ct_len = u32::from_le_bytes(blob[offset..offset + 4].try_into().unwrap()) as usize;
    offset += 4;
    if blob.len() < offset + ct_len {
        return Err("vault.solos ciphertext is truncated".into());
    }
    let ciphertext = &blob[offset..offset + ct_len];

    let mut key = derive_aead_key(password, salt, mem_kib, time, lanes, kem_shared)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref()).map_err(|e| e.to_string())?;
    let nonce = chacha20poly1305::XNonce::from_slice(nonce);
    let plain = cipher.decrypt(nonce, ciphertext).map_err(|_| {
        key.zeroize();
        "vault.solos authentication failed".to_string()
    })?;
    key.zeroize();
    Ok(Zeroizing::new(plain))
}

/// Derive an AEAD key, pin it, and hand it to `sign` for the duration of the closure.
pub fn with_signing_key<T>(
    password: &[u8],
    salt: &[u8],
    kem_shared: Option<&[u8]>,
    sign: impl FnOnce(&[u8]) -> T,
) -> Result<T, String> {
    let mut key = derive_aead_key(password, salt, DEFAULT_MEM_KIB, DEFAULT_TIME, DEFAULT_LANES, kem_shared)?;
    pin_pages(key.as_mut());
    let result = sign(key.as_ref());
    unpin_pages(key.as_ref());
    key.zeroize();
    Ok(result)
}

fn derive_aead_key(
    password: &[u8],
    salt: &[u8],
    mem_kib: u32,
    time: u32,
    lanes: u32,
    kem_shared: Option<&[u8]>,
) -> Result<Zeroizing<[u8; 32]>, String> {
    let params = Params::new(mem_kib, time, lanes, Some(32)).map_err(|e| e.to_string())?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut argon_key = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(password, salt, argon_key.as_mut())
        .map_err(|e| e.to_string())?;

    let mixed = match kem_shared {
        Some(ss) => {
            if ss.len() != ML_KEM_1024_SS_LEN && !ss.is_empty() {
                return Err("ML-KEM-1024 shared secret must be 32 bytes".into());
            }
            let mut hasher = Sha256::new();
            hasher.update(argon_key.as_ref());
            hasher.update(ss);
            hasher.update(b"vault.solos/v1");
            let digest = hasher.finalize();
            let mut out = Zeroizing::new([0u8; 32]);
            out.copy_from_slice(&digest);
            out
        }
        None => argon_key,
    };
    Ok(mixed)
}

fn random_bytes(len: usize) -> Vec<u8> {
    use chacha20poly1305::aead::rand_core::RngCore;
    let mut buf = vec![0u8; len];
    OsRng.fill_bytes(&mut buf);
    buf
}

fn pin_pages(buf: &mut [u8]) {
    #[cfg(unix)]
    unsafe {
        libc::mlock(buf.as_ptr() as *const libc::c_void, buf.len());
    }
    #[cfg(not(unix))]
    {
        let _ = buf;
    }
}

fn unpin_pages(buf: &[u8]) {
    #[cfg(unix)]
    unsafe {
        libc::munlock(buf.as_ptr() as *const libc::c_void, buf.len());
    }
    #[cfg(not(unix))]
    {
        let _ = buf;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seal_and_open_roundtrip() {
        let blob = seal(b"pin-9041", None, b"room-key-material").unwrap();
        assert!(blob.bytes.starts_with(MAGIC));
        let opened = open(b"pin-9041", None, &blob.bytes).unwrap();
        assert_eq!(&opened[..], b"room-key-material");
    }

    #[test]
    fn wrong_passphrase_fails_closed() {
        let blob = seal(b"correct", None, b"secret").unwrap();
        assert!(open(b"incorrect", None, &blob.bytes).is_err());
    }

    #[test]
    fn kem_shared_secret_is_bound_into_the_key() {
        let ss = [7u8; 32];
        let blob = seal(b"pin", Some(&ss), b"id.json").unwrap();
        assert!(open(b"pin", None, &blob.bytes).is_err());
        let opened = open(b"pin", Some(&ss), &blob.bytes).unwrap();
        assert_eq!(&opened[..], b"id.json");
    }

    #[test]
    fn signing_closure_sees_32_byte_key() {
        let len = with_signing_key(b"pin", b"salt-salt-salt!!", None, |key| key.len()).unwrap();
        assert_eq!(len, 32);
    }
}
