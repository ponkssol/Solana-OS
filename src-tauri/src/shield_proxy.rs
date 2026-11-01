//! A loopback JSON-RPC proxy handed to contained apps through `SOLANA_RPC_URL`.
//! Reads pass straight through to the configured RPC; `sendTransaction` is held
//! until the user approves it in the Shield review. Apps that ignore the variable or
//! ship their own RPC endpoint (browser extension wallets) are not covered.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

const DECISION_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_BODY: usize = 4 * 1024 * 1024;

struct Proxy {
    port: u16,
    app: AppHandle,
    upstream: Mutex<String>,
    pending: Mutex<HashMap<u64, Sender<bool>>>,
    next_id: AtomicU64,
}

static PROXY: OnceLock<Proxy> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalTx {
    id: u64,
    room: String,
    transaction: String,
    encoding: String,
}

pub fn install(app: &AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(err) => {
            eprintln!("shield proxy disabled: {err}");
            return;
        }
    };
    let Ok(addr) = listener.local_addr() else { return };
    let _ = PROXY.set(Proxy {
        port: addr.port(),
        app: app.clone(),
        upstream: Mutex::new("https://api.mainnet-beta.solana.com".into()),
        pending: Mutex::new(HashMap::new()),
        next_id: AtomicU64::new(0),
    });
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || {
                let _ = serve(stream);
            });
        }
    });
}

pub fn url_for_room(room: &str) -> Option<String> {
    PROXY.get().map(|p| format!("http://127.0.0.1:{}/room/{}", p.port, room))
}

fn serve(mut stream: TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("/").to_string();
    let mut length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 || line == "\r\n" || line == "\n" {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                length = value.trim().parse().unwrap_or(0);
            }
        }
    }
    if method == "OPTIONS" {
        return respond(&mut stream, 204, "");
    }
    if method != "POST" || length > MAX_BODY {
        return respond(&mut stream, 405, "");
    }
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body)?;
    let room = path.strip_prefix("/room/").unwrap_or("unknown").to_string();
    let reply = handle(&room, &body);
    respond(&mut stream, 200, &reply)
}

fn respond(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let head = format!(
        "HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type, solana-client\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(body.as_bytes())
}

fn rpc_error(id: &Value, message: &str) -> String {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32003, "message": message } }).to_string()
}

fn handle(room: &str, body: &[u8]) -> String {
    let Some(proxy) = PROXY.get() else { return rpc_error(&Value::Null, "Shield proxy is not running.") };
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return rpc_error(&Value::Null, "Invalid JSON-RPC body."),
    };
    let is_send = |v: &Value| v.get("method").and_then(Value::as_str) == Some("sendTransaction");
    match &parsed {
        Value::Array(items) if items.iter().any(is_send) => {
            return rpc_error(&Value::Null, "Solana OS Shield does not accept batched sendTransaction.");
        }
        single if is_send(single) => {
            let id = single.get("id").cloned().unwrap_or(Value::Null);
            if !review(proxy, room, single) {
                return rpc_error(&id, "Rejected by Solana OS Shield.");
            }
        }
        _ => {}
    }
    let upstream = proxy.upstream.lock().map(|u| u.clone()).unwrap_or_default();
    match ureq::post(&upstream)
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(30))
        .send_bytes(body)
    {
        Ok(resp) => resp.into_string().unwrap_or_else(|_| rpc_error(&Value::Null, "Unreadable upstream reply.")),
        Err(ureq::Error::Status(_, resp)) => resp.into_string().unwrap_or_default(),
        Err(err) => rpc_error(&Value::Null, &format!("Upstream RPC failed: {err}")),
    }
}

fn review(proxy: &Proxy, room: &str, request: &Value) -> bool {
    let params = request.get("params");
    let Some(transaction) = params.and_then(|p| p.get(0)).and_then(Value::as_str) else { return false };
    // The JSON-RPC default for sendTransaction is base58.
    let encoding = params
        .and_then(|p| p.get(1))
        .and_then(|c| c.get("encoding"))
        .and_then(Value::as_str)
        .unwrap_or("base58")
        .to_string();
    let id = proxy.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let (tx, rx) = channel();
    if let Ok(mut pending) = proxy.pending.lock() {
        pending.insert(id, tx);
    }
    let event = ExternalTx { id, room: room.to_string(), transaction: transaction.to_string(), encoding };
    if proxy.app.emit("shield://external-tx", event).is_err() {
        return false;
    }
    let decision = rx.recv_timeout(DECISION_TIMEOUT);
    if let Ok(mut pending) = proxy.pending.lock() {
        pending.remove(&id);
    }
    if decision.is_err() {
        // Nobody answered in time and the caller already got a rejection: take the
        // stale prompt off screen so a late click can't look like it did anything.
        let _ = proxy.app.emit("shield://external-tx-expired", id);
    }
    decision.unwrap_or(false)
}

#[tauri::command]
pub fn shield_proxy_set_upstream(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("The RPC URL must start with http:// or https://.".into());
    }
    let proxy = PROXY.get().ok_or("Shield proxy is not running.")?;
    *proxy.upstream.lock().map_err(|_| "proxy state poisoned")? = url;
    Ok(())
}

#[tauri::command]
pub fn shield_proxy_url() -> Option<String> {
    PROXY.get().map(|p| format!("http://127.0.0.1:{}/room/<room>", p.port))
}

#[tauri::command]
pub fn shield_proxy_decide(id: u64, approve: bool) {
    if let Some(proxy) = PROXY.get() {
        if let Ok(mut pending) = proxy.pending.lock() {
            if let Some(tx) = pending.remove(&id) {
                let _ = tx.send(approve);
            }
        }
    }
}
