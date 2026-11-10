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
            let system = SYSTEM.contains(&name.to_lowercase().as_str());
            GpuProcess {
                pid,
                name,
                bytes,
                system,
            }
        })
        .collect();
    list.sort_by_key(|p| std::cmp::Reverse(p.bytes));
    Ok(list)
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
                "{:>6} MiB  {}  {}{}",
                p.bytes / 1_048_576,
                p.pid,
                p.name,
                if p.system { "  (Windows)" } else { "" }
            );
        }
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
