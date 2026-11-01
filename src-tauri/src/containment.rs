//! Keeps apps launched on the interactive desktop inside the Solana OS shell.
//!
//! App windows stay real top-level windows that draw and move themselves; they are owned
//! by the shell (so they never get a taskbar button) and are only clamped back into the
//! shell desk area when they leave it. Small popups are clamped the same way.

// The classifiers and event types are only reached from the Win32 hook; Linux CI still
// compiles them so the unit tests run there.
#![cfg_attr(not(windows), allow(dead_code))]

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureClass {
    Ignore,
    Transient,
    Frame,
}

pub fn classify_window(class_name: &str, width: i32, height: i32) -> CaptureClass {
    if skip_window_class(class_name) {
        return CaptureClass::Ignore;
    }
    let class = class_name.to_ascii_lowercase();
    if class.contains("message") && width < 8 && height < 8 {
        return CaptureClass::Ignore;
    }
    if width < 8 || height < 8 {
        return CaptureClass::Ignore;
    }
    if width < 280 || height < 160 {
        return CaptureClass::Transient;
    }
    CaptureClass::Frame
}

pub fn skip_window_class(class_name: &str) -> bool {
    let name = class_name.to_ascii_lowercase();
    matches!(
        name.as_str(),
        "tooltips_class32"
            | "sysshadow"
            | "ime"
            | "msctfime ui"
            | "cicerouiwnframe"
            | "internet explorer_hidden"
            | "progman"
            | "shell_traywnd"
            | "workerw"
            | "base_powermessagewindow"
            | "dummyduiwindow"
    ) || name.contains("tooltip")
        || name.contains("dropshadow")
        || name.starts_with("msctfime")
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContainmentEvent {
    kind: String,
    instance_id: String,
    hwnd: String,
    title: String,
    primary: bool,
    app_name: String,
    room_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeskArea {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub fn install(app: &AppHandle) {
    #[cfg(windows)]
    {
        win::install(app);
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
}

pub fn nudge() {
    #[cfg(windows)]
    {
        win::post(win::Command::Raise);
    }
}

pub fn bring_to_front(hwnd_bits: isize) {
    #[cfg(windows)]
    {
        win::force_foreground(windows::Win32::Foundation::HWND(hwnd_bits as *mut _));
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd_bits;
    }
}

/// Returns false when the instance was already reaped after exiting on its own.
pub fn release(instance_id: &str) -> bool {
    #[cfg(windows)]
    {
        win::release(instance_id)
    }
    #[cfg(not(windows))]
    {
        let _ = instance_id;
        true
    }
}

#[cfg(windows)]
pub fn enroll(
    instance_id: &str,
    process: windows::Win32::Foundation::HANDLE,
    pid: u32,
    app_name: &str,
    room_id: &str,
) {
    win::enroll(instance_id, process, pid, app_name, room_id);
}

#[tauri::command]
pub fn containment_set_desk(desk: DeskArea) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::post(win::Command::Desk(desk));
    }
    #[cfg(not(windows))]
    {
        let _ = desk;
    }
    Ok(())
}

#[tauri::command]
pub fn containment_focus(hwnd: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::post(win::Command::Focus(hwnd));
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd;
    }
    Ok(())
}

#[tauri::command]
pub fn containment_close_window(hwnd: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::post(win::Command::Close(hwnd));
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd;
    }
    Ok(())
}

