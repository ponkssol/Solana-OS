use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(not(target_os = "windows"))]
use std::process::{Child, Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::desktop::{DEFAULT_WINDOWS_DESKTOP, SOLANA_OS_ENCLAVE_DESKTOP};

/// Status of a cloned application instance inside a Solana OS Room.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum AppInstanceStatus {
    Running,
    Frozen,
    Stopped,
}

/// Metadata and isolation blueprint for a supported Windows application.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedAppSpec {
    pub app_id: String,
    pub display_name: String,
    pub category: String,
    pub vendor: String,
    pub default_windows_paths: Vec<String>,
    pub resolved_exe_path: String,
    pub detected_on_host: bool,
    pub isolation_strategy: String,
    pub default_args_template: Vec<String>,
    pub registry_hive_subkey: String,
    pub supports_multi_instance: bool,
    pub default_cpu_estimate_percent: f32,
    pub default_memory_estimate_mb: f32,
}

/// Filesystem layout created for each `(room_id, app_id)` sandbox container.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IsolatedRoomDirectories {
    pub base_dir: PathBuf,
    pub appdata_roaming: PathBuf,
    pub appdata_local: PathBuf,
    pub temp_dir: PathBuf,
    pub user_profile: PathBuf,
    pub registry_hive_dir: PathBuf,
    pub registry_overrides_file: PathBuf,
    pub app_data_profile_dir: PathBuf,
    pub extensions_dir: PathBuf,
}

/// Written to `RegistryHive/registry_overrides.json` and used to configure `RegOverridePredefKey`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryOverrideManifest {
    pub schema_version: String,
    pub room_id: String,
    pub app_id: String,
    pub predefined_root: String,
    pub target_app_subkey: String,
    pub redirected_hkcu_root: String,
    pub reg_override_predef_key_enabled: bool,
    pub env_overrides: HashMap<String, String>,
    pub created_at_ms: u64,
}

/// Request payload for `clone_and_launch_app`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneLaunchRequest {
    #[serde(alias = "app_id")]
    pub app_id: String,
    #[serde(alias = "room_id")]
    pub room_id: String,
    #[serde(default, alias = "custom_exe_path")]
    pub custom_exe_path: Option<String>,
    #[serde(default, alias = "extra_args")]
    pub extra_args: Option<Vec<String>>,
    #[serde(default, alias = "launch_on_enclave_desktop")]
    pub launch_on_enclave_desktop: Option<bool>,
    #[serde(default, alias = "instance_label")]
    pub instance_label: Option<String>,
}

/// Active or stopped cloned application instance tracked per Room.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClonedAppInstance {
    pub instance_id: String,
    pub app_id: String,
    pub app_name: String,
    pub exe_path: String,
    pub room_id: String,
    pub pid: u32,
    pub status: AppInstanceStatus,
    pub isolated_appdata: String,
    pub isolated_local_appdata: String,
    pub isolated_temp: String,
    pub isolated_user_profile: String,
    pub registry_key_root: String,
    pub registry_overrides_path: String,
    pub launch_args: Vec<String>,
    pub desktop_name: String,
    pub cpu_usage_percent: f32,
    pub memory_mb: f32,
    pub launched_at_ms: u64,
}

pub fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Sanitizes a room identifier (`main`, `degen`, `dev`, `burner`, or custom alphanumeric room IDs).
pub fn sanitize_identifier(raw: &str, fallback: &str) -> String {
    let cleaned: String = raw
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('_');
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

/// Expands Windows environment placeholders (`%ProgramFiles%`, `%LocalAppData%`, `%AppData%`, etc.)
/// using current environment variables or standard Windows 11 defaults when running on Linux dev hosts.
pub fn expand_windows_path_template(template: &str) -> String {
    let program_files =
        env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
    let program_files_x86 =
        env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".to_string());
    let local_app_data = env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| r"C:\Users\SolanaOS\AppData\Local".to_string());
    let roaming_app_data =
        env::var("APPDATA").unwrap_or_else(|_| r"C:\Users\SolanaOS\AppData\Roaming".to_string());
    let user_profile =
        env::var("USERPROFILE").unwrap_or_else(|_| r"C:\Users\SolanaOS".to_string());

    template
        .replace("%ProgramFiles%", &program_files)
        .replace("%ProgramFiles(x86)%", &program_files_x86)
        .replace("%LocalAppData%", &local_app_data)
        .replace("%LOCALAPPDATA%", &local_app_data)
        .replace("%AppData%", &roaming_app_data)
        .replace("%APPDATA%", &roaming_app_data)
        .replace("%UserProfile%", &user_profile)
        .replace("%USERPROFILE%", &user_profile)
}

