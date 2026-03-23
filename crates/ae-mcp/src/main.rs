use anyhow::Result;
use clap::{Parser, Subcommand};
use mcp_core::AppConfig;
use std::path::PathBuf;
use std::time::Duration;
use tracing::info;

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
    /// Stage 1: minimal stdio server loop.
    ServeStdio {
        #[arg(long)]
        once: bool,
    },
    /// Print a health summary.
    Health,
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
        Commands::ServeStdio { once } => serve_stdio(once).await,
        Commands::Health => {
            println!("status=ok");
            println!("bridge_root={}", cfg.bridge.root_dir.display());
            Ok(())
        }
    }
}

async fn serve_stdio(once: bool) -> Result<()> {
    info!("serve-stdio started");
    if once {
        return Ok(());
    }

    loop {
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}

