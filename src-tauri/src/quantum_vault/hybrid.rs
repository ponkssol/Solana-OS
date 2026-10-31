//! Version 2 of `vault.solvault`: the payload is sealed under Argon2id mixed with a
//! hybrid X25519 + ML-KEM-768 shared secret.
//!
//! The KEM private keys are themselves sealed under the passphrase in the same file,
//! so the passphrase stays the root of trust. What the hybrid layer adds is that the
//! payload key no longer depends on Argon2id output alone, and the recipient keys can
//! later move to an external holder without changing the payload format.

use chacha20poly1305::aead::OsRng;
use ml_kem::kem::{Decapsulate, Encapsulate};
use ml_kem::{EncodedSizeUser, KemCore, MlKem768};
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroizing;

use super::{open, seal};

pub const MAGIC_V2: &[u8; 6] = b"SOLVH\x02";
pub const SUITE_LABEL: &str = "Argon2id + X25519/ML-KEM-768 hybrid + XChaCha20-Poly1305";

const X25519_LEN: usize = 32;
const MLKEM768_CT_LEN: usize = 1088;

type DecapKey = <MlKem768 as KemCore>::DecapsulationKey;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    V1,
    V2,
}

pub fn detect(blob: &[u8]) -> Format {
    if blob.starts_with(MAGIC_V2) {
        Format::V2
    } else {
        Format::V1
    }
}

fn combine(x_shared: &[u8], kem_shared: &[u8], eph_pub: &[u8], kem_ct: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut hasher = Sha256::new();
    hasher.update(b"solana-os/vault/hybrid-v2");
    hasher.update(x_shared);
    hasher.update(kem_shared);
    hasher.update(eph_pub);
    hasher.update(kem_ct);
    let mut out = Zeroizing::new([0u8; 32]);
    out.copy_from_slice(&hasher.finalize());
    out
}

fn push_chunk(out: &mut Vec<u8>, chunk: &[u8]) {
    out.extend_from_slice(&(chunk.len() as u32).to_le_bytes());
    out.extend_from_slice(chunk);
}

fn take<'a>(blob: &'a [u8], offset: &mut usize, len: usize) -> Result<&'a [u8], String> {
    let end = offset.checked_add(len).filter(|end| *end <= blob.len());
    let end = end.ok_or_else(|| "vault file is truncated".to_string())?;
    let chunk = &blob[*offset..end];
    *offset = end;
    Ok(chunk)
}

fn take_chunk<'a>(blob: &'a [u8], offset: &mut usize) -> Result<&'a [u8], String> {
    let len = u32::from_le_bytes(take(blob, offset, 4)?.try_into().unwrap()) as usize;
    take(blob, offset, len)
}

pub fn seal_v2(password: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let x_secret = StaticSecret::random_from_rng(OsRng);
    let x_public = PublicKey::from(&x_secret);
    let (dk, ek) = MlKem768::generate(&mut OsRng);

    let eph = StaticSecret::random_from_rng(OsRng);
    let eph_pub = PublicKey::from(&eph);
    let x_shared = eph.diffie_hellman(&x_public);
    let (kem_ct, kem_shared) = ek
        .encapsulate(&mut OsRng)
        .map_err(|_| "ML-KEM-768 encapsulation failed".to_string())?;

    let mut keys = Zeroizing::new(Vec::new());
    keys.extend_from_slice(x_secret.as_bytes());
    keys.extend_from_slice(dk.as_bytes().as_slice());
    let keys_seal = seal(password, None, &keys)?.bytes;

    let shared = combine(x_shared.as_bytes(), kem_shared.as_slice(), eph_pub.as_bytes(), kem_ct.as_slice());
    let data_seal = seal(password, Some(shared.as_ref()), plaintext)?.bytes;

    let mut out = Vec::with_capacity(keys_seal.len() + data_seal.len() + 1200);
    out.extend_from_slice(MAGIC_V2);
    push_chunk(&mut out, &keys_seal);
    out.extend_from_slice(eph_pub.as_bytes());
    out.extend_from_slice(kem_ct.as_slice());
    push_chunk(&mut out, &data_seal);
    Ok(out)
}

pub fn open_v2(password: &[u8], blob: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    let mut offset = MAGIC_V2.len();
    if !blob.starts_with(MAGIC_V2) {
        return Err("not a version 2 vault".into());
    }
    let keys_seal = take_chunk(blob, &mut offset)?;
    let eph_pub = take(blob, &mut offset, X25519_LEN)?;
    let kem_ct = take(blob, &mut offset, MLKEM768_CT_LEN)?;
    let data_seal = take_chunk(blob, &mut offset)?;

    let keys = open(password, None, keys_seal)?;
    if keys.len() <= X25519_LEN {
        return Err("vault key block is malformed".into());
    }
    let mut x_bytes = Zeroizing::new([0u8; X25519_LEN]);
    x_bytes.copy_from_slice(&keys[..X25519_LEN]);
    let x_secret = StaticSecret::from(*x_bytes);
    let dk_encoded = keys[X25519_LEN..]
        .try_into()
        .map_err(|_| "ML-KEM-768 key has the wrong length".to_string())?;
    let dk = DecapKey::from_bytes(dk_encoded);

    let mut eph = [0u8; X25519_LEN];
    eph.copy_from_slice(eph_pub);
    let x_shared = x_secret.diffie_hellman(&PublicKey::from(eph));
    let ct = kem_ct
        .try_into()
        .map_err(|_| "ML-KEM-768 ciphertext has the wrong length".to_string())?;
    let kem_shared = dk
        .decapsulate(ct)
        .map_err(|_| "ML-KEM-768 decapsulation failed".to_string())?;

    let shared = combine(x_shared.as_bytes(), kem_shared.as_slice(), eph_pub, kem_ct);
    open(password, Some(shared.as_ref()), data_seal)
}

/// Opens either format; the flag tells the caller to rewrite a v1 file as v2.
pub fn open_any(password: &[u8], blob: &[u8]) -> Result<(Zeroizing<Vec<u8>>, bool), String> {
    match detect(blob) {
        Format::V2 => open_v2(password, blob).map(|plain| (plain, false)),
        Format::V1 => open(password, None, blob).map(|plain| (plain, true)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v2_roundtrip_and_wrong_passphrase() {
        let blob = seal_v2(b"pass phrase", b"abandon words").unwrap();
        assert_eq!(detect(&blob), Format::V2);
        assert_eq!(&open_v2(b"pass phrase", &blob).unwrap()[..], b"abandon words");
        assert!(open_v2(b"nope", &blob).is_err());
    }

    #[test]
    fn v1_opens_and_requests_migration() {
        let v1 = seal(b"pw", None, b"legacy").unwrap().bytes;
        let (plain, migrate) = open_any(b"pw", &v1).unwrap();
        assert_eq!(&plain[..], b"legacy");
        assert!(migrate);
    }

    #[test]
    fn tampered_kem_ciphertext_fails() {
        let mut blob = seal_v2(b"pw", b"secret").unwrap();
        let keys_len = u32::from_le_bytes(blob[6..10].try_into().unwrap()) as usize;
        let ct_at = 10 + keys_len + X25519_LEN + 5;
        blob[ct_at] ^= 1;
        assert!(open_v2(b"pw", &blob).is_err());
    }
}