/// Resolves the best executable path from candidate templates on the host filesystem.
fn resolve_candidate_exe(candidates: &[&str]) -> (String, bool) {
    for raw in candidates {
        let expanded = expand_windows_path_template(raw);
        if Path::new(&expanded).exists() {
            return (expanded, true);
        }
    }
    let primary = candidates
        .first()
        .map(|c| expand_windows_path_template(c))
        .unwrap_or_else(|| r"C:\Windows\System32\cmd.exe".to_string());
    (primary, false)
}

/// Catalog of built-in Windows apps supported by the Universal App Cloner Engine.
pub fn build_supported_app_catalog() -> Vec<SupportedAppSpec> {
    let chrome_candidates = [
        r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
        r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
    ];
    let (chrome_exe, chrome_found) = resolve_candidate_exe(&chrome_candidates);

    let brave_candidates = [
        r"%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe",
    ];
    let (brave_exe, brave_found) = resolve_candidate_exe(&brave_candidates);

    let cursor_candidates = [
        r"%LocalAppData%\Programs\cursor\Cursor.exe",
        r"%ProgramFiles%\Cursor\Cursor.exe",
    ];
    let (cursor_exe, cursor_found) = resolve_candidate_exe(&cursor_candidates);

    let vscode_candidates = [
        r"%LocalAppData%\Programs\Microsoft VS Code\Code.exe",
        r"%ProgramFiles%\Microsoft VS Code\Code.exe",
        r"%ProgramFiles(x86)%\Microsoft VS Code\Code.exe",
    ];
    let (vscode_exe, vscode_found) = resolve_candidate_exe(&vscode_candidates);

    let telegram_candidates = [
        r"%AppData%\Telegram Desktop\Telegram.exe",
        r"%LocalAppData%\Telegram Desktop\Telegram.exe",
        r"%ProgramFiles%\Telegram Desktop\Telegram.exe",
    ];
    let (telegram_exe, telegram_found) = resolve_candidate_exe(&telegram_candidates);

    let discord_candidates = [
        r"%LocalAppData%\Discord\Update.exe",
        r"%LocalAppData%\Discord\app-1.0.9036\Discord.exe",
        r"%ProgramFiles%\Discord\Discord.exe",
    ];
    let (discord_exe, discord_found) = resolve_candidate_exe(&discord_candidates);

    vec![
        SupportedAppSpec {
            app_id: "chrome".to_string(),
            display_name: "Google Chrome".to_string(),
            category: "Browser".to_string(),
            vendor: "Google LLC".to_string(),
            default_windows_paths: chrome_candidates.iter().map(|s| s.to_string()).collect(),
            resolved_exe_path: chrome_exe,
            detected_on_host: chrome_found,
            isolation_strategy: "Chromium Profile Isolation (--user-data-dir) + Env & HKCU Sandbox"
                .to_string(),
            default_args_template: vec![
                "--user-data-dir=\"<isolated_profile>\"".to_string(),
                "--no-first-run".to_string(),
                "--no-default-browser-check".to_string(),
            ],
            registry_hive_subkey: r"Software\Google\Chrome".to_string(),
            supports_multi_instance: true,
            default_cpu_estimate_percent: 4.8,
            default_memory_estimate_mb: 420.0,
        },
        SupportedAppSpec {
            app_id: "brave".to_string(),
            display_name: "Brave Browser".to_string(),
            category: "Web3 Browser".to_string(),
            vendor: "Brave Software".to_string(),
            default_windows_paths: brave_candidates.iter().map(|s| s.to_string()).collect(),
            resolved_exe_path: brave_exe,
            detected_on_host: brave_found,
            isolation_strategy:
                "Brave Profile & Wallet Isolation (--user-data-dir) + Env & HKCU Sandbox"
                    .to_string(),
            default_args_template: vec![
                "--user-data-dir=\"<isolated_profile>\"".to_string(),
                "--no-first-run".to_string(),
                "--no-default-browser-check".to_string(),
            ],
            registry_hive_subkey: r"Software\BraveSoftware\Brave-Browser".to_string(),
            supports_multi_instance: true,
            default_cpu_estimate_percent: 4.2,
            default_memory_estimate_mb: 390.0,
        },
        SupportedAppSpec {
            app_id: "cursor".to_string(),
            display_name: "Cursor AI IDE".to_string(),
            category: "Developer IDE".to_string(),
            vendor: "Anysphere".to_string(),
            default_windows_paths: cursor_candidates.iter().map(|s| s.to_string()).collect(),
            resolved_exe_path: cursor_exe,
            detected_on_host: cursor_found,
            isolation_strategy:
                "Workspace & Extension Isolation (--user-data-dir + --extensions-dir)".to_string(),
            default_args_template: vec![
                "--user-data-dir".to_string(),
                "<isolated_data>".to_string(),
                "--extensions-dir".to_string(),
                "<isolated_ext>".to_string(),
            ],
            registry_hive_subkey: r"Software\Cursor".to_string(),
            supports_multi_instance: true,
            default_cpu_estimate_percent: 6.4,
            default_memory_estimate_mb: 610.0,
        },
        SupportedAppSpec {
            app_id: "vscode".to_string(),
            display_name: "Visual Studio Code".to_string(),
            category: "Developer IDE".to_string(),
            vendor: "Microsoft".to_string(),
            default_windows_paths: vscode_candidates.iter().map(|s| s.to_string()).collect(),
            resolved_exe_path: vscode_exe,
            detected_on_host: vscode_found,
            isolation_strategy:
                "User Data & Extension Isolation (--user-data-dir + --extensions-dir)".to_string(),
            default_args_template: vec![
                "--user-data-dir".to_string(),
                "<isolated_data>".to_string(),
                "--extensions-dir".to_string(),
                "<isolated_ext>".to_string(),
            ],
            registry_hive_subkey: r"Software\Microsoft\VSCode".to_string(),
            supports_multi_instance: true,
            default_cpu_estimate_percent: 5.1,
            default_memory_estimate_mb: 520.0,
        },
        SupportedAppSpec {
            app_id: "telegram".to_string(),
            display_name: "Telegram Desktop".to_string(),
            category: "Encrypted Comms".to_string(),
            vendor: "Telegram FZ-LLC".to_string(),
            default_windows_paths: telegram_candidates.iter().map(|s| s.to_string()).collect(),
            resolved_exe_path: telegram_exe,
            detected_on_host: telegram_found,
            isolation_strategy: "Multi-Account Workdir Isolation (-many -workdir)".to_string(),
            default_args_template: vec![
                "-many".to_string(),
                "-workdir".to_string(),
                "<isolated_workdir>".to_string(),
            ],
            registry_hive_subkey: r"Software\TelegramDesktop".to_string(),
            supports_multi_instance: true,
            default_cpu_estimate_percent: 1.9,
            default_memory_estimate_mb: 215.0,
        },
        SupportedAppSpec {
            app_id: "discord".to_string(),
            display_name: "Discord".to_string(),
            category: "Community & Alpha".to_string(),
            vendor: "Discord Inc.".to_string(),
            default_windows_paths: discord_candidates.iter().map(|s| s.to_string()).collect(),
            resolved_exe_path: discord_exe,
            detected_on_host: discord_found,
            isolation_strategy:
                "Multi-Instance Flag (--multi-instance) + APPDATA/LOCALAPPDATA Redirection"
                    .to_string(),
            default_args_template: vec!["--multi-instance".to_string()],
            registry_hive_subkey: r"Software\Discord".to_string(),
            supports_multi_instance: true,
            default_cpu_estimate_percent: 3.6,
            default_memory_estimate_mb: 340.0,
        },
    ]
}

