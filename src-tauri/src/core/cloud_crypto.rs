use crate::error::{AppError, AppResult};
use crate::utils::crypto::get_master_password;
use aes_gcm::aead::{Aead, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, KeyInit};
use sha2::{Digest, Sha256};

const CLOUD_SNAPSHOT_KEY_PREFIX: &[u8] = b"dragonfly-cloud-snapshot-v1:";

fn derive_snapshot_key(master_password: &str) -> Key<Aes256Gcm> {
    let mut hasher = Sha256::new();
    hasher.update(CLOUD_SNAPSHOT_KEY_PREFIX);
    hasher.update(master_password.as_bytes());
    let digest = hasher.finalize();
    *Key::<Aes256Gcm>::from_slice(&digest)
}

pub fn require_master_password() -> AppResult<String> {
    get_master_password()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::Config("master password is not set".to_string()))
}

pub fn encrypt_snapshot_bytes(plaintext: &[u8]) -> AppResult<Vec<u8>> {
    let master_password = require_master_password()?;
    let key = derive_snapshot_key(&master_password);
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|error| AppError::Crypto(format!("cloud snapshot encryption failed: {error}")))?;

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(combined)
}

pub fn decrypt_snapshot_bytes(ciphertext: &[u8]) -> AppResult<Vec<u8>> {
    let master_password = require_master_password()?;
    if ciphertext.len() < 13 {
        return Err(AppError::Crypto(
            "cloud snapshot ciphertext is too short".to_string(),
        ));
    }

    let key = derive_snapshot_key(&master_password);
    let cipher = Aes256Gcm::new(&key);
    let (nonce_bytes, payload) = ciphertext.split_at(12);
    let nonce = aes_gcm::Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, payload)
        .map_err(|error| AppError::Crypto(format!("cloud snapshot decryption failed: {error}")))
}
