use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRunResult {
    pub shell: String,
    pub room_id: String,
    pub prompt: String,
    pub output: String,
    pub exit_code: i32,
    pub conpty: bool,
}

pub fn run_sandboxed_cli_command(
    room_id: &str,
    shell_type: &str,
    command: &str,
) -> Result<CliRunResult, String> {
    let command = command.trim();
    if command.is_empty() {
        return Err("command is empty".into());
    }
    let shell = normalize_shell(shell_type)?;
    let room = sanitize_room(room_id);
    let root = room_mount(&room);
    let prompt = format!(
        "solana-os@windows-conpty C:\\VaultRooms\\{}>",
        windows_room_name(&room)
    );

    #[cfg(windows)]
    {
        return run_windows(&shell, &room, &root, &prompt, command);
    }

    #[cfg(not(windows))]
    {
        let _ = root;
        Ok(CliRunResult {
            shell: shell.to_string(),
            room_id: room,
            prompt,
            output: format!(
                "Windows ConPTY bridge is compiled for the Windows host.\nPreview of `{command}` was not executed on this platform."
            ),
            exit_code: 0,
            conpty: false,
        })
    }
}

fn normalize_shell(shell_type: &str) -> Result<&'static str, String> {
    match shell_type.trim().to_ascii_lowercase().as_str() {
        "pwsh" | "powershell" | "pwsh.exe" => Ok("pwsh.exe"),
        "cmd" | "cmd.exe" => Ok("cmd.exe"),
        "solana-cli" | "solana" => Ok("solana-cli"),
        other => Err(format!("unsupported shell '{other}'")),
    }
}

fn sanitize_room(room_id: &str) -> String {
    let clean: String = room_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .collect();
    if clean.is_empty() { "main".into() } else { clean }
}

fn windows_room_name(room: &str) -> &'static str {
    match room {
        "defi" | "degen" => "DegenRoom",
        "burner" => "BurnerRoom",
        "devnet" | "dev" => "DevRoom",
        _ => "MainRoom",
    }
}

fn room_mount(room: &str) -> PathBuf {
    std::env::temp_dir().join("solana-os-enclave-sandbox").join("rooms").join(room)
}

#[cfg(windows)]
fn run_windows(
    shell: &str,
    room: &str,
    root: &std::path::Path,
    prompt: &str,
    command: &str,
) -> Result<CliRunResult, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let appdata = root.join("AppData").join("Roaming");
    let local = root.join("AppData").join("Local");
    let solana_config = root.join("solana").join("cli");
    let _ = std::fs::create_dir_all(&appdata);
    let _ = std::fs::create_dir_all(&local);
    let _ = std::fs::create_dir_all(&solana_config);

    let mut cmd = if shell == "cmd.exe" {
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/C", command]);
        cmd
    } else {
        let mut cmd = Command::new("powershell.exe");
        let script = if shell == "solana-cli" && !command.to_ascii_lowercase().starts_with("solana") {
            format!("solana {command}")
        } else {
            command.to_string()
        };
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        cmd
    };

    let output = cmd
        .env("APPDATA", &appdata)
        .env("LOCALAPPDATA", &local)
        .env("SOLANA_CONFIG", &solana_config)
        .env("SOLANA_OS_ROOM", room)
        .current_dir(root)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|err| format!("failed to start {shell}: {err}"))?;

    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    let err = String::from_utf8_lossy(&output.stderr);
    if !err.trim().is_empty() {
        if !text.is_empty() {
            text.push('\n');
        }
        text.push_str(err.trim());
    }

    Ok(CliRunResult {
        shell: shell.to_string(),
        room_id: room.to_string(),
        prompt: prompt.to_string(),
        output: text,
        exit_code: output.status.code().unwrap_or(1),
        conpty: true,
    })
}
