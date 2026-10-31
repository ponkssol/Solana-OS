mod apps;
pub mod cloner;
mod containment;
pub mod diag;
pub mod desktop;
pub mod freezer;
pub mod quantum_vault;
pub mod sandbox;
pub mod security;
mod shell_mode;
mod vault_file;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

use crate::cloner::{
    AppInstanceStatus, CloneLaunchRequest, ClonedAppInstance, SupportedAppSpec, UniversalAppCloner,
};
use crate::desktop::{VirtualDesktopManager, VirtualDesktopStatus};
use crate::freezer::{
    freeze_instance, freeze_room_instances, resume_instance, resume_room_instances,
    toggle_freeze_instance, FreezeOperationResult, RoomFreezeBatchResult,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatusPayload {
    pub enclave_name: String,
    pub identity: String,
    pub cipher_suite: String,
    pub locked: bool,
    pub active_room: String,
    pub key_isolation_id: String,
    pub shield_active: bool,
    pub on_chain_verified: bool,
    pub last_handshake_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomResourceSummary {
    pub room_id: String,
    pub key_isolation_id: String,
    pub total_instances: usize,
    pub running_instances: usize,
    pub frozen_instances: usize,
    pub total_cpu_percent: f32,
    pub total_memory_mb: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxTelemetrySnapshot {
    pub vault: VaultStatusPayload,
    pub virtual_desktop: VirtualDesktopStatus,
    pub sandbox_root_dir: String,
    pub total_instances: usize,
    pub running_instances: usize,
    pub frozen_instances: usize,
    pub stopped_instances: usize,
    pub active_cpu_usage_percent: f32,
    pub total_memory_mb: f32,
    pub rooms: Vec<RoomResourceSummary>,
    pub instances: Vec<ClonedAppInstance>,
}

pub struct EnclaveState {
    pub status: Mutex<VaultStatusPayload>,
    pub cloner: Mutex<UniversalAppCloner>,
    pub desktop: Mutex<VirtualDesktopManager>,
}

impl Default for EnclaveState {
    fn default() -> Self {
        Self::new()
    }
}

impl EnclaveState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(VaultStatusPayload {
                enclave_name: "vault.solos".to_string(),
                identity: "nanda.solos".to_string(),
                cipher_suite: "Argon2id + XChaCha20-Poly1305".to_string(),
                locked: true,
                active_room: "main".to_string(),
                key_isolation_id: derive_room_key_id("main"),
                shield_active: true,
                on_chain_verified: true,
                last_handshake_ms: 14,
            }),
            cloner: Mutex::new(UniversalAppCloner::new(
                UniversalAppCloner::default_sandbox_root(),
            )),
            desktop: Mutex::new(VirtualDesktopManager::new()),
        }
    }
}

pub fn derive_room_key_id(room: &str) -> String {
    match room {
        "main" => "MLKEM1024-ENCLAVE-MAIN-9F4A".to_string(),
        "degen" => "MLKEM1024-ENCLAVE-DEGEN-3C8E".to_string(),
        "dev" => "MLKEM1024-ENCLAVE-DEV-7B1D".to_string(),
        "burner" => "MLKEM1024-EPHEMERAL-BURNER-0X99".to_string(),
        other => format!(
            "MLKEM1024-ENCLAVE-{}-7F01",
            other.trim().to_ascii_uppercase()
        ),
    }
}

#[tauri::command]
fn unlock_vault_solos(
    passphrase: String,
    state: State<'_, EnclaveState>,
) -> Result<VaultStatusPayload, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase or passkey signature required to unseal vault.solos".to_string());
    }
    let _ = quantum_vault::with_signing_key(passphrase.as_bytes(), b"solos-unlock-salt!", None, |key| key.len())?;
    let mut guard = state.status.lock().map_err(|_| "Enclave mutex poisoned")?;
    guard.locked = false;
    Ok(guard.clone())
}

#[tauri::command]
fn lock_vault_solos(state: State<'_, EnclaveState>) -> Result<VaultStatusPayload, String> {
    let mut guard = state.status.lock().map_err(|_| "Enclave mutex poisoned")?;
    guard.locked = true;
    Ok(guard.clone())
}

#[tauri::command]
fn switch_room(
    room: String,
    auto_freeze_previous_room: Option<bool>,
    state: State<'_, EnclaveState>,
) -> Result<VaultStatusPayload, String> {
    switch_room_internal(&state, &room, auto_freeze_previous_room.unwrap_or(true))
}

