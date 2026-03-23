use anyhow::Result;
use clap::{Parser, Subcommand};
use mcp_core::AppConfig;
use std::path::PathBuf;
use std::time::Duration;
use tracing::info;

mod mcp_stdio;

#[derive(Debug, Parser)]
#[command(name = "ae-mcp", version, about = "After Effects MCP server (Rust)")]
struct Cli {
    #[arg(long)]
    config: Option<PathBuf>,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// MCP stdio server mode.
    ServeStdio {
        #[arg(long)]
        once: bool,
    },
    /// Stage 2: direct bridge operations for validation.
    Bridge {
        #[command(subcommand)]
        command: BridgeCommands,
    },
    /// Print a health summary.
    Health,
}

#[derive(Debug, Subcommand)]
enum BridgeCommands {
    /// Queue a script command for After Effects.
    RunScript {
        #[arg(long)]
        script: String,
        #[arg(long, default_value = "{}")]
        parameters: String,
    },
    /// Read the latest result payload.
    GetResults {
        #[arg(long, default_value_t = 30)]
        stale_seconds: u64,
    },
}

fn init_tracing(level: &str) {
    let filter = tracing_subscriber::EnvFilter::try_new(level).unwrap_or_else(|_| {
        tracing_subscriber::EnvFilter::new("info")
    });

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let cfg = AppConfig::load(cli.config.as_deref())?;
    init_tracing(&cfg.log_level);
    bridge_core::ensure_bridge_dir(&cfg)?;

    match cli.command {
        Commands::ServeStdio { once } => serve_stdio(cfg, once).await,
        Commands::Bridge { command } => run_bridge_command(cfg, command),
        Commands::Health => {
            println!("status=ok");
            println!("bridge_root={}", cfg.bridge.root_dir.display());
            Ok(())
        }
    }
}

async fn serve_stdio(cfg: AppConfig, once: bool) -> Result<()> {
    info!("serve-stdio started");
    if once {
        return Ok(());
    }
    mcp_stdio::run_stdio_server(cfg).await
}

fn run_bridge_command(cfg: AppConfig, command: BridgeCommands) -> Result<()> {
    let bridge = bridge_core::BridgeClient::new(cfg)?;
    match command {
        BridgeCommands::RunScript { script, parameters } => {
            if !mcp_core::is_allowed_script(&script) {
                anyhow::bail!(
                    "script '{}' is not allowed. Allowed scripts: {}",
                    script,
                    mcp_core::ALLOWED_SCRIPTS.join(", ")
                );
            }
            let value: serde_json::Value = serde_json::from_str(&parameters)?;
            bridge.clear_results_file()?;
            bridge.write_command_file(&script, value)?;
            println!(
                "queued command='{}' and cleared previous result. open AE MCP Bridge panel and execute.",
                script
            );
            Ok(())
        }
        BridgeCommands::GetResults { stale_seconds } => {
            let raw = bridge.read_results_with_stale_warning(Duration::from_secs(stale_seconds))?;
            println!("{raw}");
            Ok(())
        }
    }
}
