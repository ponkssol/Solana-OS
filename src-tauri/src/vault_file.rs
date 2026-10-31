use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::quantum_vault;

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

fn verify(passphrase: &str, blob: &[u8]) -> Result<(), String> {
    quantum_vault::open(passphrase.as_bytes(), None, blob)
        .map(|_| ())
        .map_err(|_| "The passphrase is wrong or the vault file is damaged.".to_string())
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
pub fn unlock_vault_file(app: AppHandle, passphrase: String) -> Result<(), String> {
    verify(&passphrase, &fs::read(vault_path(&app)?).map_err(|err| err.to_string())?)
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
        let sealed = quantum_vault::seal(b"correct horse", None, b"words").unwrap().bytes;
        assert!(verify("correct horse", &sealed).is_ok());
        assert!(verify("wrong", &sealed).is_err());
    }
}
