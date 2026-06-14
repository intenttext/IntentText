pub mod commands;

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// A `.it` path the app was asked to open but the frontend hasn't drained yet.
/// Set at cold start (CLI arg on Windows/Linux, or the macOS open event) and
/// taken once by the frontend on mount — this removes the race where the OS
/// delivered the file before the webview registered its `open-file` listener
/// (which showed a blank window until you re-opened the file by hand).
#[derive(Default)]
struct PendingOpen(Mutex<Option<String>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<PendingOpen>) -> Option<String> {
    // Recover from a poisoned lock rather than panicking: the stored Option is
    // still valid, and a panic here would crash the whole app.
    state.0.lock().unwrap_or_else(|e| e.into_inner()).take()
}

/// Maps a doc-window label → the `.it` path it should open. The window drains its
/// entry once, on mount (`window_file`). The label is a hash of the path, so the
/// same file always maps to the same window → focus-or-create dedup.
#[derive(Default)]
struct DocWindows(Mutex<HashMap<String, String>>);

/// Take (once) the `.it` path a freshly-created doc window should open.
#[tauri::command]
fn window_file(window: tauri::WebviewWindow) -> Option<String> {
    let label = window.label().to_string();
    window
        .app_handle()
        .state::<DocWindows>()
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .remove(&label)
}

/// Open `path` in its own window — focus the existing one if already open, else
/// create a new doc window (labelled by a hash of the path for dedup).
#[tauri::command]
fn open_doc_window(app: tauri::AppHandle, path: String) {
    open_or_focus_doc_window(&app, &path);
}

fn doc_label(path: &str) -> String {
    let mut h: u64 = 5381;
    for b in path.bytes() {
        h = h.wrapping_mul(33).wrapping_add(b as u64);
    }
    format!("doc-{:x}", h)
}

/// Bring the app to the foreground (macOS won't auto-activate a background app
/// when it opens a file / spawns a window). set_focus alone isn't enough.
#[cfg(target_os = "macos")]
fn activate_app() {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;
    if let Some(mtm) = MainThreadMarker::new() {
        #[allow(deprecated)]
        NSApplication::sharedApplication(mtm).activateIgnoringOtherApps(true);
    }
}
#[cfg(not(target_os = "macos"))]
fn activate_app() {}

fn open_or_focus_doc_window(app: &tauri::AppHandle, path: &str) {
    let label = doc_label(path);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        activate_app();
        return;
    }
    app.state::<DocWindows>()
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(label.clone(), path.to_string());
    let title = std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Document")
        .to_string();
    let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(format!("{title} — Dotit"))
        .inner_size(1180.0, 820.0)
        .min_inner_size(720.0, 480.0)
        .focused(true)
        .build();
    if let Ok(w) = built {
        let _ = w.set_focus();
    }
    activate_app();
}

/// Minimal `file://` URL → filesystem path (with %xx decoding) so we don't pull
/// in the full `url` path API. macOS open events arrive as file URLs.
fn url_to_path(raw: &str) -> Option<String> {
    let s = raw.strip_prefix("file://").unwrap_or(raw);
    let decoded = percent_decode(s);
    if decoded.ends_with(".it") {
        Some(decoded)
    } else {
        None
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(PendingOpen::default())
        .manage(DocWindows::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Windows/Linux: the file path arrives as a CLI argument. Stash it;
            // the frontend drains it on mount via take_pending_open (no timing
            // race). macOS delivers files through RunEvent::Opened instead
            // (handled in the run loop below).
            let args: Vec<String> = std::env::args().collect();
            if let Some(p) = args.get(1) {
                if p.ends_with(".it") {
                    *app.state::<PendingOpen>()
                        .0
                        .lock()
                        .unwrap_or_else(|e| e.into_inner()) = Some(p.clone());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            take_pending_open,
            window_file,
            open_doc_window,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::write_binary_file,
            commands::fs::read_binary_file,
            commands::fs::open_external,
            commands::print::native_print,
            commands::fs::list_files,
            commands::fs::file_metadata,
            commands::fs::delete_file,
            commands::fs::rename_file,
            commands::workspace::open_folder,
            commands::workspace::watch_folder,
            commands::workspace::watch_folders,
            commands::workspace::unwatch_folder,
            commands::settings::load_settings,
            commands::settings::save_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // macOS file-open (double-click / "Open With"): delivered as Apple
        // Events, surfaced by Tauri as RunEvent::Opened with file URLs — NOT as
        // CLI args. Store the path so a cold-started frontend can drain it, and
        // emit open-file so an already-running (warm) instance opens it live.
        if let RunEvent::Opened { urls } = event {
            // Each opened file → its own window (focus the existing one, or create
            // it), and bring the app forward. Reliable: no cold/warm race.
            for u in &urls {
                if let Some(path) = url_to_path(u.as_str()) {
                    open_or_focus_doc_window(app_handle, &path);
                }
            }
        }
    });
}
