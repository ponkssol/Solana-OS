use std::sync::atomic::{AtomicU8, Ordering};

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

#[cfg(windows)]
use windows::Win32::Foundation::HWND;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_STYLE, HWND_NOTOPMOST, HWND_TOPMOST,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WINDOW_STYLE, WS_BORDER, WS_CAPTION,
    WS_CLIPSIBLINGS, WS_DLGFRAME, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
};

// 0 = fullscreen OS, 1 = windowed Windows mode.
static MODE: AtomicU8 = AtomicU8::new(0);
static NUDGES: AtomicU8 = AtomicU8::new(0);
#[cfg(windows)]
static Z_ORDER: AtomicU8 = AtomicU8::new(2);

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ShellMode {
    Os = 0,
    Windows = 1,
}

impl ShellMode {
    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "windows" | "window" | "windowed" => Self::Windows,
            _ => Self::Os,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Os => "os",
            Self::Windows => "windows",
        }
    }
}

pub fn current() -> ShellMode {
    if MODE.load(Ordering::SeqCst) == ShellMode::Windows as u8 {
        ShellMode::Windows
    } else {
        ShellMode::Os
    }
}

struct Bounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub fn install(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = apply(&window, ShellMode::Os);
    let watched = window.clone();
    window.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::Resized(_) | WindowEvent::Moved(_) | WindowEvent::ScaleFactorChanged { .. }
        ) {
            maintain(&watched);
        }
    });
    let _ = window.show();
    let _ = window.set_focus();
    #[cfg(windows)]
    if let Ok(hwnd) = hwnd_of(&window) {
        probe_input(hwnd.0 as isize);
    }
    crate::diag!("shell shown in {} mode", current().as_str());
}

// Logs, for the first seconds after boot, whether the shell holds the foreground, is
// enabled, answers messages and is the window under the cursor; together these say why
// clicks on the lock screen do not arrive. Foreground is taken back if another window has it.
#[cfg(windows)]
fn probe_input(shell_bits: isize) {
    use windows::Win32::Foundation::{LPARAM, POINT, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetAncestor, GetClassNameW, GetCursorPos, GetForegroundWindow, SendMessageTimeoutW, WindowFromPoint,
        GA_ROOT, SMTO_ABORTIFHUNG, WM_NULL, WS_DISABLED,
    };
    let _ = std::thread::Builder::new().name("solos-input-probe".into()).spawn(move || {
        let shell = HWND(shell_bits as *mut _);
        for tick in 0..20 {
            std::thread::sleep(std::time::Duration::from_millis(if tick == 0 { 300 } else { 1000 }));
            unsafe {
                let foreground = GetForegroundWindow();
                let enabled = GetWindowLongPtrW(shell, GWL_STYLE) as u32 & WS_DISABLED.0 == 0;
                let mut result = 0usize;
                let answered = SendMessageTimeoutW(
                    shell,
                    WM_NULL,
                    WPARAM(0),
                    LPARAM(0),
                    SMTO_ABORTIFHUNG,
                    500,
                    Some(&mut result),
                )
                .0 != 0;
                let mut cursor = POINT::default();
                let _ = GetCursorPos(&mut cursor);
                let under = WindowFromPoint(cursor);
                let mut class = [0u16; 128];
                let len = GetClassNameW(under, &mut class) as usize;
                let under_root = GetAncestor(under, GA_ROOT);
                crate::diag!(
                    "input probe foreground_is_shell={} enabled={enabled} responsive={answered} under={:#x} class={} under_is_shell={}",
                    foreground == shell,
                    under.0 as isize,
                    String::from_utf16_lossy(&class[..len]),
                    under_root == shell
                );
                if foreground != shell && current() == ShellMode::Os {
                    crate::containment::bring_to_front(shell_bits);
                }
            }
        }
    });
}

pub fn apply(window: &WebviewWindow, mode: ShellMode) -> Result<(), String> {
    crate::diag!("shell presentation -> {}", mode.as_str());
    MODE.store(mode as u8, Ordering::SeqCst);
    NUDGES.store(0, Ordering::SeqCst);
    // Leave the OS fullscreen flag off. On WebView2 that flag is cancelled by Esc,
    // and a maximized window still stops above the taskbar.
    window.set_decorations(false).map_err(|e| e.to_string())?;
    let _ = window.set_shadow(false);
    let _ = window.set_zoom(1.0);
    let _ = window.set_fullscreen(false);
    match mode {
        ShellMode::Os => {
            window.set_always_on_top(true).map_err(|e| e.to_string())?;
            place(window, true)
        }
        ShellMode::Windows => {
            window.set_always_on_top(false).map_err(|e| e.to_string())?;
            place(window, false)
        }
    }
}

