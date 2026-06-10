use std::time::Duration;

#[tauri::command]
pub async fn read_clipboard_text() -> Option<String> {
    let result = tokio::time::timeout(
        Duration::from_millis(1000),
        tokio::task::spawn_blocking(|| {
            let mut clipboard = arboard::Clipboard::new().ok()?;
            clipboard.get_text().ok()
        }),
    )
    .await;

    match result {
        Ok(Ok(text)) => text,
        _ => None,
    }
}
