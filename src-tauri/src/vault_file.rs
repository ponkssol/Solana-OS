use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use serde::Serialize;

use crate::quantum_vault::hybrid;
use crate::wallet;

const FILE_NAME: &str = "vault.solvault";

fn vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir.join(FILE_NAME))
}

// Write to a sibling temp file, flush it to disk, then rename over the target so a
// crash mid-write never leaves a truncated vault behind.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("solvault.tmp");
    let mut file = fs::File::create(&tmp).map_err(|err| err.to_string())?;
    file.write_all(bytes).map_err(|err| err.to_string())?;
    file.sync_all().map_err(|err| err.to_string())?;
    drop(file);
    fs::rename(&tmp, path).map_err(|err| err.to_string())
}

fn open_blob(passphrase: &str, blob: &[u8]) -> Result<(zeroize::Zeroizing<Vec<u8>>, bool), String> {
    hybrid::open_any(passphrase.as_bytes(), blob)
        .map_err(|_| "The passphrase is wrong or the vault file is damaged.".to_string())
}

fn verify(passphrase: &str, blob: &[u8]) -> Result<(), String> {
    open_blob(passphrase, blob).map(|_| ())
}

fn suite_of(blob: &[u8]) -> &'static str {
    match hybrid::detect(blob) {
        hybrid::Format::V2 => hybrid::SUITE_LABEL,
        hybrid::Format::V1 => "Argon2id + XChaCha20-Poly1305 (v1)",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockResult {
    pub address: Option<String>,
    pub suite: &'static str,
    pub migrated: bool,
}

#[tauri::command]
pub fn vault_file_exists(app: AppHandle) -> Result<bool, String> {
    Ok(vault_path(&app)?.exists())
}

#[tauri::command]
pub fn vault_file_path(app: AppHandle) -> Result<String, String> {
    Ok(vault_path(&app)?.display().to_string())
}

#[tauri::command]
pub fn read_vault_file(app: AppHandle) -> Result<Vec<u8>, String> {
    fs::read(vault_path(&app)?).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_vault_file(app: AppHandle, blob: Vec<u8>) -> Result<(), String> {
    write_atomic(&vault_path(&app)?, &blob)
}

#[tauri::command]
pub fn create_vault_file(app: AppHandle, passphrase: String, mnemonic: String) -> Result<(), String> {
    let blob = hybrid::seal_v2(passphrase.as_bytes(), mnemonic.as_bytes())?;
    write_atomic(&vault_path(&app)?, &blob)
}

#[tauri::command]
pub fn vault_file_suite(app: AppHandle) -> Result<Option<&'static str>, String> {
    let path = vault_path(&app)?;
    Ok(fs::read(path).ok().map(|blob| suite_of(&blob)))
}

#[tauri::command]
pub fn unlock_vault_file(app: AppHandle, passphrase: String) -> Result<UnlockResult, String> {
    let path = vault_path(&app)?;
    let blob = fs::read(&path).map_err(|err| err.to_string())?;
    let (plain, needs_upgrade) = open_blob(&passphrase, &blob)?;
    let mut migrated = false;
    if needs_upgrade {
        let upgraded = hybrid::seal_v2(passphrase.as_bytes(), &plain)?;
        match write_atomic(&path, &upgraded) {
            Ok(()) => migrated = true,
            Err(err) => crate::diag!("vault upgrade to v2 failed: {err}"),
        }
    }
    let phrase = String::from_utf8_lossy(&plain).into_owned();
    let phrase = zeroize::Zeroizing::new(phrase);
    let address = wallet::start_session(&phrase).ok();
    let suite = if migrated { hybrid::SUITE_LABEL } else { suite_of(&blob) };
    Ok(UnlockResult { address, suite, migrated })
}

#[tauri::command]
pub fn export_vault_backup(app: AppHandle, destination: String) -> Result<(), String> {
    let blob = fs::read(vault_path(&app)?).map_err(|err| err.to_string())?;
    write_atomic(Path::new(&destination), &blob)
}

#[tauri::command]
pub fn import_vault_backup(app: AppHandle, source: String, passphrase: String) -> Result<(), String> {
    let blob = fs::read(&source).map_err(|err| err.to_string())?;
    verify(&passphrase, &blob)?;
    write_atomic(&vault_path(&app)?, &blob)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quantum_vault;

    #[test]
    fn atomic_write_replaces_and_leaves_no_temp() {
        let dir = std::env::temp_dir().join(format!("solos-vault-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(FILE_NAME);
        write_atomic(&path, b"first").unwrap();
        write_atomic(&path, b"second").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second");
        assert!(!path.with_extension("solvault.tmp").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn verify_rejects_wrong_passphrase() {
        let v1 = quantum_vault::seal(b"correct horse", None, b"words").unwrap().bytes;
        let v2 = hybrid::seal_v2(b"correct horse", b"words").unwrap();
        for sealed in [v1, v2] {
            assert!(verify("correct horse", &sealed).is_ok());
            assert!(verify("wrong", &sealed).is_err());
        }
    }
}
