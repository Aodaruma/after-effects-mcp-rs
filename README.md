# 🎬 After Effects MCP Server (Rust)

![Rust](https://img.shields.io/badge/rust-stable-orange)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-After%20Effects-blue)

A Rust-based MCP server for Adobe After Effects.
It communicates with AE through the `mcp-bridge-auto.jsx` panel and file bridge (`ae_command.json` / `ae_mcp_result.json`).

- 日本語版: [README-ja.md](README-ja.md)

## Table of Contents

- [Features](#features)
  - [Core Composition Features](#core-composition-features)
  - [Layer and Animation Features](#layer-and-animation-features)
  - [Effects and Introspection](#effects-and-introspection)
  - [Operations and Distribution](#operations-and-distribution)
- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Build](#build)
  - [Install AE Bridge Panel](#install-ae-bridge-panel)
  - [Configure After Effects](#configure-after-effects)
  - [Register MCP Server](#register-mcp-server)
- [Quick Validation](#quick-validation)
- [Usage Examples](#usage-examples)
- [Available MCP Tools](#available-mcp-tools)
- [Troubleshooting](#troubleshooting)
- [Docs](#docs)
- [License](#license)

## Features

### Core Composition Features

- Create compositions with custom width, height, duration, framerate, and background.
- List compositions and fetch project metadata.
- Keep MCP prompt/resource/tool naming compatible with the previous TS server.

### Layer and Animation Features

- Create text, shape, and solid/adjustment layers.
- Update layer properties.
- Set keyframes and expressions via MCP tools.
- Resolve targets by:
  - `compId/layerId` (recommended)
  - `compName/layerName`
  - `compIndex/layerIndex`

### Effects and Introspection

- Apply effects directly (`apply-effect`) or via templates (`apply-effect-template`).
- `smooth-gradient` template with Gradient Ramp fallback support.
- `list-supported-effects`: probe a known catalog and report availability in current AE environment.
- `describe-effect`: temporarily add an effect and return available parameter metadata.
- ExtendScript compatibility fix for older AE scripting engines (no `Object.keys` dependency).

### Operations and Distribution

- `serve-stdio` for MCP clients.
- `serve-daemon` and `service` subcommands for OS-level service management.
- Windows/macOS packaging scripts and CI workflows for installer artifacts.
- Repository is now Rust-only (legacy npm/TypeScript server files were removed).

## Setup

### Prerequisites

- Adobe After Effects (2022+ recommended)
- Rust stable + Cargo
- Windows or macOS

### Build

```bash
cargo build --release -p ae-mcp
```

Artifacts:

- Windows: `target/release/ae-mcp.exe`
- macOS: `target/release/ae-mcp`

### Install AE Bridge Panel

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

macOS (bash):

```bash
bash ./scripts/install-bridge.sh
```

### Configure After Effects

1. Open `Edit > Preferences > Scripting & Expressions`.
2. Enable `Allow Scripts to Write Files and Access Network`.
3. Restart After Effects.
4. Open `Window > mcp-bridge-auto.jsx`.
5. Turn on `Auto-run commands`.

### Register MCP Server

Codex CLI example:

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH>/target/release/ae-mcp.exe" serve-stdio
```

For macOS, remove `.exe`.

## Quick Validation

```powershell
.\target\release\ae-mcp.exe health
.\target\release\ae-mcp.exe bridge run-script --script listCompositions --parameters '{}'
.\target\release\ae-mcp.exe bridge get-results
```

## Usage Examples

Apply an effect using stable IDs:

```json
{
  "compId": 1,
  "layerId": 15,
  "effectMatchName": "ADBE Gaussian Blur 2",
  "effectSettings": {
    "Blurriness": 18
  }
}
```

Describe available parameters for an effect:

```json
{
  "compId": 1,
  "layerId": 15,
  "effectMatchName": "ADBE Glo2"
}
```

List effect availability in current environment:

```json
{
  "compName": "Main Comp",
  "layerName": "FX Layer",
  "includeUnavailable": true
}
```

## Available MCP Tools

| Tool | Description |
|---|---|
| `run-script` | Queue an allowlisted bridge script |
| `get-results` | Read latest bridge result |
| `get-help` | General integration help |
| `create-composition` | Create composition |
| `setLayerKeyframe` | Set a keyframe |
| `setLayerExpression` | Set/remove expression |
| `apply-effect` | Apply effect to layer |
| `apply-effect-template` | Apply predefined template |
| `list-supported-effects` | Probe known effect catalog |
| `describe-effect` | Inspect effect parameter metadata |
| `mcp_aftereffects_applyEffect` | Direct call variant |
| `mcp_aftereffects_applyEffectTemplate` | Direct call variant |
| `mcp_aftereffects_listSupportedEffects` | Direct call variant |
| `mcp_aftereffects_describeEffect` | Direct call variant |
| `mcp_aftereffects_get_effects_help` | Effects help text |
| `run-bridge-test` | Queue bridge/effects smoke test |

## Troubleshooting

- `ae_command.json` stays `pending`:
  - AE panel not open
  - `Auto-run commands` is OFF
  - panel not reloaded after script update
- `get-results` returns stale/waiting:
  - check `~/Documents/ae-mcp-bridge/ae_command.json` and `ae_mcp_result.json` timestamps
- `service install` access denied on Windows:
  - run elevated shell (`gsudo` or Administrator PowerShell)
- `-AfterEffectsPath` gets split into `C:\Program`:
  - quote with single quotes:
    - `-AfterEffectsPath 'C:\Program Files\Adobe\Adobe After Effects 2025'`

## Docs

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Signing and RC guide](docs/signing-and-rc.md)
- [TS to Rust migration guide](docs/migration-guide-ts-to-rust.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
