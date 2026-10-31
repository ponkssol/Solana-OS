use serde::{Deserialize, Serialize};

use crate::cloner::{
    build_supported_app_catalog, now_epoch_ms, AppInstanceStatus, UniversalAppCloner,
};

/// Result of freezing or resuming a single cloned app instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FreezeOperationResult {
    pub instance_id: String,
    pub pid: u32,
    pub room_id: String,
    pub previous_status: AppInstanceStatus,
    pub new_status: AppInstanceStatus,
    pub cpu_usage_percent: f32,
    pub method: String,
    pub timestamp_ms: u64,
}

/// Result of freezing or resuming all apps inside a Room in 1 click.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomFreezeBatchResult {
    pub room_id: String,
    pub action: String,
    pub affected_count: usize,
    pub results: Vec<FreezeOperationResult>,
    pub saved_cpu_percent: f32,
}

fn default_cpu_for_app(app_id: &str) -> f32 {
    build_supported_app_catalog()
        .into_iter()
        .find(|s| s.app_id == app_id)
        .map(|s| s.default_cpu_estimate_percent)
        .unwrap_or(2.5)
}

/// Suspends all threads of a target process ID so it consumes 0.0% CPU in the background.
pub fn os_suspend_process(pid: u32) -> Result<String, String> {
    if pid == 0 {
        return Err("Cannot suspend PID 0".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        nt_suspend_or_resume_windows(pid, true)?;
        Ok("NtSuspendProcess (ntdll.dll)".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        unsafe {
            let rc = libc::kill(pid as i32, libc::SIGSTOP);
            if rc != 0 {
                let err = std::io::Error::last_os_error();
                if err.raw_os_error() != Some(libc::ESRCH) {
                    return Err(format!("SIGSTOP failed for PID {}: {}", pid, err));
                }
            }
        }
        Ok("POSIX SIGSTOP (0% CPU Kernel Freeze)".to_string())
    }
}

/// Resumes all threads of a previously suspended process ID.
pub fn os_resume_process(pid: u32) -> Result<String, String> {
    if pid == 0 {
        return Err("Cannot resume PID 0".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        nt_suspend_or_resume_windows(pid, false)?;
        Ok("NtResumeProcess (ntdll.dll)".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        unsafe {
            let rc = libc::kill(pid as i32, libc::SIGCONT);
            if rc != 0 {
                let err = std::io::Error::last_os_error();
                if err.raw_os_error() != Some(libc::ESRCH) {
                    return Err(format!("SIGCONT failed for PID {}: {}", pid, err));
                }
            }
        }
        Ok("POSIX SIGCONT (Kernel Thread Resume)".to_string())
    }
}

/// Freezes a running cloned app instance to 0% CPU.
pub fn freeze_instance(
    cloner: &mut UniversalAppCloner,
    instance_id: &str,
) -> Result<FreezeOperationResult, String> {
    let instance = cloner
        .instances
        .get_mut(instance_id)
        .ok_or_else(|| format!("App instance '{}' not found", instance_id))?;
    crate::diag!("freeze {instance_id} pid={}", instance.pid);

    if instance.status == AppInstanceStatus::Stopped {
        return Err(format!(
            "Cannot freeze stopped app instance '{}'",
            instance_id
        ));
    }

    let previous_status = instance.status;
    let method = os_suspend_process(instance.pid)?;
    instance.status = AppInstanceStatus::Frozen;
    instance.cpu_usage_percent = 0.0;

    Ok(FreezeOperationResult {
        instance_id: instance.instance_id.clone(),
        pid: instance.pid,
        room_id: instance.room_id.clone(),
        previous_status,
        new_status: AppInstanceStatus::Frozen,
        cpu_usage_percent: 0.0,
        method,
        timestamp_ms: now_epoch_ms(),
    })
}

/// Resumes a frozen cloned app instance from 0% CPU back to active execution.
pub fn resume_instance(
    cloner: &mut UniversalAppCloner,
    instance_id: &str,
) -> Result<FreezeOperationResult, String> {
    let instance = cloner
        .instances
        .get_mut(instance_id)
        .ok_or_else(|| format!("App instance '{}' not found", instance_id))?;

    if instance.status == AppInstanceStatus::Stopped {
        return Err(format!(
            "Cannot resume stopped app instance '{}'",
            instance_id
        ));
    }

    let previous_status = instance.status;
    let method = os_resume_process(instance.pid)?;
    let restored_cpu = default_cpu_for_app(&instance.app_id);
    instance.status = AppInstanceStatus::Running;
    instance.cpu_usage_percent = restored_cpu;

    Ok(FreezeOperationResult {
        instance_id: instance.instance_id.clone(),
        pid: instance.pid,
        room_id: instance.room_id.clone(),
        previous_status,
        new_status: AppInstanceStatus::Running,
        cpu_usage_percent: restored_cpu,
        method,
        timestamp_ms: now_epoch_ms(),
    })
}

/// Toggles an instance between `Running` and `Frozen` (❄️ 0% CPU).
pub fn toggle_freeze_instance(
    cloner: &mut UniversalAppCloner,
    instance_id: &str,
) -> Result<FreezeOperationResult, String> {
    let current_status = cloner
        .instances
        .get(instance_id)
        .map(|i| i.status)
        .ok_or_else(|| format!("App instance '{}' not found", instance_id))?;

    match current_status {
        AppInstanceStatus::Running => freeze_instance(cloner, instance_id),
        AppInstanceStatus::Frozen => resume_instance(cloner, instance_id),
        AppInstanceStatus::Stopped => Err(format!(
            "Cannot toggle freeze on stopped app instance '{}'",
            instance_id
        )),
    }
}

/// Freezes all `Running` app instances in a Room to 0% CPU in 1 click.
pub fn freeze_room_instances(
    cloner: &mut UniversalAppCloner,
    room_id: &str,
) -> Result<RoomFreezeBatchResult, String> {
    let target_room = room_id.trim();
    let candidate_ids: Vec<(String, f32)> = cloner
        .instances
        .values()
        .filter(|i| {
            i.room_id.eq_ignore_ascii_case(target_room) && i.status == AppInstanceStatus::Running
        })
        .map(|i| (i.instance_id.clone(), i.cpu_usage_percent))
        .collect();

    let mut results = Vec::new();
    let mut saved_cpu = 0.0_f32;

    for (id, prior_cpu) in candidate_ids {
        let res = freeze_instance(cloner, &id)?;
        saved_cpu += prior_cpu;
        results.push(res);
    }

    Ok(RoomFreezeBatchResult {
        room_id: target_room.to_string(),
        action: "freeze".to_string(),
        affected_count: results.len(),
        results,
        saved_cpu_percent: (saved_cpu * 10.0).round() / 10.0,
    })
}

/// Resumes all `Frozen` app instances in a Room in 1 click.
pub fn resume_room_instances(
    cloner: &mut UniversalAppCloner,
    room_id: &str,
) -> Result<RoomFreezeBatchResult, String> {
    let target_room = room_id.trim();
    let candidate_ids: Vec<String> = cloner
        .instances
        .values()
        .filter(|i| {
            i.room_id.eq_ignore_ascii_case(target_room) && i.status == AppInstanceStatus::Frozen
        })
        .map(|i| i.instance_id.clone())
        .collect();

    let mut results = Vec::new();
    for id in candidate_ids {
        let res = resume_instance(cloner, &id)?;
        results.push(res);
    }

    Ok(RoomFreezeBatchResult {
        room_id: target_room.to_string(),
        action: "resume".to_string(),
        affected_count: results.len(),
        results,
        saved_cpu_percent: 0.0,
    })
}

/// Dynamically resolves `NtSuspendProcess` or `NtResumeProcess` from `ntdll.dll` and invokes it
/// on the target process handle opened with `PROCESS_SUSPEND_RESUME`.
#[cfg(target_os = "windows")]
fn nt_suspend_or_resume_windows(pid: u32, suspend: bool) -> Result<(), String> {
    use windows::core::{PCSTR, PCWSTR};
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_SUSPEND_RESUME};

    type NtProcessStateFn = unsafe extern "system" fn(HANDLE) -> i32;

    unsafe {
        let ntdll_wide: Vec<u16> = "ntdll.dll\0".encode_utf16().collect();
        let ntdll_module = GetModuleHandleW(PCWSTR(ntdll_wide.as_ptr()))
            .map_err(|e| format!("GetModuleHandleW(ntdll.dll) failed: {}", e))?;

        let proc_name: &[u8] = if suspend {
            b"NtSuspendProcess\0"
        } else {
            b"NtResumeProcess\0"
        };

        let farproc = GetProcAddress(ntdll_module, PCSTR(proc_name.as_ptr())).ok_or_else(|| {
            format!(
                "GetProcAddress failed for {}",
                if suspend {
                    "NtSuspendProcess"
                } else {
                    "NtResumeProcess"
                }
            )
        })?;

        let nt_fn: NtProcessStateFn = std::mem::transmute(farproc);

        let proc_handle = OpenProcess(PROCESS_SUSPEND_RESUME, false, pid).map_err(|e| {
            format!(
                "OpenProcess(PROCESS_SUSPEND_RESUME) failed for PID {}: {}",
                pid, e
            )
        })?;

        let ntstatus = nt_fn(proc_handle);
        let _ = CloseHandle(proc_handle);

        if ntstatus < 0 {
            return Err(format!(
                "{} returned NTSTATUS 0x{:08X} for PID {}",
                if suspend {
                    "NtSuspendProcess"
                } else {
                    "NtResumeProcess"
                },
                ntstatus as u32,
                pid
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloner::CloneLaunchRequest;
    use std::env;
    use std::fs;

    #[test]
    fn test_freeze_and_resume_single_and_room_batch() {
        let temp_base = env::temp_dir().join(format!("solos-test-freezer-{}", now_epoch_ms()));
        let mut cloner = UniversalAppCloner::new(temp_base.clone());

        let inst1 = cloner
            .clone_and_launch(CloneLaunchRequest {
                app_id: "brave".to_string(),
                room_id: "degen".to_string(),
                custom_exe_path: None,
                extra_args: None,
                launch_on_enclave_desktop: Some(false),
                instance_label: Some("Sniper Tab".to_string()),
            })
            .unwrap();

        let inst2 = cloner
            .clone_and_launch(CloneLaunchRequest {
                app_id: "telegram".to_string(),
                room_id: "degen".to_string(),
                custom_exe_path: None,
                extra_args: None,
                launch_on_enclave_desktop: Some(false),
                instance_label: Some("Alpha Calls".to_string()),
            })
            .unwrap();

        assert!(inst1.cpu_usage_percent > 0.0);
        assert!(inst2.cpu_usage_percent > 0.0);

        // Freeze single instance
        let frozen_one = freeze_instance(&mut cloner, &inst1.instance_id).unwrap();
        assert_eq!(frozen_one.new_status, AppInstanceStatus::Frozen);
        assert_eq!(frozen_one.cpu_usage_percent, 0.0);

        // Toggle back to Running
        let toggled_back = toggle_freeze_instance(&mut cloner, &inst1.instance_id).unwrap();
        assert_eq!(toggled_back.new_status, AppInstanceStatus::Running);
        assert!(toggled_back.cpu_usage_percent > 0.0);

        // Freeze entire room in 1 click
        let batch_freeze = freeze_room_instances(&mut cloner, "degen").unwrap();
        assert_eq!(batch_freeze.affected_count, 2);
        assert!(batch_freeze.saved_cpu_percent > 0.0);

        for inst in cloner.list_instances(Some("degen")) {
            assert_eq!(inst.status, AppInstanceStatus::Frozen);
            assert_eq!(inst.cpu_usage_percent, 0.0);
        }

        // Resume entire room in 1 click
        let batch_resume = resume_room_instances(&mut cloner, "degen").unwrap();
        assert_eq!(batch_resume.affected_count, 2);
        for inst in cloner.list_instances(Some("degen")) {
            assert_eq!(inst.status, AppInstanceStatus::Running);
            assert!(inst.cpu_usage_percent > 0.0);
        }

        let _ = cloner.terminate_instance(&inst1.instance_id);
        let _ = cloner.terminate_instance(&inst2.instance_id);
        let _ = fs::remove_dir_all(&temp_base);
    }
}
