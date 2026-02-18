use std::process::{Command, Child};
use std::sync::Mutex;
use std::env;
use tauri::Manager;

struct ApiServer(Mutex<Option<Child>>);

fn start_api_server() -> Result<Child, std::io::Error> {
    let exe_path = env::current_exe()?;

    // Navigate from the executable to the project root
    // In dev: dashboard/src-tauri/target/debug/haan-ai
    let project_root = if cfg!(debug_assertions) {
        exe_path
            .parent().unwrap() // target/debug
            .parent().unwrap() // target
            .parent().unwrap() // src-tauri
            .parent().unwrap() // dashboard
            .parent().unwrap() // project root
            .to_path_buf()
    } else {
        // Production: use the resource directory
        exe_path
            .parent().unwrap() // MacOS
            .parent().unwrap() // Contents
            .parent().unwrap() // haan-ai.app
            .parent().unwrap() // bundle/macos
            .parent().unwrap() // bundle
            .parent().unwrap() // release
            .parent().unwrap() // target
            .parent().unwrap() // src-tauri
            .parent().unwrap() // dashboard
            .parent().unwrap() // project root
            .to_path_buf()
    };

    let backend_dir = project_root.join("backend");

    println!("Starting Python API server from: {:?}", backend_dir);

    Command::new("python3")
        .arg("-m")
        .arg("uvicorn")
        .arg("haan.api.server:app")
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg("8000")
        .current_dir(&backend_dir)
        .spawn()
}

fn kill_api_server(state: &ApiServer) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            let _ = child.wait();
            println!("API server stopped");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Start the Python API server
      match start_api_server() {
        Ok(child) => {
          println!("API server started (PID: {})", child.id());
          app.manage(ApiServer(Mutex::new(Some(child))));
        }
        Err(e) => {
          eprintln!("Failed to start API server: {}", e);
          app.manage(ApiServer(Mutex::new(None)));
        }
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::Destroyed = event {
        // Kill API server when window closes
        let state = window.state::<ApiServer>();
        kill_api_server(&state);
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
