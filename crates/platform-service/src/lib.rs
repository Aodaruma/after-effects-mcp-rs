use anyhow::{anyhow, Context, Result};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServiceConfig {
    pub service_name: String,
    pub display_name: String,
    pub description: String,
    pub binary_path: PathBuf,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServiceAction {
    Install,
    Uninstall,
    Start,
    Stop,
    Status,
}

pub fn run(action: ServiceAction, cfg: &ServiceConfig) -> Result<String> {
    match action {
        ServiceAction::Install => install(cfg),
        ServiceAction::Uninstall => uninstall(cfg),
        ServiceAction::Start => start(cfg),
        ServiceAction::Stop => stop(cfg),
        ServiceAction::Status => status(cfg),
    }
}

#[cfg(target_os = "windows")]
fn install(cfg: &ServiceConfig) -> Result<String> {
    let bin_path = format!(
        "binPath= \"\\\"{}\\\" {}\"",
        cfg.binary_path.display(),
        cfg.args.join(" ")
    );
    let output = Command::new("sc")
        .args([
            "create",
            &cfg.service_name,
            &bin_path,
            "start=",
            "auto",
            "DisplayName=",
            &cfg.display_name,
        ])
        .output()
        .with_context(|| "failed to execute 'sc create'")?;

    if !output.status.success() {
        return Err(anyhow!(render_sc_error("install", "sc create", output)));
    }

    let _ = Command::new("sc")
        .args(["description", &cfg.service_name, &cfg.description])
        .output();

    Ok("service installed".to_string())
}

#[cfg(target_os = "windows")]
fn uninstall(cfg: &ServiceConfig) -> Result<String> {
    let _ = Command::new("sc")
        .args(["stop", &cfg.service_name])
        .output();
    let output = Command::new("sc")
        .args(["delete", &cfg.service_name])
        .output()
        .with_context(|| "failed to execute 'sc delete'")?;
    if !output.status.success() {
        return Err(anyhow!(render_sc_error("uninstall", "sc delete", output)));
    }
    Ok("service uninstalled".to_string())
}

#[cfg(target_os = "windows")]
fn start(cfg: &ServiceConfig) -> Result<String> {
    let output = Command::new("sc")
        .args(["start", &cfg.service_name])
        .output()
        .with_context(|| "failed to execute 'sc start'")?;
    if !output.status.success() {
        return Err(anyhow!(render_sc_error("start", "sc start", output)));
    }
    Ok("service started".to_string())
}

#[cfg(target_os = "windows")]
fn stop(cfg: &ServiceConfig) -> Result<String> {
    let output = Command::new("sc")
        .args(["stop", &cfg.service_name])
        .output()
        .with_context(|| "failed to execute 'sc stop'")?;
    if !output.status.success() {
        return Err(anyhow!(render_sc_error("stop", "sc stop", output)));
    }
    Ok("service stopped".to_string())
}

#[cfg(target_os = "windows")]
fn status(cfg: &ServiceConfig) -> Result<String> {
    let output = Command::new("sc")
        .args(["query", &cfg.service_name])
        .output()
        .with_context(|| "failed to execute 'sc query'")?;
    if !output.status.success() {
        return Err(anyhow!(render_sc_error("status", "sc query", output)));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(target_os = "macos")]
fn install(cfg: &ServiceConfig) -> Result<String> {
    let plist_path = plist_path(&cfg.service_name)?;
    let plist_body = build_launchd_plist(cfg)?;
    std::fs::write(&plist_path, plist_body)
        .with_context(|| format!("failed to write plist: {}", plist_path.display()))?;

    let output = Command::new("launchctl")
        .args(["load", "-w", plist_path.to_string_lossy().as_ref()])
        .output()
        .with_context(|| "failed to execute 'launchctl load'")?;
    if !output.status.success() {
        return Err(anyhow!(render_output("launchctl load", output)));
    }
    Ok(format!(
        "launch agent installed at {}",
        plist_path.display()
    ))
}

#[cfg(target_os = "macos")]
fn uninstall(cfg: &ServiceConfig) -> Result<String> {
    let plist_path = plist_path(&cfg.service_name)?;
    let _ = Command::new("launchctl")
        .args(["unload", "-w", plist_path.to_string_lossy().as_ref()])
        .output();
    if plist_path.exists() {
        std::fs::remove_file(&plist_path)
            .with_context(|| format!("failed to remove plist: {}", plist_path.display()))?;
    }
    Ok("launch agent uninstalled".to_string())
}

#[cfg(target_os = "macos")]
fn start(cfg: &ServiceConfig) -> Result<String> {
    let output = Command::new("launchctl")
        .args(["start", &cfg.service_name])
        .output()
        .with_context(|| "failed to execute 'launchctl start'")?;
    if !output.status.success() {
        return Err(anyhow!(render_output("launchctl start", output)));
    }
    Ok("launch agent started".to_string())
}

#[cfg(target_os = "macos")]
fn stop(cfg: &ServiceConfig) -> Result<String> {
    let output = Command::new("launchctl")
        .args(["stop", &cfg.service_name])
        .output()
        .with_context(|| "failed to execute 'launchctl stop'")?;
    if !output.status.success() {
        return Err(anyhow!(render_output("launchctl stop", output)));
    }
    Ok("launch agent stopped".to_string())
}

#[cfg(target_os = "macos")]
fn status(cfg: &ServiceConfig) -> Result<String> {
    let output = Command::new("launchctl")
        .args(["list"])
        .output()
        .with_context(|| "failed to execute 'launchctl list'")?;
    if !output.status.success() {
        return Err(anyhow!(render_output("launchctl list", output)));
    }
    let all = String::from_utf8_lossy(&output.stdout).to_string();
    let lines = all
        .lines()
        .filter(|line| line.contains(&cfg.service_name))
        .collect::<Vec<_>>();
    if lines.is_empty() {
        Ok(format!("{}: not listed", cfg.service_name))
    } else {
        Ok(lines.join("\n"))
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn install(_cfg: &ServiceConfig) -> Result<String> {
    Err(anyhow!(
        "service install is supported only on Windows/macOS"
    ))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn uninstall(_cfg: &ServiceConfig) -> Result<String> {
    Err(anyhow!(
        "service uninstall is supported only on Windows/macOS"
    ))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn start(_cfg: &ServiceConfig) -> Result<String> {
    Err(anyhow!("service start is supported only on Windows/macOS"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn stop(_cfg: &ServiceConfig) -> Result<String> {
    Err(anyhow!("service stop is supported only on Windows/macOS"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn status(_cfg: &ServiceConfig) -> Result<String> {
    Err(anyhow!("service status is supported only on Windows/macOS"))
}

#[cfg(target_os = "macos")]
fn plist_path(service_name: &str) -> Result<PathBuf> {
    let home = std::env::var("HOME").with_context(|| "HOME is not set")?;
    Ok(std::path::Path::new(&home)
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{service_name}.plist")))
}

#[cfg(target_os = "macos")]
fn build_launchd_plist(cfg: &ServiceConfig) -> Result<String> {
    let args = std::iter::once(cfg.binary_path.to_string_lossy().to_string())
        .chain(cfg.args.iter().cloned())
        .map(|x| format!("<string>{x}</string>"))
        .collect::<Vec<_>>()
        .join("\n        ");

    Ok(format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        {args}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
"#,
        label = cfg.service_name,
        args = args
    ))
}

fn render_output(command: &str, output: std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    format!(
        "{command} failed with status={}: stdout=`{}` stderr=`{}`",
        output.status,
        stdout.trim(),
        stderr.trim()
    )
}

#[cfg(target_os = "windows")]
fn render_sc_error(action: &str, command: &str, output: std::process::Output) -> String {
    let status_code = output.status.code().unwrap_or(-1);
    let raw = render_output(command, output);
    if status_code == 5 {
        return format!(
            "service {action} failed with Access Denied (exit code 5). \
Please run this command from an elevated Administrator PowerShell.\n\
Hint: Start menu -> PowerShell -> Run as Administrator.\n\
raw: {raw}"
        );
    }
    raw
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_output_formats_status() {
        let output = std::process::Output {
            status: success_status(),
            stdout: b"ok".to_vec(),
            stderr: vec![],
        };
        let rendered = render_output("dummy", output);
        assert!(rendered.contains("dummy failed"));
    }

    #[cfg(target_os = "windows")]
    fn success_status() -> std::process::ExitStatus {
        use std::os::windows::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(0)
    }

    #[cfg(not(target_os = "windows"))]
    fn success_status() -> std::process::ExitStatus {
        use std::os::unix::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(0)
    }
}