#[cfg(windows)]
mod win {
    use super::{classify_window, CaptureClass, ContainmentEvent, DeskArea};
    use std::collections::{HashMap, VecDeque};
    use std::sync::atomic::{AtomicIsize, AtomicU32, Ordering};
    use std::sync::{mpsc, LazyLock, Mutex};
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Emitter, Manager};

    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, BOOL, HMODULE, HWND, LPARAM, RECT, WPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::Graphics::Gdi::ClientToScreen;
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentThreadId, GetExitCodeProcess, OpenProcess,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, DispatchMessageW, EnumWindows, GetAncestor, GetClassNameW, GetClientRect,
        GetForegroundWindow, GetWindow, GetWindowLongPtrW, GetWindowRect, GetWindowTextW,
        GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, IsZoomed, MsgWaitForMultipleObjects,
        PeekMessageW, PostMessageW, PostThreadMessageW, SetForegroundWindow, SetWindowLongPtrW, SetWindowPos,
        ShowWindow, TranslateMessage, EVENT_OBJECT_CREATE, EVENT_OBJECT_DESTROY, EVENT_OBJECT_HIDE,
        EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_SHOW, GA_ROOT, GET_WINDOW_CMD,
        GWL_EXSTYLE, GWL_STYLE, IsHungAppWindow, GW_HWNDPREV, HWND_NOTOPMOST, HWND_TOPMOST, MSG,
        PM_NOREMOVE, PM_REMOVE, QS_ALLINPUT, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE,
        SWP_NOZORDER, SW_HIDE, SW_RESTORE, WINDOW_EX_STYLE, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
        WM_CLOSE, WM_QUIT, WS_CHILD, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
    };

    const EVENT_OBJECT_UNCLOAKED: u32 = 0x8018;
    const EVENT_SYSTEM_MOVESIZESTART: u32 = 0x000A;
    const EVENT_SYSTEM_MOVESIZEEND: u32 = 0x000B;
    const EVENT_SYSTEM_FOREGROUND: u32 = 0x0003;
    const EVENT_SYSTEM_MINIMIZESTART: u32 = 0x0016;
    const EVENT_SYSTEM_MINIMIZEEND: u32 = 0x0017;
    const STILL_ACTIVE: u32 = 259;
    static HOOK_THREAD: AtomicU32 = AtomicU32::new(0);
    const SWEEP_EVERY: Duration = Duration::from_millis(500);
    const PROBE_EVERY: Duration = Duration::from_secs(3);
    // The window inside a native move/size loop; clamping it mid-drag fights the loop and flickers.
    static DRAGGING: AtomicIsize = AtomicIsize::new(0);

    struct JobRec {
        handle_bits: isize,
        root_pid: u32,
        app_name: String,
        room_id: String,
        saw_frame: bool,
        exited: bool,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum Kind {
        Frame,
        Transient,
    }

    struct WinRec {
        instance_id: String,
        kind: Kind,
        title: String,
        announced: bool,
        minimized: bool,
    }

    struct Runtime {
        shell_bits: isize,
        app: AppHandle,
        windows: HashMap<isize, WinRec>,
        commands: VecDeque<Command>,
        desk: Option<DeskArea>,
    }

    struct PidCache {
        at: Option<Instant>,
        map: HashMap<u32, String>,
    }

    pub enum Command {
        Desk(DeskArea),
        Focus(String),
        Close(String),
        Release(String),
        Raise,
    }

    thread_local! {
        static ENUM_SINK: std::cell::RefCell<Vec<isize>> = const { std::cell::RefCell::new(Vec::new()) };
    }

    static JOBS: LazyLock<Mutex<HashMap<String, JobRec>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
    static RUNTIME: Mutex<Option<Runtime>> = Mutex::new(None);
    static PIDS: LazyLock<Mutex<PidCache>> = LazyLock::new(|| {
        Mutex::new(PidCache {
            at: None,
            map: HashMap::new(),
        })
    });

    fn bits_hwnd(bits: isize) -> HWND {
        HWND(bits as *mut _)
    }

    fn hwnd_bits(hwnd: HWND) -> isize {
        hwnd.0 as isize
    }

    fn bits_handle(bits: isize) -> windows::Win32::Foundation::HANDLE {
        windows::Win32::Foundation::HANDLE(bits as *mut _)
    }

    fn wide(text: &str) -> Vec<u16> {
        use std::os::windows::ffi::OsStrExt;
        std::ffi::OsStr::new(text)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub fn post(command: Command) {
        let tid = HOOK_THREAD.load(Ordering::SeqCst);
        if tid == 0 {
            return;
        }
        if let Ok(mut guard) = RUNTIME.lock() {
            if let Some(runtime) = guard.as_mut() {
                runtime.commands.push_back(command);
            }
        }
        unsafe {
            let _ = PostThreadMessageW(tid, 0x8000, WPARAM(0), LPARAM(0));
        }
    }

    pub fn install(app: &AppHandle) {
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let Ok(handle) = window.hwnd() else {
            return;
        };
        let shell_bits = handle.0 as isize;
        {
            let mut guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
            *guard = Some(Runtime {
                shell_bits,
                app: app.clone(),
                windows: HashMap::new(),
                commands: VecDeque::new(),
                desk: None,
            });
        }
        let (tx, rx) = mpsc::channel();
        std::thread::Builder::new()
            .name("solos-containment".into())
            .spawn(move || pump(tx))
            .ok();
        let _ = rx.recv_timeout(Duration::from_secs(2));
    }

    pub fn enroll(
        instance_id: &str,
        process: windows::Win32::Foundation::HANDLE,
        pid: u32,
        app_name: &str,
        room_id: &str,
    ) {
        let mut rec = JobRec {
            handle_bits: 0,
            root_pid: pid,
            app_name: app_name.to_string(),
            room_id: room_id.to_string(),
            saw_frame: false,
            exited: false,
        };
        unsafe {
            let name = wide(&format!("Local\\SolanaOS_Instance_{instance_id}"));
            if let Ok(job) = CreateJobObjectW(None, PCWSTR(name.as_ptr())) {
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let _ = SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const _,
                    std::mem::size_of_val(&info) as u32,
                );
                if AssignProcessToJobObject(job, process).is_ok() {
                    rec.handle_bits = job.0 as isize;
                } else {
                    let _ = CloseHandle(job);
                }
            }
        }
        crate::diag!("enroll {instance_id} pid={pid} job={}", rec.handle_bits != 0);
        if let Ok(mut jobs) = JOBS.lock() {
            jobs.insert(instance_id.to_string(), rec);
        }
        if let Ok(mut cache) = PIDS.lock() {
            cache.at = None;
        }
    }

    pub fn release(instance_id: &str) -> bool {
        let job = {
            let mut jobs = JOBS.lock().unwrap_or_else(|err| err.into_inner());
            jobs.remove(instance_id).map(|job| (job.handle_bits, job.exited))
        };
        let live = matches!(job, Some((_, false)));
        crate::diag!("release {instance_id} live={live}");
        if let Some((bits, _)) = job {
            if bits != 0 {
                unsafe {
                    let _ = CloseHandle(bits_handle(bits));
                }
            }
        }
        if let Ok(mut cache) = PIDS.lock() {
            cache.at = None;
        }
        post(Command::Release(instance_id.to_string()));
        live
    }

    fn pump(ready: mpsc::Sender<()>) {
        unsafe {
            let mut msg = MSG::default();
            let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
        }
        HOOK_THREAD.store(unsafe { GetCurrentThreadId() }, Ordering::SeqCst);
        let _ = ready.send(());
        unsafe {
            let _ = SetWinEventHook(
                EVENT_OBJECT_CREATE,
                EVENT_OBJECT_UNCLOAKED,
                HMODULE(std::ptr::null_mut()),
                Some(on_event),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );
            let _ = SetWinEventHook(
                EVENT_SYSTEM_MOVESIZESTART,
                EVENT_SYSTEM_MINIMIZEEND,
                HMODULE(std::ptr::null_mut()),
                Some(on_event),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );
            let _ = SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                HMODULE(std::ptr::null_mut()),
                Some(on_event),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            );
        }
        let mut last_sweep = Instant::now() - SWEEP_EVERY;
        let mut last_probe = Instant::now();
        loop {
            unsafe {
                let mut msg = MSG::default();
                let _ = MsgWaitForMultipleObjects(None, false, 80, QS_ALLINPUT);
                while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
                    if msg.message == WM_QUIT {
                        return;
                    }
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }
            drain();
            // Events handle the live work; the sweep only catches windows the hooks missed,
            // and running it at the old 80 ms cadence kept clones busy answering messages.
            if last_sweep.elapsed() >= SWEEP_EVERY {
                last_sweep = Instant::now();
                sweep();
            }
            if last_probe.elapsed() >= PROBE_EVERY {
                last_probe = Instant::now();
                probe_hung();
            }
        }
    }

    unsafe extern "system" fn on_event(
        _hook: HWINEVENTHOOK,
        event: u32,
        hwnd: HWND,
        id_object: i32,
        id_child: i32,
        _thread: u32,
        _time: u32,
    ) {
        if id_object != 0 || id_child != 0 || hwnd.0.is_null() {
            return;
        }
        if event == EVENT_SYSTEM_FOREGROUND {
            let bits = hwnd_bits(hwnd);
            if let Some(kind) = kind_of(bits) {
                crate::diag!("input-probe foreground hwnd={bits:#x} kind={kind:?}");
            }
            return;
        }
        if (EVENT_SYSTEM_MOVESIZESTART..=EVENT_SYSTEM_MINIMIZEEND).contains(&event) {
            on_system(hwnd_bits(hwnd), hwnd, event);
            return;
        }
        consider(hwnd, event);
    }

    fn consider(hwnd: HWND, event: u32) {
        let bits = hwnd_bits(hwnd);
        if event == EVENT_OBJECT_DESTROY {
            if tracked(bits) {
                forget(bits, true);
            }
            return;
        }
        let pid = pid_of(hwnd);
        let Some(instance_id) = instance_of(pid) else {
            return;
        };
        if tracked(bits) {
            on_tracked(bits, hwnd, event);
            return;
        }
        if event == EVENT_OBJECT_HIDE {
            return;
        }
        if !capturable(hwnd) {
            return;
        }
        capture(hwnd, &instance_id);
    }

    fn on_tracked(bits: isize, hwnd: HWND, event: u32) {
        if event == EVENT_OBJECT_HIDE && !unsafe { IsWindowVisible(hwnd).as_bool() } {
            if kind_of(bits) == Some(Kind::Transient) {
                forget(bits, false);
            }
            return;
        }
        if event == EVENT_OBJECT_NAMECHANGE {
            let title = window_title(hwnd);
            if title.is_empty() {
                return;
            }
            let changed = {
                let mut guard = match RUNTIME.lock() {
                    Ok(guard) => guard,
                    Err(err) => err.into_inner(),
                };
                let Some(runtime) = guard.as_mut() else {
                    return;
                };
                let Some(win) = runtime.windows.get_mut(&bits) else {
                    return;
                };
                if win.title == title {
                    return;
                }
                win.title = title.clone();
                win.announced
            };
            if changed {
                emit_for(bits, "title", &title);
            }
            return;
        }
        if event == EVENT_OBJECT_LOCATIONCHANGE || event == EVENT_OBJECT_SHOW {
            match kind_of(bits) {
                Some(Kind::Transient) => {
                    let (width, height) = window_size(hwnd);
                    if classify_window(&class_name(hwnd), width, height) == CaptureClass::Frame {
                        promote(bits, hwnd);
                    } else {
                        keep_inside(hwnd);
                    }
                }
                Some(Kind::Frame) if DRAGGING.load(Ordering::SeqCst) != bits => keep_inside(hwnd),
                _ => {}
            }
        }
    }

    fn on_system(bits: isize, hwnd: HWND, event: u32) {
        if kind_of(bits) != Some(Kind::Frame) {
            return;
        }
        match event {
            EVENT_SYSTEM_MOVESIZESTART => DRAGGING.store(bits, Ordering::SeqCst),
            EVENT_SYSTEM_MOVESIZEEND => {
                DRAGGING.store(0, Ordering::SeqCst);
                keep_inside(hwnd);
            }
            EVENT_SYSTEM_MINIMIZESTART => {
                // A hidden window has no taskbar or desktop icon; the dock restores it.
                unsafe {
                    let _ = ShowWindow(hwnd, SW_HIDE);
                }
                if set_minimized(bits, true) {
                    emit_for(bits, "minimized", "");
                }
            }
            EVENT_SYSTEM_MINIMIZEEND => {
                if set_minimized(bits, false) {
                    emit_for(bits, "restored", "");
                }
            }
            _ => {}
        }
    }

    fn set_minimized(bits: isize, minimized: bool) -> bool {
        let mut guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
        let Some(win) = guard.as_mut().and_then(|runtime| runtime.windows.get_mut(&bits)) else {
            return false;
        };
        let changed = win.minimized != minimized;
        win.minimized = minimized;
        changed && win.announced
    }

    fn capturable(hwnd: HWND) -> bool {
        unsafe {
            if !IsWindow(hwnd).as_bool() {
                return false;
            }
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            if style & WS_CHILD.0 != 0 {
                return false;
            }
            let root = GetAncestor(hwnd, GA_ROOT);
            if !root.0.is_null() && root != hwnd {
                return false;
            }
            // The sweep walks every top-level window, including the hidden helper and
            // not-yet-shown windows apps create at startup. Taking those reparents or
            // re-shows windows the app still drives itself, which hangs the clone;
            // EVENT_OBJECT_SHOW captures them once the app shows them.
            if !IsWindowVisible(hwnd).as_bool() {
                return false;
            }
            if cloaked(hwnd) {
                return false;
            }
            true
        }
    }

    fn capture(hwnd: HWND, instance_id: &str) {
        let (width, height) = window_size(hwnd);
        let class_name = class_name(hwnd);
        let class = classify_window(&class_name, width, height);
        if class == CaptureClass::Ignore {
            return;
        }
        let shell = shell_hwnd();
        if shell.0.is_null() {
            return;
        }
        strip_taskbar(hwnd);
        let title = window_title(hwnd);
        crate::diag!(
            "capture {instance_id} hwnd={:#x} class={class_name} {width}x{height} as {:?}",
            hwnd_bits(hwnd),
            class
        );
        if class == CaptureClass::Transient {
            remember(hwnd, instance_id, Kind::Transient, title, false);
            keep_inside(hwnd);
            unsafe {
                let _ = SetWindowPos(hwnd, z_insert(), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
            }
            return;
        }
        let primary = mark_frame(instance_id);
        remember(hwnd, instance_id, Kind::Frame, title.clone(), true);
        keep_inside(hwnd);
        unsafe {
            let _ = SetWindowPos(hwnd, z_insert(), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
        }
        emit_window(instance_id, hwnd_bits(hwnd), &title, primary, "appeared");
    }

    fn promote(bits: isize, hwnd: HWND) {
        let instance_id = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            let Some(win) = runtime.windows.get(&bits) else {
                return;
            };
            win.instance_id.clone()
        };
        forget(bits, false);
        capture(hwnd, &instance_id);
    }

    fn remember(hwnd: HWND, instance_id: &str, kind: Kind, title: String, announced: bool) {
        let mut guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
        let Some(runtime) = guard.as_mut() else {
            return;
        };
        runtime.windows.insert(
            hwnd_bits(hwnd),
            WinRec {
                instance_id: instance_id.to_string(),
                kind,
                title,
                announced,
                minimized: false,
            },
        );
    }

    fn tracked(bits: isize) -> bool {
        RUNTIME
            .lock()
            .ok()
            .and_then(|guard| guard.as_ref().map(|runtime| runtime.windows.contains_key(&bits)))
            .unwrap_or(false)
    }

    fn kind_of(bits: isize) -> Option<Kind> {
        RUNTIME.lock().ok().and_then(|guard| {
            guard
                .as_ref()
                .and_then(|runtime| runtime.windows.get(&bits).map(|win| win.kind))
        })
    }

    fn mark_frame(instance_id: &str) -> bool {
        let mut jobs = JOBS.lock().unwrap_or_else(|err| err.into_inner());
        let Some(job) = jobs.get_mut(instance_id) else {
            return true;
        };
        let primary = !job.saw_frame;
        job.saw_frame = true;
        primary
    }

    fn forget(bits: isize, announce: bool) {
        let removed = {
            let mut guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
            guard.as_mut().and_then(|runtime| runtime.windows.remove(&bits))
        };
        let Some(win) = removed else {
            return;
        };
        if DRAGGING.load(Ordering::SeqCst) == bits {
            DRAGGING.store(0, Ordering::SeqCst);
        }
        if announce && win.announced {
            emit_window(&win.instance_id, bits, &win.title, false, "destroyed");
        }
    }

    fn emit_for(bits: isize, kind: &str, title: &str) {
        let snapshot = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            let Some(win) = runtime.windows.get(&bits) else {
                return;
            };
            (win.instance_id.clone(), runtime.app.clone())
        };
        emit_with(&snapshot.1, &snapshot.0, bits, title, false, kind);
    }

    fn emit_window(instance_id: &str, bits: isize, title: &str, primary: bool, kind: &str) {
        let app = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            guard.as_ref().map(|runtime| runtime.app.clone())
        };
        if let Some(app) = app {
            emit_with(&app, instance_id, bits, title, primary, kind);
        }
    }

    fn emit_with(
        app: &AppHandle,
        instance_id: &str,
        bits: isize,
        title: &str,
        primary: bool,
        kind: &str,
    ) {
        let (app_name, room_id) = job_names(instance_id);
        let _ = app.emit(
            "containment-window",
            ContainmentEvent {
                kind: kind.to_string(),
                instance_id: instance_id.to_string(),
                hwnd: bits.to_string(),
                title: title.to_string(),
                primary,
                app_name,
                room_id,
            },
        );
    }

    fn job_names(instance_id: &str) -> (String, String) {
        let jobs = JOBS.lock().unwrap_or_else(|err| err.into_inner());
        jobs.get(instance_id)
            .map(|job| (job.app_name.clone(), job.room_id.clone()))
            .unwrap_or_else(|| (String::new(), String::new()))
    }

    fn drain() {
        let commands: Vec<Command> = {
            let mut guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_mut() else {
                return;
            };
            runtime.commands.drain(..).collect()
        };
        for command in commands {
            match command {
                Command::Desk(desk) => set_desk(desk),
                Command::Focus(hwnd) => focus_hwnd(&hwnd),
                Command::Close(hwnd) => close_hwnd(&hwnd),
                Command::Release(id) => drop_instance(&id),
                Command::Raise => raise_owned(),
            }
        }
    }

    fn set_desk(desk: DeskArea) {
        let frames: Vec<isize> = {
            let mut guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
            let Some(runtime) = guard.as_mut() else {
                return;
            };
            runtime.desk = Some(desk);
            runtime.windows.keys().copied().collect()
        };
        for bits in frames {
            keep_inside(bits_hwnd(bits));
        }
    }

    fn focus_hwnd(raw: &str) {
        let Ok(bits) = raw.parse::<isize>() else {
            return;
        };
        let hwnd = bits_hwnd(bits);
        unsafe {
            if !IsWindow(hwnd).as_bool() {
                return;
            }
            if IsIconic(hwnd).as_bool() || !IsWindowVisible(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
                if set_minimized(bits, false) {
                    emit_for(bits, "restored", "");
                }
            }
            let _ = SetWindowPos(hwnd, z_insert(), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
        }
        force_foreground(hwnd);
    }

    pub fn force_foreground(hwnd: HWND) {
        unsafe {
            let foreground = GetForegroundWindow();
            let foreground_thread = GetWindowThreadProcessId(foreground, None);
            let current = GetCurrentThreadId();
            if foreground_thread != 0 && foreground_thread != current {
                let _ = AttachThreadInput(foreground_thread, current, true);
            }
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
            if foreground_thread != 0 && foreground_thread != current {
                let _ = AttachThreadInput(foreground_thread, current, false);
            }
        }
    }

    fn close_hwnd(raw: &str) {
        let Ok(bits) = raw.parse::<isize>() else {
            return;
        };
        unsafe {
            let _ = PostMessageW(bits_hwnd(bits), WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }

    fn drop_instance(instance_id: &str) {
        let keys: Vec<isize> = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            runtime
                .windows
                .iter()
                .filter(|(_, win)| win.instance_id == instance_id)
                .map(|(bits, _)| *bits)
                .collect()
        };
        for bits in keys {
            forget(bits, true);
        }
        emit_window(instance_id, 0, "", false, "exited");
    }

    fn sweep() {
        let hwnds = enum_top_level();
        for bits in hwnds {
            let hwnd = bits_hwnd(bits);
            if unsafe { IsWindow(hwnd).as_bool() } {
                consider(hwnd, EVENT_OBJECT_SHOW);
            }
        }
        reassert();
        reap_jobs();
    }

    fn reassert() {
        let snapshot: Vec<isize> = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            runtime.windows.keys().copied().collect()
        };
        let dragging = DRAGGING.load(Ordering::SeqCst);
        for bits in snapshot {
            let hwnd = bits_hwnd(bits);
            if !unsafe { IsWindow(hwnd).as_bool() } {
                forget(bits, true);
            } else if bits != dragging {
                keep_inside(hwnd);
            }
        }
        raise_owned();
    }

    fn reap_jobs() {
        let dead: Vec<String> = {
            let jobs = match JOBS.lock() {
                Ok(jobs) => jobs,
                Err(err) => err.into_inner(),
            };
            jobs.iter()
                .filter(|(_, job)| !job.exited && !instance_alive(job))
                .map(|(id, _)| id.clone())
                .collect()
        };
        for id in dead {
            if let Ok(mut jobs) = JOBS.lock() {
                if let Some(job) = jobs.get_mut(&id) {
                    job.exited = true;
                }
            }
            drop_instance(&id);
            release_job_only(&id);
            mark_stopped(&id);
        }
    }

    fn mark_stopped(instance_id: &str) {
        crate::diag!("instance exited {instance_id}");
        let app = {
            let guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
            guard.as_ref().map(|runtime| runtime.app.clone())
        };
        let Some(app) = app else {
            return;
        };
        let state = app.state::<crate::EnclaveState>();
        if let Ok(mut cloner) = state.cloner.lock() {
            cloner.mark_exited(instance_id);
        };
    }

    fn release_job_only(instance_id: &str) {
        let handle_bits = {
            let mut jobs = JOBS.lock().unwrap_or_else(|err| err.into_inner());
            jobs.remove(instance_id).map(|job| job.handle_bits)
        };
        if let Some(bits) = handle_bits {
            if bits != 0 {
                unsafe {
                    let _ = CloseHandle(bits_handle(bits));
                }
            }
        }
    }

    // Launchers such as Discord's Update.exe exit right after spawning the real app,
    // so the instance lives as long as anything is left in its job.
    fn instance_alive(job: &JobRec) -> bool {
        if job.handle_bits != 0 && !job_pids(bits_handle(job.handle_bits)).is_empty() {
            return true;
        }
        process_alive(job.root_pid)
    }

    fn process_alive(pid: u32) -> bool {
        unsafe {
            let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
                return false;
            };
            let mut code = 0u32;
            let ok = GetExitCodeProcess(handle, &mut code);
            let _ = CloseHandle(handle);
            ok.is_ok() && code == STILL_ACTIVE
        }
    }

    fn raise_owned() {
        let shell = shell_hwnd();
        if shell.0.is_null() {
            return;
        }
        let owned: Vec<isize> = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            runtime
                .windows
                .iter()
                .filter(|(_, win)| win.kind == Kind::Frame && !win.minimized)
                .map(|(bits, _)| *bits)
                .collect()
        };
        let insert = z_insert();
        for bits in owned {
            let hwnd = bits_hwnd(bits);
            if !is_above(hwnd, shell) {
                unsafe {
                    let _ = SetWindowPos(hwnd, insert, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
                }
            }
        }
    }

    fn window_relative(hwnd: HWND, cmd: GET_WINDOW_CMD) -> HWND {
        unsafe { GetWindow(hwnd, cmd).unwrap_or(HWND(std::ptr::null_mut())) }
    }

    fn is_above(upper: HWND, lower: HWND) -> bool {
        let mut cursor = window_relative(lower, GW_HWNDPREV);
        let mut guard = 0;
        while !cursor.0.is_null() && guard < 1024 {
            if cursor == upper {
                return true;
            }
            cursor = window_relative(cursor, GW_HWNDPREV);
            guard += 1;
        }
        false
    }

    fn z_insert() -> HWND {
        if crate::shell_mode::current() == crate::shell_mode::ShellMode::Os {
            HWND_TOPMOST
        } else {
            HWND_NOTOPMOST
        }
    }

    fn desk_rect() -> Option<RECT> {
        let shell = shell_hwnd();
        let desk = {
            let guard = RUNTIME.lock().ok()?;
            guard.as_ref()?.desk.as_ref().map(|desk| (desk.x, desk.y, desk.width, desk.height))
        };
        let (x, y, width, height) = match desk {
            Some(desk) => desk,
            None => {
                let mut client = RECT::default();
                unsafe { GetClientRect(shell, &mut client).ok()? };
                (0, 0, client.right, client.bottom)
            }
        };
        let (left, top) = client_to_screen(shell, x, y)?;
        Some(RECT {
            left,
            top,
            right: left + width.max(1),
            bottom: top + height.max(1),
        })
    }

    // Only moves a window that left the desk (or a maximized one that does not fill it),
    // so a window the app is already managing inside the shell is never touched.
    fn keep_inside(hwnd: HWND) {
        unsafe {
            if IsIconic(hwnd).as_bool() || !IsWindowVisible(hwnd).as_bool() {
                return;
            }
            let Some(area) = desk_rect() else {
                return;
            };
            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_err() {
                return;
            }
            let target = if IsZoomed(hwnd).as_bool() {
                area
            } else {
                let width = (rect.right - rect.left).clamp(1, (area.right - area.left).max(1));
                let height = (rect.bottom - rect.top).clamp(1, (area.bottom - area.top).max(1));
                let left = rect.left.clamp(area.left, (area.right - width).max(area.left));
                let top = rect.top.clamp(area.top, (area.bottom - height).max(area.top));
                RECT {
                    left,
                    top,
                    right: left + width,
                    bottom: top + height,
                }
            };
            if target == rect {
                return;
            }
            let _ = SetWindowPos(
                hwnd,
                None,
                target.left,
                target.top,
                target.right - target.left,
                target.bottom - target.top,
                SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS,
            );
        }
    }

    fn client_to_screen(hwnd: HWND, x: i32, y: i32) -> Option<(i32, i32)> {
        unsafe {
            let mut point = windows::Win32::Foundation::POINT { x, y };
            if !ClientToScreen(hwnd, &mut point).as_bool() {
                return None;
            }
            Some((point.x, point.y))
        }
    }

    // WS_EX_TOOLWINDOW alone keeps the window off the taskbar. Making the shell its owner
    // as well attached the clone's input queue to the webview thread, so a busy shell froze
    // clicks in every hosted app; raise_owned keeps the z-order instead.
    fn strip_taskbar(hwnd: HWND) {
        unsafe {
            let ex = WINDOW_EX_STYLE(GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32);
            let ex = (ex & !WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex.0 as isize);
        }
    }

    fn probe_hung() {
        let frames: Vec<isize> = {
            let guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            runtime.windows.keys().copied().collect()
        };
        for bits in frames {
            if unsafe { IsHungAppWindow(bits_hwnd(bits)).as_bool() } {
                crate::diag!("input-probe hung hwnd={bits:#x}");
            }
        }
    }

    fn enum_top_level() -> Vec<isize> {
        ENUM_SINK.with(|sink| sink.borrow_mut().clear());
        unsafe {
            let _ = EnumWindows(Some(enum_proc), LPARAM(0));
        }
        ENUM_SINK.with(|sink| sink.borrow().clone())
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, _param: LPARAM) -> BOOL {
        ENUM_SINK.with(|sink| sink.borrow_mut().push(hwnd_bits(hwnd)));
        BOOL(1)
    }

    fn instance_of(pid: u32) -> Option<String> {
        if pid == 0 {
            return None;
        }
        {
            let cache = PIDS.lock().ok()?;
            if cache.at.map(|at| at.elapsed() < Duration::from_millis(30)).unwrap_or(false) {
                return cache.map.get(&pid).cloned();
            }
        }
        let map = collect_pids();
        let found = map.get(&pid).cloned();
        if let Ok(mut cache) = PIDS.lock() {
            cache.map = map;
            cache.at = Some(Instant::now());
        }
        found
    }

    fn collect_pids() -> HashMap<u32, String> {
        let jobs = JOBS.lock().unwrap_or_else(|err| err.into_inner());
        let mut map = HashMap::new();
        for (id, job) in jobs.iter() {
            if job.exited {
                continue;
            }
            map.insert(job.root_pid, id.clone());
            if job.handle_bits == 0 {
                continue;
            }
            for pid in job_pids(bits_handle(job.handle_bits)) {
                map.insert(pid, id.clone());
            }
        }
        map
    }

    fn job_pids(job: windows::Win32::Foundation::HANDLE) -> Vec<u32> {
        #[repr(C)]
        struct PidList {
            assigned: u32,
            count: u32,
            ids: [usize; 256],
        }
        unsafe {
            let mut list = PidList {
                assigned: 0,
                count: 0,
                ids: [0; 256],
            };
            if windows::Win32::System::JobObjects::QueryInformationJobObject(
                job,
                windows::Win32::System::JobObjects::JobObjectBasicProcessIdList,
                &mut list as *mut _ as *mut _,
                std::mem::size_of::<PidList>() as u32,
                None,
            )
            .is_err()
            {
                return Vec::new();
            }
            let count = (list.count as usize).min(list.ids.len());
            list.ids[..count]
                .iter()
                .map(|pid| *pid as u32)
                .filter(|pid| *pid != 0)
                .collect()
        }
    }

    fn pid_of(hwnd: HWND) -> u32 {
        unsafe {
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            pid
        }
    }

    fn shell_hwnd() -> HWND {
        RUNTIME
            .lock()
            .ok()
            .and_then(|guard| guard.as_ref().map(|runtime| bits_hwnd(runtime.shell_bits)))
            .unwrap_or(HWND(std::ptr::null_mut()))
    }

    fn cloaked(hwnd: HWND) -> bool {
        unsafe {
            let mut value = 0u32;
            if DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut value as *mut _ as *mut _,
                std::mem::size_of::<u32>() as u32,
            )
            .is_err()
            {
                return false;
            }
            value != 0
        }
    }


    fn window_size(hwnd: HWND) -> (i32, i32) {
        unsafe {
            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_err() {
                return (0, 0);
            }
            ((rect.right - rect.left).max(0), (rect.bottom - rect.top).max(0))
        }
    }

    fn window_title(hwnd: HWND) -> String {
        unsafe {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);
            if len <= 0 {
                return String::new();
            }
            String::from_utf16_lossy(&buf[..len as usize])
        }
    }

    fn class_name(hwnd: HWND) -> String {
        unsafe {
            let mut buf = [0u16; 256];
            let len = GetClassNameW(hwnd, &mut buf);
            if len == 0 {
                return String::new();
            }
            String::from_utf16_lossy(&buf[..len as usize])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{classify_window, skip_window_class, CaptureClass};

    #[test]
    fn app_windows_are_frames() {
        assert_eq!(classify_window("Chrome_WidgetWin_1", 1200, 800), CaptureClass::Frame);
        assert_eq!(classify_window("Notepad", 640, 480), CaptureClass::Frame);
    }

    #[test]
    fn menus_are_clamped_without_a_frame() {
        assert_eq!(classify_window("Chrome_WidgetWin_1", 180, 320), CaptureClass::Transient);
        assert!(skip_window_class("tooltips_class32"));
        assert_eq!(classify_window("tooltips_class32", 40, 20), CaptureClass::Ignore);
    }
}