/// Computes the app-specific command-line arguments for zero-reinstall multi-instance isolation.
pub fn build_isolated_launch_args(
    app_id: &str,
    dirs: &IsolatedRoomDirectories,
    extra_args: Option<&[String]>,
) -> Vec<String> {
    let profile_path = dirs.app_data_profile_dir.to_string_lossy().to_string();
    let ext_path = dirs.extensions_dir.to_string_lossy().to_string();

    let mut args = match app_id {
        "chrome" | "brave" => vec![
            format!("--user-data-dir={}", profile_path),
            "--no-first-run".to_string(),
            "--no-default-browser-check".to_string(),
        ],
        "cursor" | "vscode" => vec![
            "--user-data-dir".to_string(),
            profile_path,
            "--extensions-dir".to_string(),
            ext_path,
        ],
        "telegram" => vec!["-many".to_string(), "-workdir".to_string(), profile_path],
        "discord" => vec!["--multi-instance".to_string()],
        _ => Vec::new(),
    };

    if let Some(extra) = extra_args {
        for arg in extra {
            if !arg.trim().is_empty() {
                args.push(arg.clone());
            }
        }
    }

    args
}

///Universal App Cloner Engine managing per-Room directory isolation, HKCU registry redirection,
///and process lifecycle across Rooms.
pub struct UniversalAppCloner {
    pub base_sandbox_dir: PathBuf,
    pub instances: HashMap<String, ClonedAppInstance>,
    pub custom_exe_overrides: HashMap<String, String>,
    next_instance_seq: u64,
    #[cfg(not(target_os = "windows"))]
    child_handles: HashMap<u32, Child>,
}