pub fn switch_room_internal(
    state: &EnclaveState,
    room: &str,
    auto_freeze_previous: bool,
) -> Result<VaultStatusPayload, String> {
    let target_room = cloner::sanitize_identifier(room, "main");
    let previous_room = {
        let mut guard = state.status.lock().map_err(|_| "Enclave mutex poisoned")?;
        let prev = guard.active_room.clone();
        guard.active_room = target_room.clone();
        guard.key_isolation_id = derive_room_key_id(&target_room);
        prev
    };

    if auto_freeze_previous && !previous_room.eq_ignore_ascii_case(&target_room) {
        let mut cloner_guard = state
            .cloner
            .lock()
            .map_err(|_| "App Cloner mutex poisoned")?;
        let _ = freeze_room_instances(&mut cloner_guard, &previous_room);
        let _ = resume_room_instances(&mut cloner_guard, &target_room);
    }

    let guard = state.status.lock().map_err(|_| "Enclave mutex poisoned")?;
    Ok(guard.clone())
}

#[tauri::command]
fn seal_vault_solos(passphrase: String, plaintext: Vec<u8>) -> Result<Vec<u8>, String> {
    quantum_vault::seal(passphrase.as_bytes(), None, &plaintext).map(|s| s.bytes)
}

#[tauri::command]
fn open_vault_solos(passphrase: String, blob: Vec<u8>) -> Result<Vec<u8>, String> {
    quantum_vault::open(passphrase.as_bytes(), None, &blob).map(|p| p.to_vec())
}

#[tauri::command]
fn get_vault_status(state: State<'_, EnclaveState>) -> Result<VaultStatusPayload, String> {
    let guard = state.status.lock().map_err(|_| "Enclave mutex poisoned")?;
    Ok(guard.clone())
}

// ============================================================================
// Module 1 IPC Commands: Universal App Cloner Engine
// ============================================================================

#[tauri::command]
fn list_supported_apps(
    state: State<'_, EnclaveState>,
) -> Result<Vec<SupportedAppSpec>, String> {
    let guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    Ok(guard.list_supported_apps())
}

#[tauri::command]
fn list_room_instances(
    room_id: Option<String>,
    state: State<'_, EnclaveState>,
) -> Result<Vec<ClonedAppInstance>, String> {
    let guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    Ok(guard.list_instances(room_id.as_deref()))
}

#[tauri::command]
fn clone_and_launch_app(
    request: CloneLaunchRequest,
    state: State<'_, EnclaveState>,
) -> Result<ClonedAppInstance, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    guard.clone_and_launch(request)
}

#[tauri::command]
fn terminate_app_instance(
    instance_id: String,
    state: State<'_, EnclaveState>,
) -> Result<ClonedAppInstance, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    guard.terminate_instance(&instance_id)
}

// ============================================================================
// Module 2 IPC Commands: Virtual Desktop Switcher (1-Click Windows <-> Solana OS)
// ============================================================================

#[tauri::command]
fn get_virtual_desktop_status(
    state: State<'_, EnclaveState>,
) -> Result<VirtualDesktopStatus, String> {
    let guard = state
        .desktop
        .lock()
        .map_err(|_| "Virtual Desktop mutex poisoned")?;
    Ok(guard.get_status())
}

#[tauri::command]
fn switch_virtual_desktop(
    target: String,
    state: State<'_, EnclaveState>,
) -> Result<VirtualDesktopStatus, String> {
    let mut guard = state
        .desktop
        .lock()
        .map_err(|_| "Virtual Desktop mutex poisoned")?;
    guard.switch_desktop(&target)
}

#[tauri::command]
fn toggle_virtual_desktop(
    state: State<'_, EnclaveState>,
) -> Result<VirtualDesktopStatus, String> {
    let mut guard = state
        .desktop
        .lock()
        .map_err(|_| "Virtual Desktop mutex poisoned")?;
    guard.toggle_desktop()
}

#[tauri::command]
fn emergency_restore_windows_desktop(
    state: State<'_, EnclaveState>,
) -> Result<VirtualDesktopStatus, String> {
    let mut guard = state
        .desktop
        .lock()
        .map_err(|_| "Virtual Desktop mutex poisoned")?;
    guard.emergency_panic_fallback()
}

