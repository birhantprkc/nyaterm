use crate::error::AppResult;

#[tauri::command]
pub async fn export_config(app: tauri::AppHandle, output_path: String) -> AppResult<()> {
    crate::core::backup::export_config(&app, &output_path).await
}

#[tauri::command]
pub async fn import_config(app: tauri::AppHandle, file_path: String) -> AppResult<()> {
    crate::core::backup::import_config(&app, &file_path).await?;
    crate::core::cloud_sync::notify_config_changed(&app).await;
    Ok(())
}
