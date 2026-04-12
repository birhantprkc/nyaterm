//! SSH session creation, TOFU known_hosts verification, and I/O loop.
//!
//! Split by concern so connection setup, auth flow, and terminal I/O remain
//! independently maintainable as the SSH feature set grows.

mod auth;
mod client;
mod io;
pub(crate) mod osc;
mod session;
pub(crate) mod sftp;
mod tunnel;

pub(crate) use auth::load_saved_ssh_config;
pub use auth::PendingAuthManager;
pub(crate) use client::{SshConnectionHandles, SshHandle, SshRawHandle};
pub use session::{create_ssh_handle, create_ssh_session};
pub(crate) use tunnel::TunnelManager;
