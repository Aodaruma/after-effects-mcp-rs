use anyhow::{Context, Result};
use mcp_core::AppConfig;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CommandStatus {
    Pending,
    Running,
    Completed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommandFile {
    pub command: String,
    #[serde(default)]
    pub args: serde_json::Value,
    pub timestamp: String,
    pub status: CommandStatus,
}

pub fn ensure_bridge_dir(cfg: &AppConfig) -> Result<()> {
    fs::create_dir_all(&cfg.bridge.root_dir).with_context(|| {
        format!(
            "failed to create bridge directory: {}",
            cfg.bridge.root_dir.display()
        )
    })?;
    Ok(())
}

pub fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let raw = serde_json::to_string_pretty(value).with_context(|| "failed to serialize JSON")?;
    fs::write(path, raw).with_context(|| format!("failed to write file: {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn ensure_bridge_dir_creates_directory() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path().join("ae-mcp-bridge");
        let cfg = AppConfig {
            bridge: mcp_core::BridgePaths {
                root_dir: root.clone(),
                command_file: root.join("ae_command.json"),
                result_file: root.join("ae_mcp_result.json"),
            },
            ..AppConfig::default()
        };

        ensure_bridge_dir(&cfg).expect("bridge dir should be created");
        assert!(root.is_dir());
    }
}