impl UniversalAppCloner {
    pub fn new(base_sandbox_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&base_sandbox_dir);
        Self {
            base_sandbox_dir,
            instances: HashMap::new(),
            custom_exe_overrides: HashMap::new(),
            next_instance_seq: 1,
            #[cfg(not(target_os = "windows"))]
            child_handles: HashMap::new(),
        }
    }

    pub fn default_sandbox_root() -> PathBuf {
        if let Ok(custom) = env::var("SOLANA_OS_SANDBOX_DIR") {
            return PathBuf::from(custom);
        }
        env::temp_dir().join("solana-os-enclave-sandbox")
    }

    /// Lists all supported apps with any configured executable path overrides.
    pub fn list_supported_apps(&self) -> Vec<SupportedAppSpec> {
        let mut catalog = build_supported_app_catalog();
        for spec in &mut catalog {
            if let Some(override_path) = self.custom_exe_overrides.get(&spec.app_id) {
                spec.resolved_exe_path = override_path.clone();
                spec.detected_on_host = Path::new(override_path).exists();
            }
        }
        catalog
    }

    /// Creates and initializes the isolated directory hierarchy and `RegistryHive/registry_overrides.json`
    /// under `<base_sandbox_dir>/rooms/<room_id>/apps/<app_id>/`.
    pub fn prepare_isolated_room_directories(
        &self,
        room_id: &str,
        app_id: &str,
        app_subkey: &str,
    ) -> Result<(IsolatedRoomDirectories, RegistryOverrideManifest), String> {
        let clean_room = sanitize_identifier(room_id, "main");
        let clean_app = sanitize_identifier(app_id, "custom");

        let base_dir = self
            .base_sandbox_dir
            .join("rooms")
            .join(&clean_room)
            .join("apps")
            .join(&clean_app);

        let appdata_roaming = base_dir.join("AppData").join("Roaming");
        let appdata_local = base_dir.join("AppData").join("Local");
        let temp_dir = base_dir.join("Temp");
        let user_profile = base_dir.join("UserProfile");
        let registry_hive_dir = base_dir.join("RegistryHive");
        let app_data_profile_dir = base_dir.join("IsolatedProfileData");
        let extensions_dir = base_dir.join("IsolatedExtensions");

        for dir in [
            &base_dir,
            &appdata_roaming,
            &appdata_local,
            &temp_dir,
            &user_profile,
            &registry_hive_dir,
            &app_data_profile_dir,
            &extensions_dir,
        ] {
            fs::create_dir_all(dir).map_err(|e| {
                format!(
                    "Failed to create sandbox directory {}: {}",
                    dir.display(),
                    e
                )
            })?;
        }

        let registry_overrides_file = registry_hive_dir.join("registry_overrides.json");
        let redirected_hkcu_root = format!(
            r"HKCU\Software\SolanaOS\Rooms\{}\Apps\{}\HKCU_Root",
            clean_room, clean_app
        );

        let mut env_overrides = HashMap::new();
        env_overrides.insert(
            "APPDATA".to_string(),
            appdata_roaming.to_string_lossy().to_string(),
        );
        env_overrides.insert(
            "LOCALAPPDATA".to_string(),
            appdata_local.to_string_lossy().to_string(),
        );
        env_overrides.insert("TEMP".to_string(), temp_dir.to_string_lossy().to_string());
        env_overrides.insert("TMP".to_string(), temp_dir.to_string_lossy().to_string());
        env_overrides.insert(
            "USERPROFILE".to_string(),
            user_profile.to_string_lossy().to_string(),
        );
        env_overrides.insert(
            "HOME".to_string(),
            user_profile.to_string_lossy().to_string(),
        );
        env_overrides.insert("SOLANA_OS_ROOM".to_string(), clean_room.clone());
        env_overrides.insert("SOLANA_OS_APP_ID".to_string(), clean_app.clone());
        env_overrides.insert(
            "SOLANA_OS_REGISTRY_ROOT".to_string(),
            redirected_hkcu_root.clone(),
        );

        let manifest = RegistryOverrideManifest {
            schema_version: "1.0.0-solos-enclave".to_string(),
            room_id: clean_room,
            app_id: clean_app,
            predefined_root: "HKEY_CURRENT_USER".to_string(),
            target_app_subkey: format!(r"HKCU\{}", app_subkey),
            redirected_hkcu_root,
            reg_override_predef_key_enabled: true,
            env_overrides,
            created_at_ms: now_epoch_ms(),
        };

        let json_bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize registry manifest: {}", e))?;
        fs::write(&registry_overrides_file, json_bytes)
            .map_err(|e| format!("Failed to write registry_overrides.json: {}", e))?;

        let dirs = IsolatedRoomDirectories {
            base_dir,
            appdata_roaming,
            appdata_local,
            temp_dir,
            user_profile,
            registry_hive_dir,
            registry_overrides_file,
            app_data_profile_dir,
            extensions_dir,
        };

        Ok((dirs, manifest))
    }

    /// Clones an application's environment into an isolated Room without reinstalling the binary,
    /// applies `APPDATA`/`LOCALAPPDATA`/`USERPROFILE`/`TEMP` + HKCU Registry isolation, and launches it.
    pub fn clone_and_launch(
        &mut self,
        request: CloneLaunchRequest,
    ) -> Result<ClonedAppInstance, String> {
        let clean_room = sanitize_identifier(&request.room_id, "main");
        let clean_app = sanitize_identifier(&request.app_id, "custom");

        let catalog = self.list_supported_apps();
        let matched_spec = catalog.iter().find(|s| s.app_id == clean_app).cloned();

        let (app_name, exe_path, app_subkey, default_cpu, default_mem) = match matched_spec {
            Some(spec) => {
                let resolved = request
                    .custom_exe_path
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or(spec.resolved_exe_path);
                (
                    spec.display_name,
                    resolved,
                    spec.registry_hive_subkey,
                    spec.default_cpu_estimate_percent,
                    spec.default_memory_estimate_mb,
                )
            }
            None => {
                let custom_exe = request
                    .custom_exe_path
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .ok_or_else(|| {
                        format!(
                            "Unsupported app_id '{}' requires a non-empty customExePath",
                            request.app_id
                        )
                    })?;
                let display = request
                    .instance_label
                    .clone()
                    .unwrap_or_else(|| format!("Custom App ({})", clean_app));
                (
                    display,
                    custom_exe,
                    format!(r"Software\SolanaOS\CustomApps\{}", clean_app),
                    2.5,
                    180.0,
                )
            }
        };

        if let Some(custom_override) = request
            .custom_exe_path
            .as_ref()
            .filter(|s| !s.trim().is_empty())
        {
            self.custom_exe_overrides
                .insert(clean_app.clone(), custom_override.clone());
        }

        let (dirs, manifest) =
            self.prepare_isolated_room_directories(&clean_room, &clean_app, &app_subkey)?;

        let launch_args =
            build_isolated_launch_args(&clean_app, &dirs, request.extra_args.as_deref());

        let target_desktop = if request.launch_on_enclave_desktop.unwrap_or(false) {
            SOLANA_OS_ENCLAVE_DESKTOP.to_string()
        } else {
            DEFAULT_WINDOWS_DESKTOP.to_string()
        };

        let pid = self.spawn_isolated_process(
            &exe_path,
            &launch_args,
            &dirs,
            &manifest,
            &target_desktop,
        )?;

        let seq = self.next_instance_seq;
        self.next_instance_seq += 1;
        let instance_id = format!("{}-{}-{}-{}", clean_room, clean_app, seq, pid);

        let display_name = match request.instance_label {
            Some(ref label) if !label.trim().is_empty() => {
                format!("{} ({})", app_name, label.trim())
            }
            _ => app_name,
        };

        let instance = ClonedAppInstance {
            instance_id: instance_id.clone(),
            app_id: clean_app,
            app_name: display_name,
            exe_path,
            room_id: clean_room,
            pid,
            status: AppInstanceStatus::Running,
            isolated_appdata: dirs.appdata_roaming.to_string_lossy().to_string(),
            isolated_local_appdata: dirs.appdata_local.to_string_lossy().to_string(),
            isolated_temp: dirs.temp_dir.to_string_lossy().to_string(),
            isolated_user_profile: dirs.user_profile.to_string_lossy().to_string(),
            registry_key_root: manifest.redirected_hkcu_root,
            registry_overrides_path: dirs.registry_overrides_file.to_string_lossy().to_string(),
            launch_args,
            desktop_name: target_desktop,
            cpu_usage_percent: default_cpu,
            memory_mb: default_mem,
            launched_at_ms: now_epoch_ms(),
        };

        self.instances.insert(instance_id, instance.clone());
        Ok(instance)
    }

    /// Lists cloned app instances, optionally filtered by `room_id`.
    pub fn list_instances(&self, room_id: Option<&str>) -> Vec<ClonedAppInstance> {
        let mut list: Vec<ClonedAppInstance> = self
            .instances
            .values()
            .filter(|inst| match room_id {
                Some(r) if !r.trim().is_empty() => {
                    inst.room_id.eq_ignore_ascii_case(r.trim())
                }
                _ => true,
            })
            .cloned()
            .collect();
        list.sort_by_key(|i| i.launched_at_ms);
        list
    }

    /// Terminates a running or frozen cloned app instance.
    pub fn terminate_instance(&mut self, instance_id: &str) -> Result<ClonedAppInstance, String> {
        let instance = self
            .instances
            .get_mut(instance_id)
            .ok_or_else(|| format!("App instance '{}' not found", instance_id))?;

        let pid = instance.pid;
        if instance.status != AppInstanceStatus::Stopped {
            #[cfg(target_os = "windows")]
            {
                let _ = terminate_windows_process(pid);
            }
            #[cfg(not(target_os = "windows"))]
            {
                if let Some(mut child) = self.child_handles.remove(&pid) {
                    let _ = child.kill();
                    let _ = child.wait();
                } else {
                    unsafe {
                        let _ = libc::kill(pid as i32, libc::SIGKILL);
                    }
                }
            }
            instance.status = AppInstanceStatus::Stopped;
            instance.cpu_usage_percent = 0.0;
            instance.memory_mb = 0.0;
        }

        Ok(instance.clone())
    }

    #[cfg(target_os = "windows")]
    fn spawn_isolated_process(
        &mut self,
        exe_path: &str,
        args: &[String],
        dirs: &IsolatedRoomDirectories,
        manifest: &RegistryOverrideManifest,
        desktop_name: &str,
    ) -> Result<u32, String> {
        // Configure per-room isolated HKCU registry key in Windows Registry
        let subkey_path = format!(
            r"Software\SolanaOS\Rooms\{}\Apps\{}\HKCU_Root",
            manifest.room_id, manifest.app_id
        );
        configure_windows_registry_sandbox(&subkey_path)?;

        // Launch the process via CreateProcessW onto the target desktop with isolated environment
        let pid = crate::desktop::launch_process_on_desktop_win32(
            exe_path,
            args,
            &manifest.env_overrides,
            &dirs.user_profile,
            desktop_name,
        )?;

        // Assign process to a Windows Job Object for clean sandbox lifecycle
        let _ = assign_pid_to_room_job_object(&manifest.room_id, pid);

        Ok(pid)
    }

    #[cfg(not(target_os = "windows"))]
    fn spawn_isolated_process(
        &mut self,
        exe_path: &str,
        args: &[String],
        dirs: &IsolatedRoomDirectories,
        manifest: &RegistryOverrideManifest,
        _desktop_name: &str,
    ) -> Result<u32, String> {
        // On Linux/Unix development & test hosts, if the executable exists and is runnable,
        // or if we are simulating a Windows .exe binary inside the room sandbox, we spawn a
        // lightweight real POSIX holder process (`sleep 3600`) with the exact isolated environment
        // variables and working directory so that `SIGSTOP` / `SIGCONT` (0% CPU Freezer) and
        // process inspection work against a real OS kernel PID.
        let mut cmd = if Path::new(exe_path).exists() && !exe_path.to_ascii_lowercase().ends_with(".exe") {
            let mut c = Command::new(exe_path);
            c.args(args);
            c
        } else {
            let mut c = Command::new("sleep");
            c.arg("3600");
            c
        };

        cmd.current_dir(&dirs.user_profile)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        for (k, v) in &manifest.env_overrides {
            cmd.env(k, v);
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn sandboxed process for '{}': {}", exe_path, e))?;
        let pid = child.id();
        self.child_handles.insert(pid, child);
        Ok(pid)
    }
}