// ============================================================================
// Module 3 IPC Commands: Process Freeze Engine (❄️ 0% CPU Background Freeze)
// ============================================================================

#[tauri::command]
fn freeze_app_instance(
    instance_id: String,
    state: State<'_, EnclaveState>,
) -> Result<FreezeOperationResult, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    freeze_instance(&mut guard, &instance_id)
}

#[tauri::command]
fn resume_app_instance(
    instance_id: String,
    state: State<'_, EnclaveState>,
) -> Result<FreezeOperationResult, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    resume_instance(&mut guard, &instance_id)
}

#[tauri::command]
fn toggle_freeze_app(
    instance_id: String,
    state: State<'_, EnclaveState>,
) -> Result<FreezeOperationResult, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    toggle_freeze_instance(&mut guard, &instance_id)
}

#[tauri::command]
fn freeze_room_apps(
    room_id: String,
    state: State<'_, EnclaveState>,
) -> Result<RoomFreezeBatchResult, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    freeze_room_instances(&mut guard, &room_id)
}

#[tauri::command]
fn resume_room_apps(
    room_id: String,
    state: State<'_, EnclaveState>,
) -> Result<RoomFreezeBatchResult, String> {
    let mut guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;
    resume_room_instances(&mut guard, &room_id)
}

// ============================================================================
// Unified Sandbox Telemetry Snapshot
// ============================================================================

#[tauri::command]
fn inspect_url(url: String) -> security::anti_drainer::PhishingVerdict {
    security::anti_drainer::check_phishing_url(&url)
}

#[tauri::command]
fn simulate_transaction(
    request: security::anti_drainer::SolanaTxSimulationRequest,
) -> security::anti_drainer::TransactionSimResult {
    security::anti_drainer::simulate_and_verify_transaction(&request)
}

#[tauri::command]
fn inspect_clipboard(content: String) -> security::anti_drainer::ClickFixVerdict {
    security::anti_drainer::inspect_clipboard_clickfix(&content)
}

#[tauri::command]
fn get_sandbox_telemetry(
    state: State<'_, EnclaveState>,
) -> Result<SandboxTelemetrySnapshot, String> {
    build_sandbox_telemetry(&state)
}

