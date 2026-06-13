//! Native print — drives the platform webview's AppKit print path
//! (`-[WKWebView printOperationWithPrintInfo:]`), which shows the real macOS
//! print panel. WKWebView's JavaScript `window.print()` does not reliably open
//! the panel inside Tauri; the native NSPrintOperation does.
//!
//! The frontend isolates the document into the main webview's DOM (an
//! `#it-print-root` container + an `@media print` sheet), then calls this; the
//! print operation renders the webview honoring the print stylesheet. The call
//! blocks (via a channel) until the panel is dismissed, so the frontend can
//! safely tear the print DOM down afterwards.

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn native_print(window: tauri::WebviewWindow) -> Result<(), String> {
    use objc2_app_kit::NSPrintInfo;
    use objc2_web_kit::WKWebView;
    use std::sync::mpsc::channel;

    let (tx, rx) = channel::<Result<(), String>>();

    // The closure runs on the MAIN thread (Tauri posts it to the event loop), so
    // the AppKit modal print operation is invoked correctly.
    window
        .with_webview(move |webview| {
            let result = (|| -> Result<(), String> {
                let ptr = webview.inner() as *mut WKWebView;
                if ptr.is_null() {
                    return Err("native print: null WKWebView handle".into());
                }
                // SAFETY: `ptr` is the live WKWebView owned by the window; we only
                // borrow it for the duration of this main-thread closure.
                let wk: &WKWebView = unsafe { &*ptr };
                let info = NSPrintInfo::sharedPrintInfo();
                let op = unsafe { wk.printOperationWithPrintInfo(&info) };
                op.setShowsPrintPanel(true);
                op.setShowsProgressPanel(true);
                op.runOperation();
                Ok(())
            })();
            let _ = tx.send(result);
        })
        .map_err(|e| format!("native print: {e}"))?;

    rx.recv()
        .map_err(|_| "native print: closure did not run".to_string())?
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn native_print(_window: tauri::WebviewWindow) -> Result<(), String> {
    Err("native print is only implemented on macOS".into())
}
