use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

const MAX_BYTES: u64 = 2 * 1024 * 1024;

static LOG: Mutex<Option<(PathBuf, File)>> = Mutex::new(None);

pub fn init(app: &AppHandle) {
    let Ok(dir) = app.path().app_log_dir() else {
        return;
    };
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("solana-os.log");
    if fs::metadata(&path).map(|meta| meta.len() > MAX_BYTES).unwrap_or(false) {
        let _ = fs::rename(&path, dir.join("solana-os.old.log"));
    }
    if let Ok(file) = OpenOptions::new().create(true).append(true).open(&path) {
        *LOG.lock().unwrap_or_else(|err| err.into_inner()) = Some((path, file));
    }
    write(&format!("session start, version {}", env!("CARGO_PKG_VERSION")));
}

pub fn write(line: &str) {
    let mut guard = LOG.lock().unwrap_or_else(|err| err.into_inner());
    let Some((_, file)) = guard.as_mut() else {
        return;
    };
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let thread = std::thread::current();
    let _ = writeln!(file, "{ms} [{}] {line}", thread.name().unwrap_or("-"));
}

#[macro_export]
macro_rules! diag {
    ($($arg:tt)*) => {
        $crate::diag::write(&format!($($arg)*))
    };
}

#[tauri::command]
pub fn diag_log(message: String) {
    let message: String = message.chars().take(400).collect();
    write(&format!("ui: {message}"));
}

const VIEW_BYTES: u64 = 256 * 1024;

#[tauri::command]
pub fn read_diag_log() -> Result<String, String> {
    use std::io::{Read, Seek, SeekFrom};
    let path = LOG
        .lock()
        .unwrap_or_else(|err| err.into_inner())
        .as_ref()
        .map(|(path, _)| path.clone())
        .ok_or("The log file isn't open")?;
    let mut file = File::open(&path).map_err(|err| err.to_string())?;
    let len = file.metadata().map_err(|err| err.to_string())?.len();
    file.seek(SeekFrom::Start(len.saturating_sub(VIEW_BYTES)))
        .map_err(|err| err.to_string())?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|err| err.to_string())?;
    Ok(format!("{}\n{}", path.display(), String::from_utf8_lossy(&bytes)))
}
