use std::sync::Arc;

use crate::config::{CloudSyncHistoryEntry, CloudSyncStatus, RemoteBackupEntry};
use crate::core::CloudSyncManager;
use crate::error::AppResult;

#[tauri::command]
pub async fn test_cloud_sync_connection(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
) -> AppResult<()> {
    manager.test_connection().await
}

#[tauri::command]
pub async fn get_cloud_sync_status(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
) -> AppResult<CloudSyncStatus> {
    Ok(manager.get_status().await)
}

#[tauri::command]
pub async fn sync_push_now(manager: tauri::State<'_, Arc<CloudSyncManager>>) -> AppResult<()> {
    manager.inner().sync_push_now("manual_push").await
}

#[tauri::command]
pub async fn sync_pull_now(manager: tauri::State<'_, Arc<CloudSyncManager>>) -> AppResult<()> {
    manager.inner().sync_pull_now("manual_pull").await
}

#[tauri::command]
pub async fn resolve_cloud_sync_conflict(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
    action: String,
) -> AppResult<()> {
    manager.inner().resolve_cloud_sync_conflict(&action).await
}

#[tauri::command]
pub async fn run_cloud_backup_now(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
) -> AppResult<()> {
    manager.inner().run_cloud_backup_now("manual_backup").await
}

#[tauri::command]
pub async fn list_cloud_sync_history(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
) -> AppResult<Vec<CloudSyncHistoryEntry>> {
    Ok(manager.list_history().await)
}

#[tauri::command]
pub async fn list_remote_backups(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
) -> AppResult<Vec<RemoteBackupEntry>> {
    manager.list_remote_backups().await
}

#[tauri::command]
pub async fn restore_remote_backup(
    manager: tauri::State<'_, Arc<CloudSyncManager>>,
    revision: String,
) -> AppResult<()> {
    manager
        .inner()
        .restore_remote_backup(&revision, "manual_restore_backup")
        .await
}
