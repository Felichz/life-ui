//! LifeUI desktop (ADR-003): the web frontend in the system WebView, plus
//! what a browser cannot do: the state file, the PC's resources and the
//! local model runtimes.

mod gpu_processes;
mod resources;
mod runtimes;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        // Links in the chat (the sources of a web search) open in the person's browser
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // The window is made here, not from the config alone: a portable copy
            // keeps the WebView's own data (the conversations) beside it too
            let config = app
                .config()
                .app
                .windows
                .first()
                .cloned()
                .ok_or("no window in tauri.conf.json")?;
            let mut window = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
            if let Some(dir) = state::portable_dir() {
                window = window.data_directory(dir.join("webview"));
            }
            window.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            state::read_state,
            state::write_state,
            state::clear_state,
            resources::system_resources,
            gpu_processes::gpu_processes,
            gpu_processes::close_process,
            runtimes::runtime_status,
            runtimes::lmstudio_models,
            runtimes::lmstudio_loaded,
            runtimes::lmstudio_estimate,
            runtimes::lmstudio_load,
            runtimes::lmstudio_unload,
            runtimes::start_runtime,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LifeUI");
}
