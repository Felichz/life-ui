//! Local model runtimes: LM Studio and Ollama (ADR-004).
//!
//! Rust finds the executables, checks whether their servers answer, starts
//! them, and drives LM Studio's CLI (`lms`), which lists models with their
//! metadata, estimates a load without doing it, and loads. Ollama's model
//! list and loading go over its HTTP API from the frontend.

use serde::Serialize;
use serde_json::Value;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// No console window flashes when a CLI runs.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const LMSTUDIO_PORT: u16 = 1234;
pub const OLLAMA_PORT: u16 = 11434;

fn quiet(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command.stdin(Stdio::null())
}

/// An executable on the PATH, or at one of the places its installer puts it.
fn find(name: &str, defaults: &[PathBuf]) -> Option<PathBuf> {
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            let candidate = dir.join(&exe);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    defaults.iter().find(|p| p.is_file()).cloned()
}

fn home() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_default()
}

fn lms() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "lms.exe" } else { "lms" };
    find("lms", &[home().join(".lmstudio").join("bin").join(exe)])
}

fn ollama() -> Option<PathBuf> {
    let mut defaults = Vec::new();
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        defaults.push(
            PathBuf::from(local)
                .join("Programs")
                .join("Ollama")
                .join("ollama.exe"),
        );
    }
    defaults.push(PathBuf::from("/usr/local/bin/ollama"));
    find("ollama", &defaults)
}

fn answers(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_ok()
}

#[derive(Serialize)]
pub struct Runtime {
    pub installed: bool,
    pub running: bool,
    pub port: u16,
}

#[derive(Serialize)]
pub struct Runtimes {
    pub lmstudio: Runtime,
    pub ollama: Runtime,
}

#[tauri::command]
pub fn runtime_status() -> Runtimes {
    Runtimes {
        lmstudio: Runtime {
            installed: lms().is_some(),
            running: answers(LMSTUDIO_PORT),
            port: LMSTUDIO_PORT,
        },
        ollama: Runtime {
            installed: ollama().is_some(),
            running: answers(OLLAMA_PORT),
            port: OLLAMA_PORT,
        },
    }
}

fn run_lms(args: &[&str]) -> Result<String, String> {
    let path = lms().ok_or("LM Studio's CLI (lms) was not found")?;
    let output = quiet(&mut Command::new(path))
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if output.status.success() {
        Ok(text)
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(if err.trim().is_empty() { text } else { err })
    }
}

/// `lms ls --json`, language models only.
#[tauri::command]
pub async fn lmstudio_models() -> Result<Value, String> {
    let text = tauri::async_runtime::spawn_blocking(|| run_lms(&["ls", "--json"]))
        .await
        .map_err(|e| e.to_string())??;
    let all: Value = serde_json::from_str(text.trim()).map_err(|e| e.to_string())?;
    let llms: Vec<Value> = all
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|m| m["type"] == "llm")
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    Ok(Value::Array(llms))
}

/// `lms ps --json`: the models loaded right now.
#[tauri::command]
pub async fn lmstudio_loaded() -> Result<Value, String> {
    let text = tauri::async_runtime::spawn_blocking(|| run_lms(&["ps", "--json"]))
        .await
        .map_err(|e| e.to_string())??;
    serde_json::from_str(text.trim()).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct Estimate {
    pub gpu_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub raw: String,
}

fn gib_line(text: &str, label: &str) -> Option<u64> {
    let line = text.lines().find(|l| l.contains(label))?;
    let value = line.split(':').nth(1)?.trim();
    let mut parts = value.split_whitespace();
    let number: f64 = parts.next()?.replace(',', "").parse().ok()?;
    let factor = match parts.next().unwrap_or("GiB") {
        "MiB" => 1024.0 * 1024.0,
        "KiB" => 1024.0,
        "TiB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => 1024.0 * 1024.0 * 1024.0,
    };
    Some((number * factor) as u64)
}

/// LM Studio's own estimate of a full-GPU load, without loading anything.
#[tauri::command]
pub async fn lmstudio_estimate(model: String, context: u32) -> Result<Estimate, String> {
    let raw = tauri::async_runtime::spawn_blocking(move || {
        run_lms(&[
            "load",
            &model,
            "--estimate-only",
            "--gpu",
            "max",
            "-c",
            &context.to_string(),
        ])
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(Estimate {
        gpu_bytes: gib_line(&raw, "Estimated GPU Memory"),
        total_bytes: gib_line(&raw, "Estimated Total Memory"),
        raw,
    })
}

/// Loads a model in LM Studio. `gpu` is "max" for a full GPU load, a ratio
/// between 0 and 1, or "auto" to let LM Studio split it between GPU and RAM.
#[tauri::command]
pub async fn lmstudio_load(model: String, context: u32, gpu: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = context.to_string();
        let mut args = vec![
            "load",
            model.as_str(),
            "-c",
            context.as_str(),
            "-y",
            "--identifier",
            model.as_str(),
        ];
        if gpu != "auto" {
            args.extend(["--gpu", gpu.as_str()]);
        }
        run_lms(&args)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Unloads a model from LM Studio, freeing its memory.
#[tauri::command]
pub async fn lmstudio_unload(model: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_lms(&["unload", &model]))
        .await
        .map_err(|e| e.to_string())?
}

/// Starts a runtime's server and waits up to ten seconds for it to answer.
#[tauri::command]
pub async fn start_runtime(runtime: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let port = match runtime.as_str() {
            "lmstudio" => {
                run_lms(&["server", "start", "--port", &LMSTUDIO_PORT.to_string()])?;
                LMSTUDIO_PORT
            }
            "ollama" => {
                let path = ollama().ok_or("Ollama was not found")?;
                quiet(&mut Command::new(path))
                    .arg("serve")
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .map_err(|e| e.to_string())?;
                OLLAMA_PORT
            }
            other => return Err(format!("Unknown runtime: {other}")),
        };
        for _ in 0..40 {
            if answers(port) {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err(format!(
            "The {runtime} server did not answer on port {port}"
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::gib_line;

    #[test]
    fn reads_the_estimate_lines() {
        let raw = "Model: qwen/qwen3.5-9b\nContext Length: 16,384\nGPU Offload: 100%\nEstimated GPU Memory:   7.57 GiB\nEstimated Total Memory: 7.57 GiB\n";
        let gib = 1024.0_f64 * 1024.0 * 1024.0;
        assert_eq!(
            gib_line(raw, "Estimated GPU Memory"),
            Some((7.57 * gib) as u64)
        );
        assert_eq!(
            gib_line(raw, "Estimated Total Memory"),
            Some((7.57 * gib) as u64)
        );
        assert_eq!(gib_line(raw, "Missing"), None);
    }
}