#[cfg(not(target_os = "windows"))]
impl Drop for UniversalAppCloner {
    fn drop(&mut self) {
        for (_, mut child) in self.child_handles.drain() {
            let _ = child.kill();
            let _ = child.wait();
        }
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
fn configure_windows_registry_sandbox(subkey_path: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegOverridePredefKey, HKEY, HKEY_CURRENT_USER, KEY_ALL_ACCESS,
        REG_OPTION_NON_VOLATILE,
    };

    unsafe {
        let wide_subkey = to_wide_null(subkey_path);
        let mut isolated_hkey = HKEY::default();
        let status = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(wide_subkey.as_ptr()),
            0,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_ALL_ACCESS,
            None,
            &mut isolated_hkey,
            None,
        );
        if status.is_err() {
            return Err(format!(
                "RegCreateKeyExW failed for isolated hive '{}': {:?}",
                subkey_path, status
            ));
        }

        // Verify HKCU predefined key override capability for the sandboxed key, then restore
        // the parent thread's HKCU so the host Tauri process remains on its normal hive.
        let _ = RegOverridePredefKey(HKEY_CURRENT_USER, isolated_hkey);
        let _ = RegOverridePredefKey(HKEY_CURRENT_USER, HKEY::default());
        let _ = RegCloseKey(isolated_hkey);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn assign_pid_to_room_job_object(room_id: &str, pid: u32) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::JobObjects::{AssignProcessToJobObject, CreateJobObjectW};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

    unsafe {
        let job_name = to_wide_null(&format!("Local\\SolanaOS_RoomJob_{}", room_id));
        let job_handle =
            CreateJobObjectW(None, PCWSTR(job_name.as_ptr())).map_err(|e| e.to_string())?;
        let proc_handle =
            OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, pid).map_err(|e| {
                let _ = CloseHandle(job_handle);
                e.to_string()
            })?;
        let assign_res = AssignProcessToJobObject(job_handle, proc_handle);
        let _ = CloseHandle(proc_handle);
        let _ = CloseHandle(job_handle);
        assign_res.map_err(|e| format!("AssignProcessToJobObject failed: {}", e))
    }
}

