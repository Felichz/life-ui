//! Which programs hold the GPU's memory right now, so the load dialog can say
//! what to close (ADR-004).
//!
//! NVML does not report per-process memory under Windows' display driver
//! model (nvidia-smi shows "N/A"), so this reads the same counters Task
//! Manager uses: "GPU Process Memory\Dedicated Usage", per process and GPU
//! adapter. The adapter is the one whose total matches NVML's used memory.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use sysinfo::{Pid, ProcessesToUpdate, System};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
pub struct GpuProcess {
    pub pid: u32,
    pub name: String,
    pub bytes: u64,
    /// Part of Windows itself: it cannot be closed.
    pub system: bool,
    /// Part of LifeUI itself (its window is a WebView2 process): closing it would close the app.
    pub own: bool,
}

const SYSTEM: &[&str] = &[
    "dwm",
    "csrss",
    "explorer",
    "system",
    "svchost",
    "searchhost",
    "shellexperiencehost",
    "startmenuexperiencehost",
    "textinputhost",
    "applicationframehost",
    "lockapp",
];

const SCRIPT: &str = "$a=@((Get-Counter '\\GPU Adapter Memory(*)\\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples|ForEach-Object{@{i=$_.InstanceName;v=[int64]$_.CookedValue}});\
$p=@((Get-Counter '\\GPU Process Memory(*)\\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples|Where-Object{$_.CookedValue -gt 0}|ForEach-Object{@{i=$_.InstanceName;v=[int64]$_.CookedValue}});\
@{adapters=$a;processes=$p}|ConvertTo-Json -Compress -Depth 4";

