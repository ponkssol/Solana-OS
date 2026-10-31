//! Keeps apps launched on the interactive desktop inside the Solana OS shell.
//!
//! `WS_EX_NOREDIRECTIONBITMAP` windows (Chrome, Electron) paint blank if they are
//! reparented, so those stay owned top-level windows clamped to the shell frame.
//! Other top-level windows become children of a host HWND under the shell.
//! Small popups are clamped in place and do not get their own shell frame.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

pub const EX_NOREDIRECTIONBITMAP: u32 = 0x0020_0000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureClass {
    Ignore,
    Transient,
    OwnedFrame,
    Embed,
}

pub fn classify_window(class_name: &str, ex_style: u32, width: i32, height: i32) -> CaptureClass {
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
    if ex_style & EX_NOREDIRECTIONBITMAP != 0 {
        CaptureClass::OwnedFrame
    } else {
        CaptureClass::Embed
    }
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
            | "solanaos_host"
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
    embedded: bool,
    app_name: String,
    room_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSlot {
    pub hwnd: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub visible: bool,
    pub raise: bool,
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
pub fn containment_set_slot(slot: HostSlot) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::post(win::Command::Slot(slot));
    }
    #[cfg(not(windows))]
    {
        let _ = slot;
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
    use super::{classify_window, ContainmentEvent, HostSlot, CaptureClass};
    use std::collections::{HashMap, VecDeque};
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::{mpsc, LazyLock, Mutex, OnceLock};
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Emitter, Manager};

    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{
        CloseHandle, BOOL, HINSTANCE, HMODULE, HWND, LPARAM, LRESULT, RECT, WPARAM,
    };
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, GetStockObject, BLACK_BRUSH, HBRUSH, HRGN, RGN_DIFF,
        ClientToScreen, ScreenToClient, SetWindowRgn,
    };
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentThreadId, GetExitCodeProcess, OpenProcess,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, EnumWindows, GetAncestor,
        GetClassNameW, GetClientRect, GetForegroundWindow, GetParent, GetWindow, GetWindowLongPtrW,
        GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsWindow, IsWindowVisible,
        MoveWindow, MsgWaitForMultipleObjects, PeekMessageW, PostMessageW, PostThreadMessageW,
        RegisterClassW, SetForegroundWindow, SetParent, SetWindowLongPtrW, SetWindowPos, ShowWindow,
        TranslateMessage, EVENT_OBJECT_CREATE, EVENT_OBJECT_DESTROY, EVENT_OBJECT_HIDE,
        EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_SHOW, GA_ROOT, GET_WINDOW_CMD,
        GWL_EXSTYLE, GWL_STYLE, GWLP_HWNDPARENT, GW_CHILD, GW_HWNDNEXT, GW_HWNDPREV, HMENU,
        HWND_NOTOPMOST, HWND_TOP, HWND_TOPMOST, MSG, PM_NOREMOVE, PM_REMOVE, QS_ALLINPUT,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, SW_HIDE,
        SW_SHOWNA, WINDOW_EX_STYLE, WINDOW_STYLE, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
        WNDCLASSW, WM_CLOSE, WM_DESTROY, WM_QUIT, WM_SIZE, WS_BORDER, WS_CAPTION, WS_CHILD,
        WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_DLGFRAME, WS_EX_APPWINDOW, WS_EX_DLGMODALFRAME,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_WINDOWEDGE, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP,
        WS_SYSMENU, WS_THICKFRAME,
    };

    const EVENT_OBJECT_UNCLOAKED: u32 = 0x8018;
    const STILL_ACTIVE: u32 = 259;
    static HOOK_THREAD: AtomicU32 = AtomicU32::new(0);
    static CLASS_READY: AtomicBool = AtomicBool::new(false);

    struct JobRec {
        handle_bits: isize,
        root_pid: u32,
        app_name: String,
        room_id: String,
        saw_frame: bool,
        exited: bool,
    }

    #[derive(Clone, Copy, PartialEq, Eq)]
    enum Kind {
        Embed,
        Owned,
        Transient,
    }

    struct Slot {
        x: i32,
        y: i32,
        width: i32,
        height: i32,
        visible: bool,
        raise: bool,
    }

    struct WinRec {
        instance_id: String,
        kind: Kind,
        host_bits: isize,
        title: String,
        announced: bool,
        slot: Option<Slot>,
    }

    struct Runtime {
        shell_bits: isize,
        app: AppHandle,
        windows: HashMap<isize, WinRec>,
        commands: VecDeque<Command>,
        region_sig: String,
    }

    struct PidCache {
        at: Option<Instant>,
        map: HashMap<u32, String>,
    }

    pub enum Command {
        Slot(HostSlot),
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
                region_sig: String::new(),
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
        }
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
            sweep();
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
        consider(hwnd, event);
    }

    unsafe extern "system" fn host_wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_SIZE {
            let width = (lparam.0 & 0xffff) as i32;
            let height = ((lparam.0 >> 16) & 0xffff) as i32;
            if let Some(child) = child_of_host(hwnd_bits(hwnd)) {
                let _ = MoveWindow(bits_hwnd(child), 0, 0, width.max(1), height.max(1), true);
            }
            return LRESULT(0);
        }
        if msg == WM_DESTROY {
            return LRESULT(0);
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    fn child_of_host(host_bits: isize) -> Option<isize> {
        let guard = RUNTIME.lock().ok()?;
        let runtime = guard.as_ref()?;
        runtime.windows.iter().find_map(|(bits, win)| {
            if win.host_bits == host_bits {
                Some(*bits)
            } else {
                None
            }
        })
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
            let kind = kind_of(bits);
            if kind == Some(Kind::Transient) {
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
            let (width, height) = window_size(hwnd);
            let ex = ex_style(hwnd);
            let class_name = class_name(hwnd);
            let next = classify_window(&class_name, ex, width, height);
            let kind = kind_of(bits);
            if kind == Some(Kind::Transient) && matches!(next, CaptureClass::Embed | CaptureClass::OwnedFrame)
            {
                promote(bits, hwnd, next);
            } else if kind == Some(Kind::Embed) && next == CaptureClass::OwnedFrame {
                convert_to_owned(bits, hwnd);
            }
        }
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
            if cloaked(hwnd) {
                return false;
            }
            true
        }
    }

    fn capture(hwnd: HWND, instance_id: &str) {
        let (width, height) = window_size(hwnd);
        let class_name = class_name(hwnd);
        let ex = ex_style(hwnd);
        let class = classify_window(&class_name, ex, width, height);
        if class == CaptureClass::Ignore {
            return;
        }
        let shell = shell_hwnd();
        if shell.0.is_null() {
            return;
        }
        strip_taskbar(hwnd, shell);
        let title = window_title(hwnd);
        match class {
            CaptureClass::Transient => {
                remember(
                    hwnd,
                    instance_id,
                    Kind::Transient,
                    0,
                    title,
                    false,
                );
                clamp_transient(hwnd, shell);
                unsafe {
                    let _ = ShowWindow(hwnd, SW_SHOWNA);
                }
            }
            CaptureClass::OwnedFrame => {
                unsafe {
                    let _ = ShowWindow(hwnd, SW_HIDE);
                }
                let primary = mark_frame(instance_id);
                remember(hwnd, instance_id, Kind::Owned, 0, title.clone(), true);
                emit_window(instance_id, hwnd_bits(hwnd), &title, primary, false, "appeared");
            }
            CaptureClass::Embed => {
                unsafe {
                    let _ = ShowWindow(hwnd, SW_HIDE);
                }
                let host = create_host(shell, 0, 0, 1, 1);
                if let Some(host) = host {
                    if reparent_into(hwnd, host) {
                        let primary = mark_frame(instance_id);
                        remember(
                            hwnd,
                            instance_id,
                            Kind::Embed,
                            hwnd_bits(host),
                            title.clone(),
                            true,
                        );
                        emit_window(instance_id, hwnd_bits(hwnd), &title, primary, true, "appeared");
                        return;
                    }
                    unsafe {
                        let _ = DestroyWindow(host);
                    }
                }
                let primary = mark_frame(instance_id);
                remember(hwnd, instance_id, Kind::Owned, 0, title.clone(), true);
                emit_window(instance_id, hwnd_bits(hwnd), &title, primary, false, "appeared");
            }
            CaptureClass::Ignore => {}
        }
    }

    fn promote(bits: isize, hwnd: HWND, class: CaptureClass) {
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
        let _ = class;
        capture(hwnd, &instance_id);
    }

    fn convert_to_owned(bits: isize, hwnd: HWND) {
        let host_bits = {
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
            win.kind = Kind::Owned;
            let host = win.host_bits;
            win.host_bits = 0;
            host
        };
        let shell = shell_hwnd();
        unsafe {
            let _ = SetParent(hwnd, None);
            let style = WINDOW_STYLE(GetWindowLongPtrW(hwnd, GWL_STYLE) as u32);
            let next = (style & !WS_CHILD) | WS_POPUP | WS_CLIPSIBLINGS;
            SetWindowLongPtrW(hwnd, GWL_STYLE, next.0 as isize);
        }
        strip_taskbar(hwnd, shell);
        if host_bits != 0 {
            unsafe {
                let _ = DestroyWindow(bits_hwnd(host_bits));
            }
        }
        emit_for(bits, "appeared", &window_title(hwnd));
    }

    fn remember(
        hwnd: HWND,
        instance_id: &str,
        kind: Kind,
        host_bits: isize,
        title: String,
        announced: bool,
    ) {
        let mut guard = RUNTIME.lock().unwrap_or_else(|err| err.into_inner());
        let Some(runtime) = guard.as_mut() else {
            return;
        };
        runtime.windows.insert(
            hwnd_bits(hwnd),
            WinRec {
                instance_id: instance_id.to_string(),
                kind,
                host_bits,
                title,
                announced,
                slot: None,
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
        if win.host_bits != 0 {
            unsafe {
                let _ = DestroyWindow(bits_hwnd(win.host_bits));
            }
        }
        if announce && win.announced {
            emit_window(
                &win.instance_id,
                bits,
                &win.title,
                false,
                win.kind == Kind::Embed,
                "destroyed",
            );
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
            (
                win.instance_id.clone(),
                win.kind == Kind::Embed,
                runtime.app.clone(),
            )
        };
        emit_with(&snapshot.2, &snapshot.0, bits, title, false, snapshot.1, kind);
    }

    fn emit_window(instance_id: &str, bits: isize, title: &str, primary: bool, embedded: bool, kind: &str) {
        let app = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            guard.as_ref().map(|runtime| runtime.app.clone())
        };
        if let Some(app) = app {
            emit_with(&app, instance_id, bits, title, primary, embedded, kind);
        }
    }

    fn emit_with(
        app: &AppHandle,
        instance_id: &str,
        bits: isize,
        title: &str,
        primary: bool,
        embedded: bool,
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
                embedded,
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
                Command::Slot(slot) => apply_slot(slot),
                Command::Focus(hwnd) => focus_hwnd(&hwnd),
                Command::Close(hwnd) => close_hwnd(&hwnd),
                Command::Release(id) => drop_instance(&id),
                Command::Raise => raise_owned(),
            }
        }
    }

    fn apply_slot(slot: HostSlot) {
        let Ok(bits) = slot.hwnd.parse::<isize>() else {
            return;
        };
        let (kind, host_bits) = {
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
            win.slot = Some(Slot {
                x: slot.x,
                y: slot.y,
                width: slot.width,
                height: slot.height,
                visible: slot.visible,
                raise: slot.raise,
            });
            (win.kind, win.host_bits)
        };
        let shell = shell_hwnd();
        match kind {
            Kind::Embed => place_embed(bits_hwnd(host_bits), bits_hwnd(bits), &slot),
            Kind::Owned => place_owned(bits_hwnd(bits), shell, &slot),
            Kind::Transient => {}
        }
        sync_region();
        if slot.raise {
            raise_owned();
        }
    }

    fn place_embed(host: HWND, child: HWND, slot: &HostSlot) {
        if host.0.is_null() {
            return;
        }
        unsafe {
            let flags = SWP_NOZORDER | SWP_NOACTIVATE;
            let _ = SetWindowPos(
                host,
                HWND_TOP,
                slot.x,
                slot.y,
                slot.width.max(1),
                slot.height.max(1),
                flags,
            );
            let _ = MoveWindow(child, 0, 0, slot.width.max(1), slot.height.max(1), true);
            let _ = ShowWindow(host, if slot.visible { SW_SHOWNA } else { SW_HIDE });
            let _ = ShowWindow(child, if slot.visible { SW_SHOWNA } else { SW_HIDE });
            if slot.visible {
                let _ = SetWindowPos(
                    host,
                    HWND_TOP,
                    slot.x,
                    slot.y,
                    slot.width.max(1),
                    slot.height.max(1),
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
        }
    }

    fn place_owned(hwnd: HWND, shell: HWND, slot: &HostSlot) {
        let Some((x, y)) = client_to_screen(shell, slot.x, slot.y) else {
            return;
        };
        let insert = z_insert();
        unsafe {
            let _ = SetWindowPos(
                hwnd,
                insert,
                x,
                y,
                slot.width.max(1),
                slot.height.max(1),
                SWP_NOACTIVATE,
            );
            let _ = ShowWindow(hwnd, if slot.visible { SW_SHOWNA } else { SW_HIDE });
        }
    }

    fn focus_hwnd(raw: &str) {
        let Ok(bits) = raw.parse::<isize>() else {
            return;
        };
        let hwnd = bits_hwnd(bits);
        let shell = shell_hwnd();
        unsafe {
            if !IsWindow(hwnd).as_bool() {
                return;
            }
            let foreground = GetForegroundWindow();
            let foreground_thread = GetWindowThreadProcessId(foreground, None);
            let target_thread = GetWindowThreadProcessId(hwnd, None);
            let current = GetCurrentThreadId();
            if foreground_thread != 0 && foreground_thread != current {
                let _ = AttachThreadInput(foreground_thread, current, true);
            }
            if target_thread != 0 && target_thread != current {
                let _ = AttachThreadInput(target_thread, current, true);
            }
            let _ = SetForegroundWindow(shell);
            let _ = SetForegroundWindow(hwnd);
            if target_thread != 0 && target_thread != current {
                let _ = AttachThreadInput(target_thread, current, false);
            }
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
        emit_window(instance_id, 0, "", false, false, "exited");
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
        sync_region();
    }

    fn reassert() {
        let snapshot: Vec<(isize, Kind, isize)> = {
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
                .map(|(bits, win)| (*bits, win.kind, win.host_bits))
                .collect()
        };
        let shell = shell_hwnd();
        for (bits, kind, host_bits) in snapshot {
            let hwnd = bits_hwnd(bits);
            unsafe {
                if !IsWindow(hwnd).as_bool() {
                    forget(bits, true);
                    continue;
                }
            }
            match kind {
                Kind::Embed => {
                    if host_bits != 0 && !parent_is(hwnd, bits_hwnd(host_bits)) && !reparent_into(hwnd, bits_hwnd(host_bits))
                    {
                        convert_to_owned(bits, hwnd);
                    }
                }
                Kind::Owned => {
                    if let Some(slot) = slot_of(bits) {
                        place_owned(hwnd, shell, &HostSlot {
                            hwnd: bits.to_string(),
                            x: slot.x,
                            y: slot.y,
                            width: slot.width,
                            height: slot.height,
                            visible: slot.visible,
                            raise: slot.raise,
                        });
                    }
                }
                Kind::Transient => clamp_transient(hwnd, shell),
            }
        }
        raise_owned();
    }

    fn slot_of(bits: isize) -> Option<Slot> {
        let guard = RUNTIME.lock().ok()?;
        let runtime = guard.as_ref()?;
        let win = runtime.windows.get(&bits)?;
        win.slot.as_ref().map(|slot| Slot {
            x: slot.x,
            y: slot.y,
            width: slot.width,
            height: slot.height,
            visible: slot.visible,
            raise: slot.raise,
        })
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
        let owned: Vec<(isize, bool)> = {
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
                .filter(|(_, win)| win.kind == Kind::Owned)
                .filter(|(_, win)| win.slot.as_ref().map(|slot| slot.visible).unwrap_or(false))
                .map(|(bits, win)| (*bits, win.slot.as_ref().map(|slot| slot.raise).unwrap_or(false)))
                .collect()
        };
        let insert = z_insert();
        for (bits, _) in owned {
            let hwnd = bits_hwnd(bits);
            if !is_above(hwnd, shell) || insert == HWND_NOTOPMOST {
                unsafe {
                    let _ = SetWindowPos(hwnd, insert, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
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
        while !cursor.0.is_null() && guard < 64 {
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

    fn sync_region() {
        let shell = shell_hwnd();
        let Some(webview) = webview_hwnd(shell) else {
            return;
        };
        let mut holes = Vec::new();
        let signature = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            let Some(runtime) = guard.as_ref() else {
                return;
            };
            let mut parts = Vec::new();
            for win in runtime.windows.values() {
                if win.kind != Kind::Embed {
                    continue;
                }
                let Some(slot) = &win.slot else {
                    continue;
                };
                if !slot.visible || slot.width < 2 || slot.height < 2 {
                    continue;
                }
                parts.push(format!("{},{},{},{}", slot.x, slot.y, slot.width, slot.height));
                holes.push((slot.x, slot.y, slot.width, slot.height));
            }
            let mut size = RECT::default();
            unsafe {
                let _ = GetClientRect(webview, &mut size);
            }
            format!("{}x{}|{}", size.right, size.bottom, parts.join(";"))
        };
        let unchanged = {
            let guard = match RUNTIME.lock() {
                Ok(guard) => guard,
                Err(err) => err.into_inner(),
            };
            guard
                .as_ref()
                .map(|runtime| runtime.region_sig == signature)
                .unwrap_or(false)
        };
        if unchanged {
            return;
        }
        unsafe {
            clip_siblings(webview);
            let mut client = RECT::default();
            if GetClientRect(webview, &mut client).is_err() {
                return;
            }
            if holes.is_empty() {
                let _ = SetWindowRgn(webview, HRGN(std::ptr::null_mut()), true);
            } else {
                let region = CreateRectRgn(0, 0, client.right.max(1), client.bottom.max(1));
                for (x, y, width, height) in holes {
                    let Some((sx, sy)) = client_to_screen(shell, x, y) else {
                        continue;
                    };
                    let mut origin = windows::Win32::Foundation::POINT { x: sx, y: sy };
                    let _ = ScreenToClient(webview, &mut origin);
                    let hole = CreateRectRgn(origin.x, origin.y, origin.x + width, origin.y + height);
                    let _ = CombineRgn(region, region, hole, RGN_DIFF);
                    let _ = DeleteObject(hole);
                }
                if SetWindowRgn(webview, region, true) == 0 {
                    let _ = DeleteObject(region);
                }
            }
        }
        if let Ok(mut guard) = RUNTIME.lock() {
            if let Some(runtime) = guard.as_mut() {
                runtime.region_sig = signature;
            }
        }
    }

    fn parent_is(hwnd: HWND, expected: HWND) -> bool {
        unsafe {
            match GetParent(hwnd) {
                Ok(parent) => parent == expected,
                Err(_) => false,
            }
        }
    }

    fn clip_siblings(hwnd: HWND) {
        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            if style & WS_CLIPSIBLINGS.0 != 0 {
                return;
            }
            SetWindowLongPtrW(hwnd, GWL_STYLE, (style | WS_CLIPSIBLINGS.0) as isize);
        }
    }

    fn webview_hwnd(shell: HWND) -> Option<HWND> {
        if shell.0.is_null() {
            return None;
        }
        let mut best: Option<(HWND, i64)> = None;
        let mut child = window_relative(shell, GW_CHILD);
        let mut guard = 0;
        while !child.0.is_null() && guard < 32 {
            let name = class_name(child);
            if name != "SolanaOS_Host" {
                let (width, height) = window_size(child);
                let area = width as i64 * height as i64;
                if best.map(|(_, best_area)| area > best_area).unwrap_or(true) {
                    best = Some((child, area));
                }
            }
            child = window_relative(child, GW_HWNDNEXT);
            guard += 1;
        }
        best.map(|(hwnd, _)| hwnd)
    }

    fn clamp_transient(hwnd: HWND, shell: HWND) {
        unsafe {
            let mut window_rect = RECT::default();
            let mut client = RECT::default();
            if GetWindowRect(hwnd, &mut window_rect).is_err() || GetClientRect(shell, &mut client).is_err()
            {
                return;
            }
            let Some((left, top)) = client_to_screen(shell, 0, 0) else {
                return;
            };
            let right = left + client.right;
            let bottom = top + client.bottom;
            let mut width = (window_rect.right - window_rect.left).max(1);
            let mut height = (window_rect.bottom - window_rect.top).max(1);
            width = width.min((right - left).max(1));
            height = height.min((bottom - top).max(1));
            let mut x = window_rect.left;
            let mut y = window_rect.top;
            if x < left {
                x = left;
            }
            if y < top {
                y = top;
            }
            if x + width > right {
                x = (right - width).max(left);
            }
            if y + height > bottom {
                y = (bottom - height).max(top);
            }
            if (x - window_rect.left).abs() < 2
                && (y - window_rect.top).abs() < 2
                && (width - (window_rect.right - window_rect.left)).abs() < 2
                && (height - (window_rect.bottom - window_rect.top)).abs() < 2
            {
                return;
            }
            let _ = SetWindowPos(hwnd, z_insert(), x, y, width, height, SWP_NOACTIVATE);
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

    fn create_host(parent: HWND, x: i32, y: i32, width: i32, height: i32) -> Option<HWND> {
        ensure_class()?;
        unsafe {
            let module = GetModuleHandleW(PCWSTR::null()).ok()?;
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                host_class(),
                PCWSTR::null(),
                WS_CHILD | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
                x,
                y,
                width.max(1),
                height.max(1),
                parent,
                HMENU(std::ptr::null_mut()),
                HINSTANCE(module.0),
                None,
            )
            .ok()
        }
    }

    fn ensure_class() -> Option<()> {
        if CLASS_READY.load(Ordering::SeqCst) {
            return Some(());
        }
        unsafe {
            let module = GetModuleHandleW(PCWSTR::null()).ok()?;
            let class = WNDCLASSW {
                lpfnWndProc: Some(host_wnd_proc),
                hInstance: HINSTANCE(module.0),
                lpszClassName: host_class(),
                hbrBackground: HBRUSH(GetStockObject(BLACK_BRUSH).0),
                ..Default::default()
            };
            if RegisterClassW(&class) == 0 {
                return None;
            }
        }
        CLASS_READY.store(true, Ordering::SeqCst);
        Some(())
    }

    fn host_class() -> PCWSTR {
        static NAME: OnceLock<Vec<u16>> = OnceLock::new();
        let name = NAME.get_or_init(|| wide("SolanaOS_Host"));
        PCWSTR(name.as_ptr())
    }

    fn reparent_into(hwnd: HWND, host: HWND) -> bool {
        unsafe {
            let style = WINDOW_STYLE(GetWindowLongPtrW(hwnd, GWL_STYLE) as u32);
            let cleared = style
                & !(WS_POPUP
                    | WS_CAPTION
                    | WS_THICKFRAME
                    | WS_BORDER
                    | WS_DLGFRAME
                    | WS_SYSMENU
                    | WS_MINIMIZEBOX
                    | WS_MAXIMIZEBOX);
            let next = cleared | WS_CHILD | WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
            SetWindowLongPtrW(hwnd, GWL_STYLE, next.0 as isize);
            let ex = WINDOW_EX_STYLE(GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32);
            let ex = (ex & !(WS_EX_APPWINDOW | WS_EX_DLGMODALFRAME | WS_EX_WINDOWEDGE | WS_EX_TOPMOST))
                | WS_EX_TOOLWINDOW;
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex.0 as isize);
            if SetParent(hwnd, host).is_err() {
                return false;
            }
            let _ = SetWindowPos(
                hwnd,
                HWND_TOP,
                0,
                0,
                1,
                1,
                SWP_FRAMECHANGED | SWP_NOACTIVATE,
            );
            true
        }
    }

    fn strip_taskbar(hwnd: HWND, owner: HWND) {
        unsafe {
            let ex = WINDOW_EX_STYLE(GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32);
            let ex = (ex & !WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex.0 as isize);
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            if style & WS_CHILD.0 == 0 && !owner.0.is_null() {
                SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, owner.0 as isize);
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

    fn ex_style(hwnd: HWND) -> u32 {
        unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 }
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
    use super::{classify_window, skip_window_class, CaptureClass, EX_NOREDIRECTIONBITMAP};

    #[test]
    fn direct_composition_windows_stay_owned() {
        assert_eq!(
            classify_window("Chrome_WidgetWin_1", EX_NOREDIRECTIONBITMAP, 1200, 800),
            CaptureClass::OwnedFrame
        );
        assert_eq!(
            classify_window("Chrome_WidgetWin_1", 0, 1200, 800),
            CaptureClass::Embed
        );
    }

    #[test]
    fn menus_are_clamped_without_a_frame() {
        assert_eq!(classify_window("Chrome_WidgetWin_1", 0, 180, 320), CaptureClass::Transient);
        assert!(skip_window_class("tooltips_class32"));
        assert_eq!(
            classify_window("tooltips_class32", 0, 40, 20),
            CaptureClass::Ignore
        );
        assert_eq!(classify_window("SolanaOS_Host", 0, 400, 300), CaptureClass::Ignore);
    }
}
