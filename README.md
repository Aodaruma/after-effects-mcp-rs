# 🎬 After Effects MCP Server (Rust)

![Rust](https://img.shields.io/badge/rust-stable-orange)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-After%20Effects-blue)

A Rust-based MCP server for Adobe After Effects.
It communicates with AE through the `mcp-bridge-auto.jsx` panel and file bridge (`ae_command.json` / `ae_mcp_result.json`).

- 日本語版: [README-ja.md](README-ja.md)

## 0. Table of Contents

- [1. Improvements from Upstream Fork](#1-improvements-from-upstream-fork)
- [2. Features](#2-features)
  - [2.1 Core Composition Features](#21-core-composition-features)
  - [2.2 Layer and Animation Features](#22-layer-and-animation-features)
  - [2.3 Effects and Introspection](#23-effects-and-introspection)
  - [2.4 Operations and Distribution](#24-operations-and-distribution)
- [3. Setup](#3-setup)
  - [3.1 User Install (For Users)](#31-user-install-for-users)
    - [3.1-A Download Binary](#31-a-download-binary)
    - [3.1-B Install AE Bridge Panel](#31-b-install-ae-bridge-panel)
    - [3.1-C Configure After Effects](#31-c-configure-after-effects)
    - [3.1-D Register MCP Server](#31-d-register-mcp-server)
  - [3.2 Development Setup (From Source)](#32-development-setup-from-source)
    - [3.2-A Prerequisites](#32-a-prerequisites)
    - [3.2-B Build](#32-b-build)
    - [3.2-C Install AE Bridge Panel with Script](#32-c-install-ae-bridge-panel-with-script)
    - [3.2-D Configure After Effects](#32-d-configure-after-effects)
    - [3.2-E Register MCP Server](#32-e-register-mcp-server)
- [4. Quick Validation](#4-quick-validation)
- [5. Usage Examples](#5-usage-examples)
- [6. Available MCP Tools](#6-available-mcp-tools)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Docs](#8-docs)
- [9. License](#9-license)

## 1. Improvements from Upstream Fork

- Migrated runtime from Node.js/TypeScript to Rust (`ae-mcp`) for simpler deployment.
- Removed npm/yarn dependency from the runtime path and bridge installation flow.
- Added `compId/layerId`-based targeting to reduce index drift and mis-application risks.
- Added effect introspection tools:
  - `list-supported-effects`
  - `describe-effect`
- Improved ExtendScript compatibility (`Object.keys`-free bridge scripts for older AE engines).
- Upgraded `mcp-bridge-auto.jsx` with:
  - Dockable panel support
  - Permission-aware UI state handling
  - Modal-dialog-safe retry behavior
- Added cross-platform packaging and release automation for Windows/macOS artifacts.

## 2. Features

### 2.1 Core Composition Features

- Create compositions with custom width, height, duration, framerate, and background.
- List compositions and fetch project metadata.
- Keep MCP prompt/resource/tool naming compatible with the previous TS server.

### 2.2 Layer and Animation Features

- Create text, shape, and solid/adjustment layers.
- Update layer properties.
- Set keyframes and expressions via MCP tools.
- Resolve targets by:
  - `compId/layerId` (recommended)
  - `compName/layerName`
  - `compIndex/layerIndex`

### 2.3 Effects and Introspection

- Apply effects directly (`apply-effect`) or via templates (`apply-effect-template`).
- `smooth-gradient` template with Gradient Ramp fallback support.
- `list-supported-effects`: probe a known catalog and report availability in current AE environment.
- `describe-effect`: temporarily add an effect and return available parameter metadata.
- ExtendScript compatibility fix for older AE scripting engines (no `Object.keys` dependency).

### 2.4 Operations and Distribution

- `serve-stdio` for MCP clients.
- `serve-daemon` and `service` subcommands for OS-level service management.
- Windows/macOS packaging scripts and CI workflows for installer artifacts.
- Repository is now Rust-only (legacy npm/TypeScript server files were removed).

## 3. Setup

### 3.1 User Install (For Users)

#### 3.1-A Download Binary

Download the latest release from [GitHub Releases](https://github.com/Aodaruma/after-effects-mcp-rs/releases/latest).

- Windows:
  - `after-effects-mcp-rs-windows-x86_64.msi` (installer)
  - `after-effects-mcp-rs-windows-x86_64.zip` (portable binary)
- macOS:
  - `after-effects-mcp-rs-macos-universal.pkg` (installer)
  - `after-effects-mcp-rs-macos-universal.tar.gz` (portable binary)

#### 3.1-B Install AE Bridge Panel

Download `mcp-bridge-auto.jsx` from:

- `src/scripts/mcp-bridge-auto.jsx` in this repository, or
- [raw file link](https://raw.githubusercontent.com/Aodaruma/after-effects-mcp-rs/main/src/scripts/mcp-bridge-auto.jsx)

Then copy it to:

- Windows: `C:\Program Files\Adobe\Adobe After Effects <YEAR>\Support Files\Scripts\ScriptUI Panels\`
- macOS: `/Applications/Adobe After Effects <YEAR>/Scripts/ScriptUI Panels/`

#### 3.1-C Configure After Effects

1. Open `Edit > Preferences > Scripting & Expressions`.
2. Enable `Allow Scripts to Write Files and Access Network`.
3. Restart After Effects.
4. Open `Window > mcp-bridge-auto.jsx`.
5. Turn on `Auto-run commands`.

#### 3.1-D Register MCP Server

Examples for Codex CLI:

Windows (`.msi` default location):

```powershell
codex mcp add aftereffects -- "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" serve-stdio
```

macOS (`.pkg` default location):

```bash
codex mcp add aftereffects -- /usr/local/bin/ae-mcp serve-stdio
```

### 3.2 Development Setup (From Source)

#### 3.2-A Prerequisites

- Adobe After Effects (2022+ recommended)
- Rust stable + Cargo
- Windows or macOS

#### 3.2-B Build

```bash
cargo build --release -p ae-mcp
```

Artifacts:

- Windows: `target/release/ae-mcp.exe`
- macOS: `target/release/ae-mcp`

#### 3.2-C Install AE Bridge Panel with Script

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

Without `-AfterEffectsPath`, the installer copies to all detected `Adobe After Effects <YEAR>` installations.

macOS (bash):

```bash
bash ./scripts/install-bridge.sh
```

Without `--ae-path`, the installer copies to all detected `/Applications/Adobe After Effects <YEAR>` installations.

#### 3.2-D Configure After Effects

1. Open `Edit > Preferences > Scripting & Expressions`.
2. Enable `Allow Scripts to Write Files and Access Network`.
3. Restart After Effects.
4. Open `Window > mcp-bridge-auto.jsx`.
5. Turn on `Auto-run commands`.

#### 3.2-E Register MCP Server

Codex CLI example:

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH>/target/release/ae-mcp.exe" serve-stdio
```

For macOS, remove `.exe`.

## 4. Quick Validation

```powershell
<AE_MCP_PATH> health
<AE_MCP_PATH> bridge run-script --script listCompositions --parameters '{}'
<AE_MCP_PATH> bridge get-results
```

## 5. Usage Examples

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

## 6. Available MCP Tools

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

## 7. Troubleshooting

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

## 8. Docs

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Signing and RC guide](docs/signing-and-rc.md)
- [TS to Rust migration guide](docs/migration-guide-ts-to-rust.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)

## 9. License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