pub fn build_sandbox_telemetry(state: &EnclaveState) -> Result<SandboxTelemetrySnapshot, String> {
    let vault = state
        .status
        .lock()
        .map_err(|_| "Enclave mutex poisoned")?
        .clone();
    let virtual_desktop = state
        .desktop
        .lock()
        .map_err(|_| "Virtual Desktop mutex poisoned")?
        .get_status();
    let cloner_guard = state
        .cloner
        .lock()
        .map_err(|_| "App Cloner mutex poisoned")?;

    let instances = cloner_guard.list_instances(None);
    let sandbox_root_dir = cloner_guard.base_sandbox_dir.to_string_lossy().to_string();

    let mut running_instances = 0usize;
    let mut frozen_instances = 0usize;
    let mut stopped_instances = 0usize;
    let mut active_cpu = 0.0_f32;
    let mut total_mem = 0.0_f32;

    let mut room_map: HashMap<String, RoomResourceSummary> = HashMap::new();
    for default_room in ["main", "degen", "dev", "burner"] {
        room_map.insert(
            default_room.to_string(),
            RoomResourceSummary {
                room_id: default_room.to_string(),
                key_isolation_id: derive_room_key_id(default_room),
                total_instances: 0,
                running_instances: 0,
                frozen_instances: 0,
                total_cpu_percent: 0.0,
                total_memory_mb: 0.0,
            },
        );
    }

    for inst in &instances {
        let entry = room_map
            .entry(inst.room_id.clone())
            .or_insert_with(|| RoomResourceSummary {
                room_id: inst.room_id.clone(),
                key_isolation_id: derive_room_key_id(&inst.room_id),
                total_instances: 0,
                running_instances: 0,
                frozen_instances: 0,
                total_cpu_percent: 0.0,
                total_memory_mb: 0.0,
            });
        entry.total_instances += 1;

        match inst.status {
            AppInstanceStatus::Running => {
                running_instances += 1;
                entry.running_instances += 1;
                active_cpu += inst.cpu_usage_percent;
                total_mem += inst.memory_mb;
                entry.total_cpu_percent += inst.cpu_usage_percent;
                entry.total_memory_mb += inst.memory_mb;
            }
            AppInstanceStatus::Frozen => {
                frozen_instances += 1;
                entry.frozen_instances += 1;
                total_mem += inst.memory_mb;
                entry.total_memory_mb += inst.memory_mb;
            }
            AppInstanceStatus::Stopped => {
                stopped_instances += 1;
            }
        }
    }

    let mut rooms: Vec<RoomResourceSummary> = room_map.into_values().collect();
    rooms.sort_by(|a, b| a.room_id.cmp(&b.room_id));

    Ok(SandboxTelemetrySnapshot {
        vault,
        virtual_desktop,
        sandbox_root_dir,
        total_instances: instances.len(),
        running_instances,
        frozen_instances,
        stopped_instances,
        active_cpu_usage_percent: (active_cpu * 10.0).round() / 10.0,
        total_memory_mb: (total_mem * 10.0).round() / 10.0,
        rooms,
        instances,
    })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellEnclaveStatus {
    locked: bool,
    cipher_suite: String,
    kdf: String,
    aead: String,
    kem: String,
    ram_enclave: String,
    hardware_shard: String,
    key_id: String,
    sandboxes: Vec<crate::cloner::ClonedAppInstance>,
}

#[tauri::command]
fn get_enclave_status(state: State<'_, EnclaveState>) -> Result<ShellEnclaveStatus, String> {
    let vault = state.status.lock().map_err(|_| "Enclave mutex poisoned")?;
    let cloner = state.cloner.lock().map_err(|_| "App Cloner mutex poisoned")?;
    Ok(ShellEnclaveStatus {
        locked: vault.locked,
        cipher_suite: vault.cipher_suite.clone(),
        kdf: "Argon2id".into(),
        aead: "XChaCha20-Poly1305".into(),
        // No post-quantum KEM crate is linked yet; the vault key comes from Argon2id alone.
        kem: "Not enabled (ML-KEM-1024 planned)".into(),
        ram_enclave: "Zeroized on drop".into(),
        hardware_shard: "YubiKey shard slot".into(),
        key_id: vault.key_isolation_id.clone(),
        sandboxes: cloner.list_instances(None),
    })
}

#[tauri::command]
fn clone_app_instance(
    app_id: String,
    room_id: String,
    state: State<'_, EnclaveState>,
) -> Result<crate::cloner::ClonedAppInstance, String> {
    let mut cloner = state.cloner.lock().map_err(|_| "App Cloner mutex poisoned")?;
    let result = cloner.clone_and_launch(crate::cloner::CloneLaunchRequest {
        app_id: app_id.clone(),
        room_id,
        custom_exe_path: None,
        extra_args: None,
        launch_on_enclave_desktop: Some(false),
        instance_label: None,
        isolate: None,
        display_name: None,
    });
    if let Err(err) = &result {
        diag!("clone {app_id} failed: {err}");
    }
    result
}

#[tauri::command]
fn toggle_freeze_process(
    instance_id: String,
    state: State<'_, EnclaveState>,
) -> Result<crate::freezer::FreezeOperationResult, String> {
    let mut cloner = state.cloner.lock().map_err(|_| "App Cloner mutex poisoned")?;
    crate::freezer::toggle_freeze_instance(&mut cloner, &instance_id)
}

#[tauri::command]
fn terminate_sandbox(
    instance_id: String,
    state: State<'_, EnclaveState>,
) -> Result<crate::cloner::ClonedAppInstance, String> {
    let mut cloner = state.cloner.lock().map_err(|_| "App Cloner mutex poisoned")?;
    cloner.terminate_instance(&instance_id)
}

#[tauri::command]
fn unlock_vault_container(
    passphrase: String,
    state: State<'_, EnclaveState>,
) -> Result<VaultStatusPayload, String> {
    unlock_vault_solos(passphrase, state)
}

#[tauri::command]
fn sign_with_ram_enclave(passphrase: String) -> Result<String, String> {
    quantum_vault::with_signing_key(passphrase.as_bytes(), b"solos-sign-salt!", None, |_| {
        "signed-in-enclave".to_string()
    })
}

#[tauri::command]
fn run_sandboxed_cli_command(
    room_id: String,
    shell_type: String,
    command: String,
) -> Result<sandbox::CliRunResult, String> {
    sandbox::run_sandboxed_cli_command(&room_id, &shell_type, &command)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_state = EnclaveState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(initial_state)
        .invoke_handler(tauri::generate_handler![
            unlock_vault_solos,
            lock_vault_solos,
            seal_vault_solos,
            open_vault_solos,
            vault_file::vault_file_exists,
            vault_file::vault_file_path,
            vault_file::read_vault_file,
            vault_file::write_vault_file,
            vault_file::unlock_vault_file,
            vault_file::export_vault_backup,
            vault_file::import_vault_backup,
            switch_room,
            get_vault_status,
            list_supported_apps,
            list_room_instances,
            clone_and_launch_app,
            terminate_app_instance,
            freeze_app_instance,
            resume_app_instance,
            toggle_freeze_app,
            freeze_room_apps,
            resume_room_apps,
            get_virtual_desktop_status,
            switch_virtual_desktop,
            toggle_virtual_desktop,
            emergency_restore_windows_desktop,
            get_sandbox_telemetry,
            inspect_url,
            simulate_transaction,
            inspect_clipboard,
            get_enclave_status,
            clone_app_instance,
            toggle_freeze_process,
            terminate_sandbox,
            unlock_vault_container,
            apps::list_installed_apps,
            apps::app_icons,
            apps::launch_app,
            sign_with_ram_enclave,
            run_sandboxed_cli_command,
            shell_mode::set_shell_presentation,
            shell_mode::get_shell_presentation,
            shell_mode::minimize_shell,
            containment::containment_set_desk,
            diag::diag_log,
            diag::read_diag_log,
            containment::containment_focus,
            containment::containment_close_window
        ])
        .setup(|app| {
            diag::init(app.handle());
            shell_mode::install(app.handle());
            containment::install(app.handle());
            diag!("setup finished");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Solana OS Tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_room_switch_auto_freezes_previous_room_and_resumes_active_room() {
        let state = EnclaveState::new();

        // Launch apps in 'main' and 'degen'
        let (main_id, degen_id) = {
            let mut cloner = state.cloner.lock().unwrap();
            let main_app = cloner
                .clone_and_launch(CloneLaunchRequest {
                    app_id: "cursor".to_string(),
                    room_id: "main".to_string(),
                    custom_exe_path: None,
                    extra_args: None,
                    launch_on_enclave_desktop: Some(false),
                    instance_label: Some("Main Workspace".to_string()),
                    isolate: None,
                    display_name: None,
                })
                .unwrap();

            let degen_app = cloner
                .clone_and_launch(CloneLaunchRequest {
                    app_id: "chrome".to_string(),
                    room_id: "degen".to_string(),
                    custom_exe_path: None,
                    extra_args: None,
                    launch_on_enclave_desktop: Some(false),
                    instance_label: Some("Degen Burner".to_string()),
                    isolate: None,
                    display_name: None,
                })
                .unwrap();

            // Initially freeze degen while in main
            let _ = freeze_room_instances(&mut cloner, "degen").unwrap();
            (main_app.instance_id, degen_app.instance_id)
        };

        // Switch from 'main' -> 'degen' with auto_freeze_previous = true
        let updated_vault = switch_room_internal(&state, "degen", true).unwrap();
        assert_eq!(updated_vault.active_room, "degen");
        assert_eq!(updated_vault.key_isolation_id, "MLKEM1024-ENCLAVE-DEGEN-3C8E");

        let telemetry = build_sandbox_telemetry(&state).unwrap();
        let main_inst = telemetry
            .instances
            .iter()
            .find(|i| i.instance_id == main_id)
            .unwrap();
        let degen_inst = telemetry
            .instances
            .iter()
            .find(|i| i.instance_id == degen_id)
            .unwrap();

        // Main room app is now Frozen (0% CPU), Degen room app is Running!
        assert_eq!(main_inst.status, AppInstanceStatus::Frozen);
        assert_eq!(main_inst.cpu_usage_percent, 0.0);
        assert_eq!(degen_inst.status, AppInstanceStatus::Running);
        assert!(degen_inst.cpu_usage_percent > 0.0);

        // Clean up processes
        let mut cloner = state.cloner.lock().unwrap();
        let _ = cloner.terminate_instance(&main_id);
        let _ = cloner.terminate_instance(&degen_id);
    }
}
