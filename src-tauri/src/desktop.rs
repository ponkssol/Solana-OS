use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::path::Path;

use crate::cloner::now_epoch_ms;

pub const DEFAULT_WINDOWS_DESKTOP: &str = "Default";
pub const SOLANA_OS_ENCLAVE_DESKTOP: &str = "SolanaOS_Enclave_Desktop";
pub const EMERGENCY_PANIC_HOTKEY: &str = "Ctrl+Alt+Shift+Backspace";

/// Target desktop for 1-click Virtual Desktop switching.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopTarget {
    WindowsDefault,
    SolanaOsEnclave,
}

impl DesktopTarget {
    pub fn from_input(raw: &str) -> Result<Self, String> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "default" | "windows" | "windows_default" | "windowsdefault" | "host" => {
                Ok(Self::WindowsDefault)
            }
            "solanaos_enclave_desktop"
            | "solana_os_enclave"
            | "solanaosenclave"
            | "enclave"
            | "solana"
            | "solos" => Ok(Self::SolanaOsEnclave),
            other => Err(format!(
                "Unknown virtual desktop target '{}'. Expected 'Default' or 'SolanaOS_Enclave_Desktop'",
                other
            )),
        }
    }

    pub fn desktop_name(&self) -> &'static str {
        match self {
            Self::WindowsDefault => DEFAULT_WINDOWS_DESKTOP,
            Self::SolanaOsEnclave => SOLANA_OS_ENCLAVE_DESKTOP,
        }
    }
}

/// Telemetry & status snapshot of the Win32 Virtual Desktop Switcher.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualDesktopStatus {
    pub active_desktop: String,
    pub enclave_desktop_created: bool,
    pub is_enclave_active: bool,
    pub station_name: String,
    pub emergency_hotkey: String,
    pub switch_count: u64,
    pub last_switch_ms: u64,
    pub platform_backend: String,
}

/// Manages the isolated `"SolanaOS_Enclave_Desktop"` and 1-click switching back and forth with `"Default"`.
pub struct VirtualDesktopManager {
    active_target: DesktopTarget,
    enclave_created: bool,
    switch_count: u64,
    last_switch_ms: u64,
}

impl Default for VirtualDesktopManager {
    fn default() -> Self {
        Self::new()
    }
}

impl VirtualDesktopManager {
    pub fn new() -> Self {
        Self {
            active_target: DesktopTarget::WindowsDefault,
            enclave_created: false,
            switch_count: 0,
            last_switch_ms: now_epoch_ms(),
        }
    }

    pub fn get_status(&self) -> VirtualDesktopStatus {
        let active_name = self.active_target.desktop_name().to_string();
        VirtualDesktopStatus {
            active_desktop: active_name,
            enclave_desktop_created: self.enclave_created,
            is_enclave_active: self.active_target == DesktopTarget::SolanaOsEnclave,
            station_name: "WinSta0".to_string(),
            emergency_hotkey: EMERGENCY_PANIC_HOTKEY.to_string(),
            switch_count: self.switch_count,
            last_switch_ms: self.last_switch_ms,
            platform_backend: if cfg!(target_os = "windows") {
                "Win32_StationsAndDesktops (CreateDesktopW / SwitchDesktop)".to_string()
            } else {
                "Linux_Sandbox_Desktop_Sim (WinSta0/SolanaOS_Enclave_Desktop)".to_string()
            },
        }
    }

    /// Ensures the isolated `"SolanaOS_Enclave_Desktop"` exists on `WinSta0`.
    pub fn ensure_enclave_desktop(&mut self) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            ensure_enclave_desktop_win32()?;
        }
        self.enclave_created = true;
        Ok(())
    }

    /// Switches between `"Default"` and `"SolanaOS_Enclave_Desktop"` in 1 click.
    pub fn switch_desktop(&mut self, target_raw: &str) -> Result<VirtualDesktopStatus, String> {
        let target = DesktopTarget::from_input(target_raw)?;
        if target == DesktopTarget::SolanaOsEnclave && !self.enclave_created {
            self.ensure_enclave_desktop()?;
        }

        #[cfg(target_os = "windows")]
        {
            switch_desktop_win32(target.desktop_name())?;
        }

        self.active_target = target;
        self.switch_count += 1;
        self.last_switch_ms = now_epoch_ms();
        Ok(self.get_status())
    }

    /// Toggles between Windows `"Default"` desktop and `"SolanaOS_Enclave_Desktop"`.
    pub fn toggle_desktop(&mut self) -> Result<VirtualDesktopStatus, String> {
        let next = match self.active_target {
            DesktopTarget::WindowsDefault => DesktopTarget::SolanaOsEnclave,
            DesktopTarget::SolanaOsEnclave => DesktopTarget::WindowsDefault,
        };
        self.switch_desktop(next.desktop_name())
    }

    /// Emergency panic fallback (`Ctrl+Alt+Shift+Backspace`) that unconditionally switches
    /// the display and calling thread back to Windows `"Default"` desktop so the user is never locked out.
    pub fn emergency_panic_fallback(&mut self) -> Result<VirtualDesktopStatus, String> {
        #[cfg(target_os = "windows")]
        {
            emergency_restore_default_desktop_win32()?;
        }
        self.active_target = DesktopTarget::WindowsDefault;
        self.switch_count += 1;
        self.last_switch_ms = now_epoch_ms();
        Ok(self.get_status())
    }
}

