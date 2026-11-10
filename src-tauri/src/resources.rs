//! What the PC has free right now, for the model load dialog (ADR-004).
//! RAM comes from sysinfo; VRAM from NVML on NVIDIA GPUs. When VRAM cannot
//! be read the list of GPUs is empty and `vram_note` says why, so the UI
//! can say so instead of guessing.

use nvml_wrapper::Nvml;
use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
pub struct Gpu {
    pub name: String,
    pub vram_total: u64,
    pub vram_used: u64,
    pub vram_free: u64,
}

#[derive(Serialize)]
pub struct Resources {
    pub ram_total: u64,
    pub ram_available: u64,
    pub gpus: Vec<Gpu>,
    pub vram_note: Option<String>,
}

fn gpus() -> Result<Vec<Gpu>, String> {
    let nvml = Nvml::init().map_err(|e| format!("NVML unavailable: {e}"))?;
    let count = nvml.device_count().map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for index in 0..count {
        let device = nvml.device_by_index(index).map_err(|e| e.to_string())?;
        let memory = device.memory_info().map_err(|e| e.to_string())?;
        list.push(Gpu {
            name: device.name().unwrap_or_else(|_| format!("GPU {index}")),
            vram_total: memory.total,
            vram_used: memory.used,
            vram_free: memory.free,
        });
    }
    Ok(list)
}

/// Bytes throughout.
#[tauri::command]
pub fn system_resources() -> Resources {
    let mut system = System::new();
    system.refresh_memory();
    let (gpus, vram_note) = match gpus() {
        Ok(list) if !list.is_empty() => (list, None),
        Ok(_) => (Vec::new(), Some("No NVIDIA GPU found".to_string())),
        Err(note) => (Vec::new(), Some(note)),
    };
    Resources {
        ram_total: system.total_memory(),
        ram_available: system.available_memory(),
        gpus,
        vram_note,
    }
}
