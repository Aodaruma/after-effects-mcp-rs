# 🎬 After Effects MCP Server (Rust)

![Rust](https://img.shields.io/badge/rust-stable-orange)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-After%20Effects-blue)

A Rust-based MCP server for Adobe After Effects.
It uses `ae-mcp serve-daemon` as a local broker and communicates with AE through the `mcp-bridge-auto.jsx` panel.
Each open AE panel registers itself as an instance under `~/Documents/ae-mcp-bridge/instances/<instanceId>/`.

- 日本語版: [README-ja.md](README-ja.md)

## 0. Table of Contents

- [1. Why This Fork Exists](#1-why-this-fork-exists)
- [2. How It Works](#2-how-it-works)
  - [2.1 MCP Server Role](#21-mcp-server-role)
  - [2.2 JSX-First Tool Design](#22-jsx-first-tool-design)
  - [2.3 Execution Model](#23-execution-model)
- [3. Setup](#3-setup)
  - [3.1 Quick Setup](#31-quick-setup)
  - [3.2 Install Notes](#32-install-notes)
  - [3.3 Development Setup](#33-development-setup)
- [4. Quick Validation](#4-quick-validation)
- [5. Usage Examples](#5-usage-examples)
- [6. Available MCP Tools](#6-available-mcp-tools)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Configuration](#8-configuration)
- [9. Docs](#9-docs)
- [10. License](#10-license)

## 1. Why This Fork Exists

This fork was created to make After Effects automation easier to install, easier to operate, and more predictable for LLM-driven workflows. The original TypeScript-based server worked, but it required a Node.js runtime, exposed many narrow tools, and relied heavily on a single shared command/result file. That made installation heavier than necessary and made concurrent use harder to reason about.

The Rust rewrite keeps the After Effects bridge panel model, but moves the runtime into a single `ae-mcp` binary. The current design uses `serve-daemon` as a local broker, while `serve-stdio` stays focused on MCP communication with clients. This separates LLM-facing MCP traffic from AE execution control.

The main improvements are Rust-only deployment, daemon-based request routing, per-AE-instance FIFO execution, retained `requestId` results, AE instance discovery, and a simpler JSX-first tool surface. The bridge script was also updated for dockable panel use, file/network permission awareness, modal-dialog retry handling, ExtendScript compatibility, and debug logging.

## 2. How It Works

### 2.1 MCP Server Role

This project exposes After Effects automation through the Model Context Protocol. MCP clients connect to `ae-mcp serve-stdio`; that process exposes tools to the LLM and proxies execution requests to `ae-mcp serve-daemon`.

The daemon acts as the local broker. It tracks active After Effects bridge panels, resolves which AE instance should run a request, queues work, writes commands for the selected panel, waits for results, and stores request state in a registry. Each open AE panel registers itself under `~/Documents/ae-mcp-bridge/instances/<instanceId>/` and reports its AE version through heartbeat files.

### 2.2 JSX-First Tool Design

The public tool surface is intentionally small. Most AE operations should be performed through `run-jsx` or `run-jsx-file`. These tools require `mode: "unsafe"` and a `description`, because arbitrary JSX is not treated as a security boundary.

The remaining tools are generic support tools or special cases:

- `list-ae-instances`: inspect active AE instances and versions.
- `get-jsx-result` / `get-results`: read retained request results.
- `get-help`: show basic usage guidance.
- `run-bridge-test`: run a bridge smoke test.
- `save-frame-png`: optimized single-frame preview output.
- `cleanup-preview-folder`: preview file cleanup, executed as a global exclusive operation.

Individual AE operations such as creating layers, applying effects, or inspecting effects are expected to be written as JSX. Helper functions such as `applyEffect(args)`, `applyEffectTemplate(args)`, `listSupportedEffects(args)`, and `describeEffect(args)` are available inside the bridge script.

### 2.3 Execution Model

The daemon assigns each request a `requestId` and stores state under `~/Documents/ae-mcp-bridge/registry/`. If a request times out from the MCP client's perspective, AE may still be running it; the result can be checked later with `get-jsx-result`.

Execution is FIFO within the same AE instance. Different AE instances can run in parallel, which is useful for testing different AE versions. If multiple AE instances are active and no target is specified, execution returns an error; pass `targetInstanceId` or `targetVersion` to make the target explicit. `cleanup-preview-folder` is global exclusive to avoid conflicts on shared preview directories.

## 3. Setup

### 3.1 Quick Setup

1. Install `ae-mcp` from the release installer/package, or build it from source.
2. Install `mcp-bridge-auto.jsx` into After Effects' `ScriptUI Panels` folder.
3. In After Effects, enable `Allow Scripts to Write Files and Access Network`.
4. Restart AE, open `Window > mcp-bridge-auto.jsx`, and enable `Auto-run commands`.
5. Start the local broker with `ae-mcp serve-daemon` or install/start the service.
6. Register `ae-mcp serve-stdio` with your MCP client.
7. Run `list-ae-instances` to confirm that AE is visible to the daemon.

> [!NOTE]
> `serve-stdio` does not execute AE commands by itself. Execution tools require `serve-daemon` to be running with the same configuration.

### 3.2 Install Notes

Download the latest release from [GitHub Releases](https://github.com/Aodaruma/after-effects-mcp-rs/releases/latest).

- Windows: use the `.msi` installer, or the portable `.zip`.
- macOS: use the `.pkg` installer, or the portable `.tar.gz`.

Installer packages deploy `mcp-bridge-auto.jsx` to detected AE installations. Portable archives require manual bridge installation.

Bridge panel location:

- Windows: `C:\Program Files\Adobe\Adobe After Effects <YEAR>\Support Files\Scripts\ScriptUI Panels\`
- macOS: `/Applications/Adobe After Effects <YEAR>/Scripts/ScriptUI Panels/`

If AE was installed or updated after installing `ae-mcp`, run the bridge installer once:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

```bash
bash ./scripts/install-bridge.sh
```

Start the daemon as a service when using an installed binary:

```powershell
& "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" service install
& "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" service start
```

```bash
ae-mcp service install
ae-mcp service start
```

Register with Codex CLI:

```powershell
codex mcp add aftereffects -- "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" serve-stdio
```

```bash
codex mcp add aftereffects -- /usr/local/bin/ae-mcp serve-stdio
```

### 3.3 Development Setup

Prerequisites are Adobe After Effects, Rust stable, and Cargo.

Build from source:

```bash
cargo build --release -p ae-mcp
```

Install the bridge panel from the repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

```bash
bash ./scripts/install-bridge.sh
```

Run the daemon in one terminal:

```powershell
.\target\release\ae-mcp.exe serve-daemon
```

Register the stdio server with your MCP client:

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH>/target/release/ae-mcp.exe" serve-stdio
```

For macOS, remove `.exe`.

## 4. Quick Validation

```powershell
<AE_MCP_PATH> health
<AE_MCP_PATH> serve-daemon
```

In another terminal, verify the MCP tool path:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list-ae-instances","arguments":{}}}' | <AE_MCP_PATH> serve-stdio
```

After opening `Window > mcp-bridge-auto.jsx` in AE and enabling `Auto-run commands`, `list-ae-instances` should return at least one instance with `instanceId` and `appVersion`.

## 5. Usage Examples

Run arbitrary unsafe JSX:

```json
{
  "code": "return app.project ? app.project.numItems : 0;",
  "mode": "unsafe",
  "description": "Count project items",
  "timeoutMs": 10000,
  "resultRetentionSeconds": 3600
}
```

Target a specific AE instance:

```json
{
  "code": "return app.version;",
  "mode": "unsafe",
  "description": "Check AE version",
  "targetInstanceId": "ae-25.0-...",
  "timeoutMs": 10000
}
```

Check a timed-out request later:

```json
{
  "requestId": "req-..."
}
```

Use this payload with `get-jsx-result`.

Apply an effect using stable IDs through `run-jsx`:

```json
{
  "code": "return applyEffect(args);",
  "mode": "unsafe",
  "description": "Apply Gaussian Blur",
  "args": {
    "compId": 1,
    "layerId": 15,
    "effectMatchName": "ADBE Gaussian Blur 2",
    "effectSettings": {
      "Blurriness": 18
    }
  }
}
```

Describe available parameters for an effect:

```json
{
  "code": "return describeEffect(args);",
  "mode": "unsafe",
  "description": "Describe Glow effect",
  "args": {
    "compId": 1,
    "layerId": 15,
    "effectMatchName": "ADBE Glo2"
  }
}
```

List effect availability in current environment:

```json
{
  "code": "return listSupportedEffects(args);",
  "mode": "unsafe",
  "description": "List supported effects",
  "args": {
    "compName": "Main Comp",
    "layerName": "FX Layer",
    "includeUnavailable": true
  }
}
```

## 6. Available MCP Tools

| Tool | Description |
|---|---|
| `run-jsx` | Run unsafe JSX in AE through the daemon broker |
| `run-jsx-file` | Run a local JSX file in AE through the daemon broker |
| `get-jsx-result` | Read a retained result by `requestId` |
| `list-ae-instances` | List active AE bridge instances and versions |
| `get-results` | Read latest retained result, or by `requestId` |
| `get-help` | General integration help |
| `save-frame-png` | Save a single-frame PNG preview |
| `cleanup-preview-folder` | Delete preview files. This is globally exclusive across AE instances |
| `run-bridge-test` | Run bridge/effects smoke test |

Most AE operations should be done through `run-jsx` / `run-jsx-file`. The daemon guarantees FIFO execution inside one AE instance. Different AE instances may run in parallel.

Common execution options:

| Option | Description |
|---|---|
| `mode` | Required. Currently only `unsafe` is supported |
| `description` | Required. Used for logs and AE undo group |
| `timeoutMs` | How long the MCP call waits |
| `resultRetentionSeconds` | How long the request result is retained. Default `3600`, max `86400` |
| `targetInstanceId` | Exact AE instance target |
| `targetVersion` | Match AE `appVersion` / display name |

Target selection:

- If no AE instance is active, execution returns an error.
- If exactly one AE instance is active, it is selected automatically.
- If multiple AE instances are active, specify `targetInstanceId` or `targetVersion`.

## 7. Troubleshooting

- Execution tools return daemon connection errors:
  - start `ae-mcp serve-daemon`, or install/start the service
  - confirm `health` shows the expected `daemon_addr`
- `list-ae-instances` returns an empty list:
  - AE panel not open
  - `Auto-run commands` is OFF
  - panel not reloaded after script update
- multiple AE instances are active:
  - run `list-ae-instances`
  - pass `targetInstanceId` or `targetVersion`
- `get-jsx-result` returns `timeout`:
  - the MCP call timed out, but AE may still be running
  - call `get-jsx-result` again with the same `requestId`
- Installer completed but panel is not found in AE:
  - restart AE and check `Window > mcp-bridge-auto.jsx`
  - if still missing, run `install-bridge.ps1` / `install-bridge.sh` manually
- Result files to inspect:
  - `~/Documents/ae-mcp-bridge/instances/<instanceId>/heartbeat.json`
  - `~/Documents/ae-mcp-bridge/instances/<instanceId>/ae_command.json`
  - `~/Documents/ae-mcp-bridge/instances/<instanceId>/ae_mcp_result.json`
  - `~/Documents/ae-mcp-bridge/registry/<requestId>.json`
- `service install` access denied on Windows:
  - run elevated shell (`gsudo` or Administrator PowerShell)
- `-AfterEffectsPath` gets split into `C:\Program`:
  - quote with single quotes:
    - `-AfterEffectsPath 'C:\Program Files\Adobe\Adobe After Effects 2025'`

## 8. Configuration

By default, `ae-mcp` uses:

| Key | Default | Description |
|---|---:|---|
| `daemon_addr` | `127.0.0.1:47655` | Local daemon broker address |
| `poll_interval_ms` | `250` | AE result polling interval |
| `result_timeout_ms` | `5000` | Default execution wait timeout |
| `result_retention_seconds` | `3600` | Default retained result lifetime |
| `result_retention_max_seconds` | `86400` | Maximum accepted retention |
| `instance_heartbeat_stale_ms` | `10000` | AE heartbeat stale threshold |

Example TOML config:

```toml
daemon_addr = "127.0.0.1:47655"
poll_interval_ms = 250
result_timeout_ms = 10000
result_retention_seconds = 3600
result_retention_max_seconds = 86400
instance_heartbeat_stale_ms = 10000
log_level = "info"

[bridge]
root_dir = "C:\\Users\\YOU\\Documents\\ae-mcp-bridge"
command_file = "C:\\Users\\YOU\\Documents\\ae-mcp-bridge\\ae_command.json"
result_file = "C:\\Users\\YOU\\Documents\\ae-mcp-bridge\\ae_mcp_result.json"
```

`command_file` and `result_file` are legacy fallback paths. Daemon-routed execution uses instance-specific files under `root_dir/instances/<instanceId>/`.

Use the same config for both daemon and stdio:

```powershell
ae-mcp --config C:\path\ae-mcp.toml serve-daemon
codex mcp add aftereffects -- ae-mcp --config C:\path\ae-mcp.toml serve-stdio
```

## 9. Docs

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Signing and RC guide](docs/signing-and-rc.md)
- [TS to Rust migration guide](docs/migration-guide-ts-to-rust.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)

## 10. License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