fn counters() -> Result<Value, String> {
    let mut command = Command::new("powershell");
    command
        .args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
        .stdin(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    let output = command.output().map_err(|e| e.to_string())?;
    serde_json::from_slice(&output.stdout).map_err(|e| format!("GPU counters unreadable: {e}"))
}

fn samples(value: &Value) -> Vec<(String, u64)> {
    let items = match value {
        Value::Array(items) => items.clone(),
        Value::Object(_) => vec![value.clone()],
        _ => Vec::new(),
    };
    items
        .iter()
        .filter_map(|s| Some((s["i"].as_str()?.to_lowercase(), s["v"].as_u64()?)))
        .collect()
}

fn luid(instance: &str) -> Option<&str> {
    let start = instance.find("luid_")?;
    let end = instance[start..].find("_phys").map(|e| start + e)?;
    Some(&instance[start..end])
}

/// Picks the adapter whose usage is closest to `used` (NVML), then lists its
/// processes by memory, biggest first.
pub fn list(used: Option<u64>) -> Result<Vec<GpuProcess>, String> {
    let data = counters()?;
    let adapters = samples(&data["adapters"]);
    let target = adapters
        .iter()
        .filter_map(|(instance, bytes)| Some((luid(instance)?.to_string(), *bytes)))
        .min_by_key(|(_, bytes)| match used {
            Some(u) => bytes.abs_diff(u),
            None => u64::MAX - bytes,
        })
        .ok_or("No GPU adapters in the counters")?;
    let (adapter, adapter_total) = target;

    let mut by_pid: HashMap<u32, u64> = HashMap::new();
    for (instance, bytes) in samples(&data["processes"]) {
        if luid(&instance) != Some(adapter.as_str()) {
            continue;
        }
        let Some(pid) = instance
            .strip_prefix("pid_")
            .and_then(|rest| rest.split('_').next())
            .and_then(|n| n.parse::<u32>().ok())
        else {
            continue;
        };
        *by_pid.entry(pid).or_default() += bytes;
    }

    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    let mut list: Vec<GpuProcess> = by_pid
        .into_iter()
        // A process can't hold more than the whole adapter (Windows' compositor sometimes reports it)
        .filter(|(_, bytes)| *bytes <= adapter_total)
        .map(|(pid, bytes)| {
            let name = system
                .process(Pid::from_u32(pid))
                .map(|p| {
                    p.name()
                        .to_string_lossy()
                        .trim_end_matches(".exe")
                        .to_string()
                })
                .unwrap_or_else(|| format!("PID {pid}"));
            let system_process = SYSTEM.contains(&name.to_lowercase().as_str());
            GpuProcess {
                pid,
                name,
                bytes,
                system: system_process,
                own: descends_from(
                    &system,
                    Pid::from_u32(pid),
                    Pid::from_u32(std::process::id()),
                ),
            }
        })
        .collect();
    list.sort_by_key(|p| std::cmp::Reverse(p.bytes));
    Ok(list)
}

/// Is `pid` the process `ancestor`, or one started (directly or not) by it?
fn descends_from(system: &System, pid: Pid, ancestor: Pid) -> bool {
    let mut current = Some(pid);
    // A parent chain is short; the bound only guards against a cycle of reused ids
    for _ in 0..32 {
        match current {
            Some(p) if p == ancestor => return true,
            Some(p) => current = system.process(p).and_then(|process| process.parent()),
            None => return false,
        }
    }
    false
}

/// The program a process belongs to: the topmost ancestor with the same
/// executable name. Chrome's GPU memory sits in a child process that Chrome
/// starts again when it dies, so freeing it means closing Chrome itself.
fn program_root(system: &System, pid: Pid) -> Pid {
    let Some(name) = system.process(pid).map(|p| p.name().to_os_string()) else {
        return pid;
    };
    let mut root = pid;
    for _ in 0..32 {
        let parent = system
            .process(root)
            .and_then(|p| p.parent())
            .and_then(|parent| {
                system
                    .process(parent)
                    .map(|p| (parent, p.name().to_os_string()))
            });
        match parent {
            Some((parent_pid, parent_name)) if parent_name == name => root = parent_pid,
            _ => break,
        }
    }
    root
}

/// Closes the program a GPU process belongs to, to free its memory (ADR-004).
/// First the polite way (the program is asked to close, and may ask about
/// unsaved work); with `force` it is ended, and what was not saved is lost.
/// Returns whether the process is gone. Windows' own processes and LifeUI
/// itself are refused here too, whatever the interface sent.
pub fn close(pid: u32, force: bool) -> Result<bool, String> {
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    let target = Pid::from_u32(pid);
    let Some(process) = system.process(target) else {
        return Ok(true);
    };
    let name = process
        .name()
        .to_string_lossy()
        .trim_end_matches(".exe")
        .to_lowercase();
    if pid <= 4 || SYSTEM.contains(&name.as_str()) {
        return Err("That process is part of Windows".into());
    }
    if descends_from(&system, target, Pid::from_u32(std::process::id())) {
        return Err("That process is part of LifeUI".into());
    }
    let root = program_root(&system, target);

    let mut command = Command::new("taskkill");
    command.args(["/PID", &root.as_u32().to_string(), "/T"]);
    if force {
        command.arg("/F");
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    command.status().map_err(|e| e.to_string())?;

    // A program asked to close takes a moment; one that shows a "save?" dialog stays
    for _ in 0..12 {
        std::thread::sleep(std::time::Duration::from_millis(250));
        system.refresh_processes(ProcessesToUpdate::Some(&[target]), true);
        if system.process(target).is_none() {
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub async fn close_process(pid: u32, force: bool) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || close(pid, force))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gpu_processes() -> Result<Vec<GpuProcess>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let used = nvml_wrapper::Nvml::init()
            .ok()
            .and_then(|nvml| nvml.device_by_index(0).ok()?.memory_info().ok())
            .map(|m| m.used);
        list(used)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::{list, luid};

    /// Reads this machine's real counters: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn lists_this_machines_gpu_processes() {
        for p in list(None).expect("counters").iter().take(8) {
            println!(
                "{:>6} MiB  {}  {}{}{}",
                p.bytes / 1_048_576,
                p.pid,
                p.name,
                if p.system { "  (Windows)" } else { "" },
                if p.own { "  (LifeUI)" } else { "" }
            );
        }
    }

    /// Starts a harmless process of its own (a ping that would run for a
    /// minute) and closes it: nothing that was already running is touched.
    #[cfg(windows)]
    #[test]
    fn refuses_its_own_processes_and_counts_a_gone_one_as_closed() {
        use super::close;
        use std::os::windows::process::CommandExt;
        use std::process::{Command, Stdio};

        let mut child = Command::new("ping")
            .args(["-n", "60", "127.0.0.1"])
            .stdout(Stdio::null())
            // Detached, so it is not a descendant "of LifeUI" for the refusal below
            .creation_flags(0x0000_0008)
            .spawn()
            .expect("ping starts");
        let pid = child.id();
        // A child of this test process counts as the app's own: it is refused
        assert!(close(pid, true).is_err());
        let _ = child.kill();
        let _ = child.wait();

        // The test process itself is refused too, and a pid that is gone counts as closed
        assert!(close(std::process::id(), true).is_err());
        assert_eq!(close(pid, true), Ok(true));
    }

    /// The real path, on a process that is not the app's own: a ping started
    /// through PowerShell, whose parent is gone by the time it is closed. It
    /// has no window, so asking politely leaves it running and forcing ends it.
    #[cfg(windows)]
    #[test]
    fn asks_first_and_forces_only_when_told() {
        use super::close;
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(Start-Process ping -ArgumentList '-n','60','127.0.0.1' -WindowStyle Hidden -PassThru).Id",
            ])
            .output()
            .expect("powershell runs");
        let pid: u32 = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse()
            .expect("a pid");

        assert_eq!(close(pid, false), Ok(false));
        assert_eq!(close(pid, true), Ok(true));
    }

    #[test]
    fn reads_the_adapter_from_an_instance_name() {
        assert_eq!(
            luid("pid_39652_luid_0x00000000_0x42e8af06_phys_0"),
            Some("luid_0x00000000_0x42e8af06")
        );
        assert_eq!(
            luid("luid_0x00000000_0x42e8af06_phys_0"),
            Some("luid_0x00000000_0x42e8af06")
        );
        assert_eq!(luid("nothing"), None);
    }
}