#[tauri::command]
pub fn set_shell_presentation(mode: String, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    apply(&window, ShellMode::parse(&mode))
}

#[tauri::command]
pub fn get_shell_presentation() -> &'static str {
    current().as_str()
}

#[tauri::command]
pub fn minimize_shell(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    crate::diag!("shell minimize requested");
    // A topmost window would stay above whatever the user switches to after restoring
    // another app, so drop it here; maintain() puts it back once the shell is restored.
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    Z_ORDER.store(0, Ordering::SeqCst);
    window.minimize().map_err(|e| e.to_string())
}

pub fn maintain(window: &WebviewWindow) {
    if current() != ShellMode::Os {
        return;
    }
    // Minimizing raises Resized/Moved too; placing the window then would restore it at once.
    if window.is_minimized().unwrap_or(false) {
        return;
    }
    if let Ok(bounds) = monitor_bounds(window, true) {
        if !within(window, &bounds, 32) {
            NUDGES.store(0, Ordering::SeqCst);
        }
    }
    let _ = place(window, true);
}

fn place(window: &WebviewWindow, cover_taskbar: bool) -> Result<(), String> {
    let bounds = monitor_bounds(window, cover_taskbar)?;
    #[cfg(windows)]
    sync_window_style(window, cover_taskbar)?;
    if already_placed(window, &bounds) {
        crate::containment::nudge();
        return Ok(());
    }
    let nudges = NUDGES.load(Ordering::SeqCst);
    if nudges > 6 {
        crate::containment::nudge();
        return Ok(());
    }
    NUDGES.store(nudges + 1, Ordering::SeqCst);
    window
        .set_position(PhysicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(bounds.width, bounds.height))
        .map_err(|e| e.to_string())?;
    crate::containment::nudge();
    Ok(())
}

fn monitor_bounds(window: &WebviewWindow, cover_taskbar: bool) -> Result<Bounds, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or(window.primary_monitor().map_err(|e| e.to_string())?)
        .ok_or_else(|| "No display is attached".to_string())?;
    if cover_taskbar {
        let pos = monitor.position();
        let size = monitor.size();
        return Ok(Bounds {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
        });
    }
    let work = monitor.work_area();
    Ok(Bounds {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width,
        height: work.size.height,
    })
}

fn already_placed(window: &WebviewWindow, bounds: &Bounds) -> bool {
    within(window, bounds, 1)
}

fn within(window: &WebviewWindow, bounds: &Bounds, slack: u32) -> bool {
    let Ok(pos) = window.outer_position() else {
        return false;
    };
    let Ok(size) = window.outer_size() else {
        return false;
    };
    (pos.x - bounds.x).unsigned_abs() <= slack
        && (pos.y - bounds.y).unsigned_abs() <= slack
        && size.width.abs_diff(bounds.width) <= slack
        && size.height.abs_diff(bounds.height) <= slack
}

#[cfg(windows)]
fn hwnd_of(window: &WebviewWindow) -> Result<HWND, String> {
    let handle = window.hwnd().map_err(|e| e.to_string())?;
    Ok(HWND(handle.0))
}

#[cfg(windows)]
fn popup_style(current: isize) -> isize {
    let style = WINDOW_STYLE(current as u32);
    let cleared = style & !(WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME | WS_SYSMENU);
    // WS_VISIBLE is left to tao; forcing it here showed the window before tao's own show(),
    // outside its bookkeeping of the hidden window and its WebView2 controller.
    let next = cleared | WS_POPUP | WS_CLIPSIBLINGS | WS_MINIMIZEBOX;
    next.0 as isize
}

#[cfg(windows)]
fn sync_window_style(window: &WebviewWindow, topmost: bool) -> Result<(), String> {
    let hwnd = hwnd_of(window)?;
    let want_z: u8 = if topmost { 1 } else { 0 };
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let desired = popup_style(current);
        let style_changed = current != desired;
        let z_changed = Z_ORDER.swap(want_z, Ordering::SeqCst) != want_z;
        if !style_changed && !z_changed {
            return Ok(());
        }
        if style_changed {
            SetWindowLongPtrW(hwnd, GWL_STYLE, desired);
        }
        let insert_after = if topmost { HWND_TOPMOST } else { HWND_NOTOPMOST };
        let flags = if style_changed {
            SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE
        } else {
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
        };
        SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, flags).map_err(|err| err.to_string())?;
    }
    crate::containment::nudge();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ShellMode;

    #[test]
    fn unknown_mode_stays_fullscreen() {
        assert_eq!(ShellMode::parse("os").as_str(), "os");
        assert_eq!(ShellMode::parse("").as_str(), "os");
        assert_eq!(ShellMode::parse("WINDOWS").as_str(), "windows");
        assert_eq!(ShellMode::parse("windowed").as_str(), "windows");
    }
}
