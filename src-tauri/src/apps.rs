use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::cloner::{build_supported_app_catalog, ClonedAppInstance, CloneLaunchRequest};
use crate::EnclaveState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub id: String,
    pub name: String,
    pub path: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchAppRequest {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub room_id: String,
    pub clone: bool,
}

const SKIPPED_NAMES: [&str; 9] = [
    "uninstall", "readme", "read me", "help", "manual", "documentation", "website", "release notes",
    "license",
];

#[tauri::command]
pub async fn list_installed_apps() -> Result<Vec<InstalledApp>, String> {
    tauri::async_runtime::spawn_blocking(scan_installed_apps)
        .await
        .map_err(|err| err.to_string())
}

/// Returns `data:image/png;base64,…` URLs keyed by executable path; failures are simply omitted.
#[tauri::command]
pub async fn app_icons(paths: Vec<String>) -> Result<HashMap<String, String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = HashMap::new();
        for path in paths {
            if let Some(url) = cached_icon(&path) {
                out.insert(path, url);
            }
        }
        out
    })
    .await
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn launch_app(
    request: LaunchAppRequest,
    state: State<'_, EnclaveState>,
) -> Result<ClonedAppInstance, String> {
    let mut cloner = state.cloner.lock().map_err(|_| "App Cloner mutex poisoned")?;
    let result = cloner.clone_and_launch(CloneLaunchRequest {
        app_id: request.id.clone(),
        room_id: request.room_id,
        custom_exe_path: Some(request.path),
        extra_args: Some(request.args),
        launch_on_enclave_desktop: Some(false),
        instance_label: None,
        isolate: Some(request.clone),
        display_name: Some(request.name),
    });
    if let Err(err) = &result {
        crate::diag!("launch {} failed: {err}", request.id);
    }
    result
}

fn cached_icon(path: &str) -> Option<String> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let key = path.to_lowercase();
    if let Some(hit) = cache.lock().ok()?.get(&key) {
        return hit.clone();
    }
    let url = extract_icon_png(path).map(|png| {
        use base64::Engine;
        format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png)
        )
    });
    cache.lock().ok()?.insert(key, url.clone());
    url
}

fn scan_installed_apps() -> Vec<InstalledApp> {
    let mut apps: Vec<InstalledApp> = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    let mut seen_targets = std::collections::HashSet::new();
    let catalog = build_supported_app_catalog();
    let own_exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let mut push = |name: String, path: String, args: Vec<String>| {
        let target_key = format!("{}|{}", path.to_lowercase(), args.join(" "));
        if path.to_lowercase() == own_exe
            || !seen_names.insert(name.to_lowercase())
            || !seen_targets.insert(target_key)
        {
            return;
        }
        let id = catalog
            .iter()
            .find(|spec| spec.resolved_exe_path.eq_ignore_ascii_case(&path))
            .map(|spec| spec.app_id.clone())
            .unwrap_or_else(|| slug(&name));
        apps.push(InstalledApp { id, name, path, args });
    };

    let mut shortcuts = Vec::new();
    for root in start_menu_roots() {
        collect_shortcuts(&root, 0, &mut shortcuts);
    }
    for lnk in shortcuts {
        let Some(name) = lnk.file_stem().map(|s| s.to_string_lossy().to_string()) else {
            continue;
        };
        let lower = name.to_lowercase();
        if SKIPPED_NAMES.iter().any(|word| lower.contains(word)) {
            continue;
        }
        let Some((target, args)) = resolve_shortcut(&lnk) else {
            continue;
        };
        let file = Path::new(&target)
            .file_name()
            .map(|f| f.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !file.ends_with(".exe") || file.starts_with("unins") || !Path::new(&target).exists() {
            continue;
        }
        push(name, target, split_args(&args));
    }

    for spec in catalog.iter().filter(|spec| spec.detected_on_host) {
        push(spec.display_name.clone(), spec.resolved_exe_path.clone(), Vec::new());
    }
    if let Ok(root) = std::env::var("SystemRoot") {
        for (name, exe) in [
            ("Notepad", r"System32\notepad.exe"),
            ("Command Prompt", r"System32\cmd.exe"),
            ("Windows PowerShell", r"System32\WindowsPowerShell\v1.0\powershell.exe"),
        ] {
            let path = Path::new(&root).join(exe);
            if path.exists() {
                push(name.to_string(), path.to_string_lossy().to_string(), Vec::new());
            }
        }
    }

    apps.sort_by_key(|app| app.name.to_lowercase());
    apps
}

fn start_menu_roots() -> Vec<PathBuf> {
    ["ProgramData", "APPDATA"]
        .iter()
        .filter_map(|var| std::env::var(var).ok())
        .map(|base| Path::new(&base).join(r"Microsoft\Windows\Start Menu\Programs"))
        .collect()
}

fn collect_shortcuts(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 4 {
                collect_shortcuts(&path, depth + 1, out);
            }
        } else if path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
        {
            out.push(path);
        }
    }
}

