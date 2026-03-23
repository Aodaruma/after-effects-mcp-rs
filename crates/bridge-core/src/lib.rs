use anyhow::{Context, Result};
use mcp_core::AppConfig;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::{Duration, SystemTime};
use thiserror::Error;

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
    pub args: Value,
    pub timestamp: String,
    pub status: CommandStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WaitingResult {
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("no result file found at {0}")]
    MissingResultFile(String),
    #[error("timed out waiting for bridge result{0}")]
    Timeout(String),
}

#[derive(Debug, Clone)]
pub struct BridgeClient {
    cfg: AppConfig,
}

impl BridgeClient {
    pub fn new(cfg: AppConfig) -> Result<Self> {
        ensure_bridge_dir(&cfg)?;
        Ok(Self { cfg })
    }

    pub fn config(&self) -> &AppConfig {
        &self.cfg
    }

    pub fn write_command_file(&self, command: &str, args: Value) -> Result<()> {
        let payload = CommandFile {
            command: command.to_string(),
            args,
            timestamp: chrono_like_timestamp(),
            status: CommandStatus::Pending,
        };
        write_json_file(&self.cfg.bridge.command_file, &payload)
    }

    pub fn clear_results_file(&self) -> Result<()> {
        let payload = WaitingResult {
            status: "waiting".to_string(),
            message: "Waiting for new result from After Effects...".to_string(),
            timestamp: chrono_like_timestamp(),
        };
        write_json_file(&self.cfg.bridge.result_file, &payload)
    }

    pub fn read_results_raw(&self) -> Result<String> {
        let path = &self.cfg.bridge.result_file;
        if !path.exists() {
            return Err(BridgeError::MissingResultFile(path.display().to_string()).into());
        }
        fs::read_to_string(path)
            .with_context(|| format!("failed to read result file: {}", path.display()))
    }

    pub fn read_results_with_stale_warning(&self, stale_threshold: Duration) -> Result<String> {
        let path = &self.cfg.bridge.result_file;
        if !path.exists() {
            return Ok(json_text(&serde_json::json!({
                "error": "No results file found. Please run a script in After Effects first."
            }))?);
        }

        let metadata =
            fs::metadata(path).with_context(|| format!("failed to stat file: {}", path.display()))?;
        let modified = metadata
            .modified()
            .unwrap_or_else(|_| SystemTime::now() - stale_threshold);
        let content = fs::read_to_string(path)
            .with_context(|| format!("failed to read result file: {}", path.display()))?;

        if let Ok(age) = SystemTime::now().duration_since(modified) {
            if age > stale_threshold {
                return Ok(json_text(&serde_json::json!({
                    "warning": "Result file appears to be stale (not recently updated).",
                    "message": "This could indicate After Effects is not properly writing results or the MCP Bridge Auto panel is not running.",
                    "ageSeconds": age.as_secs(),
                    "originalContent": content
                }))?);
            }
        }

        Ok(content)
    }

    pub fn wait_for_bridge_result(
        &self,
        expected_command: Option<&str>,
        timeout: Duration,
        poll_interval: Duration,
    ) -> Result<String> {
        let start = SystemTime::now();
        loop {
            if self.cfg.bridge.result_file.exists() {
                let content = self.read_results_raw()?;
                if content.trim().is_empty() {
                    // continue polling
                } else if let Ok(value) = serde_json::from_str::<Value>(&content) {
                    let matched = expected_command
                        .map(|cmd| value.get("_commandExecuted").and_then(Value::as_str) == Some(cmd))
                        .unwrap_or(true);
                    if matched {
                        return Ok(content);
                    }
                }
            }

            if elapsed_since(start) >= timeout {
                let suffix = expected_command
                    .map(|x| format!(" for command '{x}'"))
                    .unwrap_or_default();
                return Err(BridgeError::Timeout(suffix).into());
            }

            thread::sleep(poll_interval);
        }
    }
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

fn chrono_like_timestamp() -> String {
    // Keep dependency surface minimal while preserving ISO-like output.
    let now = std::time::SystemTime::now();
    let datetime: chrono::DateTime<chrono::Utc> = now.into();
    datetime.to_rfc3339()
}

fn elapsed_since(start: SystemTime) -> Duration {
    SystemTime::now()
        .duration_since(start)
        .unwrap_or_else(|_| Duration::from_secs(0))
}

fn json_text(value: &Value) -> Result<String> {
    serde_json::to_string(value).with_context(|| "failed to serialize warning JSON")
}

#[cfg(test)]
mod tests {
    use super::*;
    use mcp_core::BridgePaths;
    use tempfile::tempdir;

    fn test_config() -> (AppConfig, tempfile::TempDir) {
        let dir = tempdir().expect("tempdir");
        let root = dir.path().join("ae-mcp-bridge");
        (
            AppConfig {
                bridge: BridgePaths {
                    command_file: root.join("ae_command.json"),
                    result_file: root.join("ae_mcp_result.json"),
                    root_dir: root,
                },
                ..AppConfig::default()
            },
            dir,
        )
    }

    #[test]
    fn write_command_file_creates_pending_command() {
        let (cfg, _guard) = test_config();
        let bridge = BridgeClient::new(cfg.clone()).expect("client");
        bridge
            .write_command_file("listCompositions", serde_json::json!({}))
            .expect("write");

        let raw = fs::read_to_string(cfg.bridge.command_file).expect("read");
        let data: CommandFile = serde_json::from_str(&raw).expect("parse");
        assert_eq!(data.command, "listCompositions");
        assert_eq!(data.status, CommandStatus::Pending);
    }

    #[test]
    fn clear_results_writes_waiting_payload() {
        let (cfg, _guard) = test_config();
        let bridge = BridgeClient::new(cfg.clone()).expect("client");
        bridge.clear_results_file().expect("clear");

        let raw = fs::read_to_string(cfg.bridge.result_file).expect("read");
        let data: WaitingResult = serde_json::from_str(&raw).expect("parse");
        assert_eq!(data.status, "waiting");
    }

    #[test]
    fn wait_for_bridge_result_matches_expected_command() {
        let (cfg, _guard) = test_config();
        let bridge = BridgeClient::new(cfg.clone()).expect("client");
        bridge.clear_results_file().expect("clear");

        let result_path = cfg.bridge.result_file.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(200));
            let payload = serde_json::json!({
                "status": "success",
                "_commandExecuted": "listCompositions"
            });
            fs::write(result_path, serde_json::to_string(&payload).expect("serialize")).expect("write");
        });

        let raw = bridge
            .wait_for_bridge_result(
                Some("listCompositions"),
                Duration::from_secs(2),
                Duration::from_millis(100),
            )
            .expect("should get result");
        let value: Value = serde_json::from_str(&raw).expect("parse");
        assert_eq!(
            value.get("_commandExecuted").and_then(Value::as_str),
            Some("listCompositions")
        );
    }
}
