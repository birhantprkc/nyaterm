use std::sync::Arc;
use tauri::Manager;

use crate::core::{CloudSyncManager, QuickCommandsStore, SessionManager};

pub fn setup(
    app: &mut tauri::App,
    session_manager: Arc<SessionManager>,
    quick_commands_store: Arc<QuickCommandsStore>,
    cloud_sync_manager: Arc<CloudSyncManager>,
) -> Result<(), Box<dyn std::error::Error>> {
    let home_dir = app
        .path()
        .home_dir()
        .map_err(|e: tauri::Error| e.to_string())?;

    let settings_load = crate::config::load_app_settings(app.handle());
    let diagnostics = settings_load
        .as_ref()
        .map(|settings| settings.diagnostics.clone())
        .unwrap_or_default();
    let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    crate::observability::init_tracing(log_dir, &diagnostics);

    if let Err(error) = settings_load {
        crate::observability::log_event(crate::observability::StructuredLog {
            level: crate::observability::StructuredLogLevel::Warn,
            domain: "settings.persistence".to_string(),
            event: "settings.load_failed".to_string(),
            message: "Failed to load app settings before tracing initialization".to_string(),
            ids: None,
            data: None,
            error: Some(serde_json::json!({ "message": error.to_string() })),
            client_timestamp: None,
        });
    }

    session_manager.set_app_handle(app.handle().clone());

    // Restore the master password for wrapping-key derivation.
    if let Ok(settings) = crate::config::load_app_settings(app.handle()) {
        if let Some(ref ct) = settings.security.master_password {
            if let Ok(plain) = crate::utils::crypto::decrypt_settings_secret(ct) {
                crate::utils::crypto::set_master_password(Some(plain));
            }
        }
    }

    let config_dir = home_dir.join(".dragonfly");
    let mgr = session_manager.clone();
    tauri::async_runtime::spawn(async move {
        mgr.init_history_store(config_dir).await;
    });

    if let Err(error) = quick_commands_store.load_from_disk(app.handle()) {
        tracing::warn!("Failed to load quick commands: {}", error);
    }

    let app_handle = app.handle().clone();
    let sync_manager = cloud_sync_manager.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = sync_manager.init(app_handle).await {
            tracing::warn!("Failed to initialize cloud sync manager: {}", error);
        }
    });

    let _tray = tauri::tray::TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Dragonfly")
        .on_tray_icon_event(|tray, event| match event {
            tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } => {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "main" {
            if let Ok(settings) = crate::config::load_app_settings(window.app_handle()) {
                if settings.general.minimize_to_tray {
                    let _ = window.hide();
                    api.prevent_close();
                    return;
                }
            }

            let session_manager = window.state::<Arc<SessionManager>>();
            session_manager.flush_history_before_shutdown();

            for label in &["settings", "new-session", "quick-command"] {
                if let Some(child) = window.app_handle().get_webview_window(label) {
                    let _ = child.close();
                }
            }
        }
    }
}