fn slug(name: &str) -> String {
    let mut out = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() { "app".to_string() } else { out }
}

fn split_args(raw: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for ch in raw.chars() {
        match ch {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }
    if !current.is_empty() {
        args.push(current);
    }
    args
}

#[cfg(windows)]
fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn init_com() {
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
    // Pool threads are reused, so an already-initialized apartment is expected and ignored.
    let _ = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
}

#[cfg(windows)]
fn resolve_shortcut(lnk: &Path) -> Option<(String, String)> {
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, IPersistFile, CLSCTX_INPROC_SERVER, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    init_com();
    unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
        let file: IPersistFile = link.cast().ok()?;
        let path = wide(&lnk.to_string_lossy());
        file.Load(PCWSTR(path.as_ptr()), STGM_READ).ok()?;
        let mut target = [0u16; 1024];
        link.GetPath(&mut target, std::ptr::null_mut(), 0).ok()?;
        let mut args = [0u16; 2048];
        let _ = link.GetArguments(&mut args);
        let decode = |buf: &[u16]| {
            let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            String::from_utf16_lossy(&buf[..end])
        };
        let target = decode(&target);
        if target.is_empty() {
            return None;
        }
        Some((target, decode(&args)))
    }
}

#[cfg(not(windows))]
fn resolve_shortcut(_lnk: &Path) -> Option<(String, String)> {
    None
}

#[cfg(windows)]
fn extract_icon_png(path: &str) -> Option<Vec<u8>> {
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::UI::Shell::{
        IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
        SIIGBF_ICONONLY,
    };

    init_com();
    unsafe {
        let wpath = wide(path);
        let item: IShellItem = SHCreateItemFromParsingName(PCWSTR(wpath.as_ptr()), None).ok()?;
        let factory: IShellItemImageFactory = item.cast().ok()?;
        let bitmap = factory
            .GetImage(SIZE { cx: 128, cy: 128 }, SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK)
            .ok()?;

        let mut info = BITMAP::default();
        let read = GetObjectW(
            HGDIOBJ(bitmap.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut info as *mut BITMAP as *mut _),
        );
        let (width, height) = (info.bmWidth, info.bmHeight.abs());
        let mut pixels = vec![0u8; (width * height * 4).max(0) as usize];
        let mut header = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let dc = CreateCompatibleDC(None);
        let lines = if read > 0 && width > 0 {
            GetDIBits(
                dc,
                bitmap,
                0,
                height as u32,
                Some(pixels.as_mut_ptr() as *mut _),
                &mut header,
                DIB_RGB_COLORS,
            )
        } else {
            0
        };
        let _ = DeleteDC(dc);
        let _ = DeleteObject(HGDIOBJ(bitmap.0));
        if lines == 0 {
            return None;
        }

        let has_alpha = pixels.chunks_exact(4).any(|px| px[3] != 0);
        for px in pixels.chunks_exact_mut(4) {
            px.swap(0, 2);
            if !has_alpha {
                px[3] = 255;
            } else if px[3] > 0 && px[3] < 255 {
                // The shell hands back premultiplied alpha; PNG expects straight alpha.
                let alpha = px[3] as u32;
                for channel in &mut px[..3] {
                    *channel = ((*channel as u32 * 255) / alpha).min(255) as u8;
                }
            }
        }
        encode_png(width as u32, height as u32, &pixels)
    }
}

#[cfg(not(windows))]
fn extract_icon_png(_path: &str) -> Option<Vec<u8>> {
    None
}

#[cfg(windows)]
fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut encoder = png::Encoder::new(&mut out, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().ok()?;
    writer.write_image_data(rgba).ok()?;
    writer.finish().ok()?;
    Some(out)
}
