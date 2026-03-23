use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const ALLOWED_SCRIPTS: &[&str] = &[
    "listCompositions",
    "getProjectInfo",
    "getLayerInfo",
    "createComposition",
    "createTextLayer",
    "createShapeLayer",
    "createSolidLayer",
    "setLayerProperties",
    "setLayerKeyframe",
    "setLayerExpression",
    "applyEffect",
    "applyEffectTemplate",
    "test-animation",
    "bridgeTestEffects",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BridgePaths {
    pub root_dir: PathBuf,
    pub command_file: PathBuf,
    pub result_file: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppConfig {
    pub bridge: BridgePaths,
    pub poll_interval_ms: u64,
    pub result_timeout_ms: u64,
    pub log_level: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let root_dir = default_bridge_root_dir();
        let command_file = root_dir.join("ae_command.json");
        let result_file = root_dir.join("ae_mcp_result.json");

        Self {
            bridge: BridgePaths {
                root_dir,
                command_file,
                result_file,
            },
            poll_interval_ms: 250,
            result_timeout_ms: 5_000,
            log_level: "info".to_string(),
        }
    }
}

impl AppConfig {
    pub fn load(config_path: Option<&Path>) -> Result<Self> {
        if let Some(path) = config_path {
            let raw = fs::read_to_string(path)
                .with_context(|| format!("failed to read config file: {}", path.display()))?;
            let cfg: AppConfig =
                toml::from_str(&raw).with_context(|| "failed to parse TOML config")?;
            Ok(cfg)
        } else {
            Ok(Self::default())
        }
    }
}

pub fn default_bridge_root_dir() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join("Documents").join("ae-mcp-bridge")
}

pub fn is_allowed_script(script: &str) -> bool {
    ALLOWED_SCRIPTS.contains(&script)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_expected_files() {
        let cfg = AppConfig::default();
        assert!(cfg.bridge.command_file.ends_with("ae_command.json"));
        assert!(cfg.bridge.result_file.ends_with("ae_mcp_result.json"));
        assert_eq!(cfg.poll_interval_ms, 250);
    }
}