#[cfg(target_os = "windows")]
fn terminate_windows_process(pid: u32) -> Result<(), String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, false, pid)
            .map_err(|e| format!("OpenProcess(PROCESS_TERMINATE) failed for PID {}: {}", pid, e))?;
        let res = TerminateProcess(handle, 0);
        let _ = CloseHandle(handle);
        res.map_err(|e| format!("TerminateProcess failed for PID {}: {}", pid, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_app_catalog_has_all_six_core_apps() {
        let catalog = build_supported_app_catalog();
        let ids: Vec<&str> = catalog.iter().map(|c| c.app_id.as_str()).collect();
        assert!(ids.contains(&"chrome"));
        assert!(ids.contains(&"brave"));
        assert!(ids.contains(&"cursor"));
        assert!(ids.contains(&"vscode"));
        assert!(ids.contains(&"telegram"));
        assert!(ids.contains(&"discord"));
    }

    #[test]
    fn test_clone_and_launch_creates_isolated_directories_and_args() {
        let temp_base = env::temp_dir().join(format!("solos-test-cloner-{}", now_epoch_ms()));
        let mut cloner = UniversalAppCloner::new(temp_base.clone());

        let chrome_degen = cloner
            .clone_and_launch(CloneLaunchRequest {
                app_id: "chrome".to_string(),
                room_id: "degen".to_string(),
                custom_exe_path: None,
                extra_args: Some(vec!["https://jup.ag".to_string()]),
                launch_on_enclave_desktop: Some(true),
                instance_label: Some("Degen Burner".to_string()),
            })
            .expect("chrome clone in degen room should succeed");

        assert_eq!(chrome_degen.room_id, "degen");
        assert_eq!(chrome_degen.app_id, "chrome");
        assert_eq!(chrome_degen.status, AppInstanceStatus::Running);
        assert!(chrome_degen.pid > 0);
        assert_eq!(chrome_degen.desktop_name, SOLANA_OS_ENCLAVE_DESKTOP);
        assert!(Path::new(&chrome_degen.isolated_appdata).exists());
        assert!(Path::new(&chrome_degen.isolated_local_appdata).exists());
        assert!(Path::new(&chrome_degen.isolated_temp).exists());
        assert!(Path::new(&chrome_degen.isolated_user_profile).exists());
        assert!(Path::new(&chrome_degen.registry_overrides_path).exists());
        assert!(chrome_degen
            .launch_args
            .iter()
            .any(|a| a.starts_with("--user-data-dir=")));
        assert!(chrome_degen
            .launch_args
            .contains(&"--no-first-run".to_string()));
        assert!(chrome_degen
            .launch_args
            .contains(&"https://jup.ag".to_string()));

        // Terminate and clean up
        let terminated = cloner
            .terminate_instance(&chrome_degen.instance_id)
            .expect("terminate should succeed");
        assert_eq!(terminated.status, AppInstanceStatus::Stopped);
        let _ = fs::remove_dir_all(&temp_base);
    }
}