#[cfg(target_os = "windows")]
fn to_wide_null(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn desktop_full_access_mask() -> u32 {
    use windows::Win32::System::StationsAndDesktops::{
        DESKTOP_CREATEMENU, DESKTOP_CREATEWINDOW, DESKTOP_ENUMERATE, DESKTOP_HOOKCONTROL,
        DESKTOP_JOURNALPLAYBACK, DESKTOP_JOURNALRECORD, DESKTOP_READOBJECTS, DESKTOP_SWITCHDESKTOP,
        DESKTOP_WRITEOBJECTS,
    };
    (DESKTOP_CREATEMENU.0
        | DESKTOP_CREATEWINDOW.0
        | DESKTOP_ENUMERATE.0
        | DESKTOP_HOOKCONTROL.0
        | DESKTOP_JOURNALPLAYBACK.0
        | DESKTOP_JOURNALRECORD.0
        | DESKTOP_READOBJECTS.0
        | DESKTOP_SWITCHDESKTOP.0
        | DESKTOP_WRITEOBJECTS.0)
}

#[cfg(target_os = "windows")]
fn ensure_enclave_desktop_win32() -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::StationsAndDesktops::{
        CloseDesktop, CreateDesktopW, OpenDesktopW, DF_ALLOWOTHERACCOUNTHOOK,
    };

    unsafe {
        let wide_name = to_wide_null(SOLANA_OS_ENCLAVE_DESKTOP);
        let access = desktop_full_access_mask();

        let hdesk = match OpenDesktopW(PCWSTR(wide_name.as_ptr()), DF_ALLOWOTHERACCOUNTHOOK, false, access) {
            Ok(existing) => existing,
            Err(_) => CreateDesktopW(
                PCWSTR(wide_name.as_ptr()),
                PCWSTR::null(),
                None,
                DF_ALLOWOTHERACCOUNTHOOK,
                access,
                None,
            )
            .map_err(|e| format!("CreateDesktopW('{}') failed: {}", SOLANA_OS_ENCLAVE_DESKTOP, e))?,
        };

        let _ = CloseDesktop(hdesk);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn switch_desktop_win32(desktop_name: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::StationsAndDesktops::{
        CloseDesktop, CreateDesktopW, GetThreadDesktop, OpenDesktopW, SetThreadDesktop,
        SwitchDesktop, DF_ALLOWOTHERACCOUNTHOOK,
    };
    use windows::Win32::System::Threading::GetCurrentThreadId;

    unsafe {
        let wide_name = to_wide_null(desktop_name);
        let access = desktop_full_access_mask();

        let hdesk = match OpenDesktopW(PCWSTR(wide_name.as_ptr()), DF_ALLOWOTHERACCOUNTHOOK, false, access) {
            Ok(h) => h,
            Err(_) if desktop_name == SOLANA_OS_ENCLAVE_DESKTOP => CreateDesktopW(
                PCWSTR(wide_name.as_ptr()),
                PCWSTR::null(),
                None,
                DF_ALLOWOTHERACCOUNTHOOK,
                access,
                None,
            )
            .map_err(|e| format!("CreateDesktopW('{}') failed: {}", desktop_name, e))?,
            Err(e) => {
                return Err(format!("OpenDesktopW('{}') failed: {}", desktop_name, e));
            }
        };

        let _current_thread_desk = GetThreadDesktop(GetCurrentThreadId());
        let switch_res = SwitchDesktop(hdesk);
        if switch_res.is_ok() {
            let _ = SetThreadDesktop(hdesk);
        }
        let _ = CloseDesktop(hdesk);
        switch_res.map_err(|e| format!("SwitchDesktop('{}') failed: {}", desktop_name, e))
    }
}

#[cfg(target_os = "windows")]
fn emergency_restore_default_desktop_win32() -> Result<(), String> {
    switch_desktop_win32(DEFAULT_WINDOWS_DESKTOP)
}

/// Launches a Windows process directly onto `desktop_name` (`"Default"` or `"SolanaOS_Enclave_Desktop"`)
/// using `CreateProcessW` with `STARTUPINFOW.lpDesktop` and an isolated Unicode environment block.
#[cfg(target_os = "windows")]
pub fn launch_process_on_desktop_win32(
    exe_path: &str,
    args: &[String],
    env_overrides: &HashMap<String, String>,
    working_dir: &Path,
    desktop_name: &str,
) -> Result<u32, String> {
    use std::env;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        CreateProcessW, CREATE_NEW_CONSOLE, CREATE_UNICODE_ENVIRONMENT, PROCESS_INFORMATION,
        STARTUPINFOW,
    };

    if desktop_name == SOLANA_OS_ENCLAVE_DESKTOP {
        ensure_enclave_desktop_win32()?;
    }

    // Build command line string: `"exe_path" arg1 arg2 ...`
    let mut cmd_line = format!("\"{}\"", exe_path);
    for arg in args {
        cmd_line.push(' ');
        if arg.contains(' ') && !arg.starts_with('"') {
            cmd_line.push_str(&format!("\"{}\"", arg));
        } else {
            cmd_line.push_str(arg);
        }
    }

    // Merge host environment with isolated room overrides into a double-null-terminated UTF-16 block
    let mut merged_env: HashMap<String, String> = env::vars().collect();
    for (k, v) in env_overrides {
        merged_env.insert(k.clone(), v.clone());
    }

    let mut env_block_u16: Vec<u16> = Vec::new();
    let mut sorted_keys: Vec<&String> = merged_env.keys().collect();
    sorted_keys.sort();
    for key in sorted_keys {
        if let Some(val) = merged_env.get(key) {
            let entry = format!("{}={}", key, val);
            env_block_u16.extend(entry.encode_utf16());
            env_block_u16.push(0);
        }
    }
    env_block_u16.push(0);

    unsafe {
        let mut cmd_wide = to_wide_null(&cmd_line);
        let mut desktop_wide = to_wide_null(desktop_name);
        let work_dir_wide = to_wide_null(&working_dir.to_string_lossy());

        let mut startup_info = STARTUPINFOW::default();
        startup_info.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
        startup_info.lpDesktop = PWSTR(desktop_wide.as_mut_ptr());

        let mut proc_info = PROCESS_INFORMATION::default();

        CreateProcessW(
            PCWSTR::null(),
            PWSTR(cmd_wide.as_mut_ptr()),
            None,
            None,
            false,
            CREATE_UNICODE_ENVIRONMENT | CREATE_NEW_CONSOLE,
            Some(env_block_u16.as_ptr() as *const _),
            PCWSTR(work_dir_wide.as_ptr()),
            &startup_info,
            &mut proc_info,
        )
        .map_err(|e| {
            format!(
                "CreateProcessW failed for '{}' on desktop '{}': {}",
                exe_path, desktop_name, e
            )
        })?;

        let pid = proc_info.dwProcessId;
        let _ = CloseHandle(proc_info.hThread);
        let _ = CloseHandle(proc_info.hProcess);
        Ok(pid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_virtual_desktop_switch_and_panic_fallback() {
        let mut mgr = VirtualDesktopManager::new();
        let initial = mgr.get_status();
        assert_eq!(initial.active_desktop, DEFAULT_WINDOWS_DESKTOP);
        assert!(!initial.is_enclave_active);

        let switched = mgr
            .switch_desktop("SolanaOS_Enclave_Desktop")
            .expect("switch to enclave desktop should succeed");
        assert_eq!(switched.active_desktop, SOLANA_OS_ENCLAVE_DESKTOP);
        assert!(switched.is_enclave_active);
        assert!(switched.enclave_desktop_created);
        assert_eq!(switched.switch_count, 1);

        let toggled = mgr.toggle_desktop().expect("toggle desktop should succeed");
        assert_eq!(toggled.active_desktop, DEFAULT_WINDOWS_DESKTOP);
        assert!(!toggled.is_enclave_active);

        let _ = mgr.switch_desktop("enclave").unwrap();
        let panic_restored = mgr
            .emergency_panic_fallback()
            .expect("panic fallback should always restore Default desktop");
        assert_eq!(panic_restored.active_desktop, DEFAULT_WINDOWS_DESKTOP);
        assert!(!panic_restored.is_enclave_active);
    }
}
