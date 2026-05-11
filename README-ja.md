# 🎬 After Effects MCP Server (Rust)

![Rust](https://img.shields.io/badge/rust-stable-orange)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-After%20Effects-blue)

Adobe After Effects 向けの Rust 製 MCP サーバーです。  
`ae-mcp serve-daemon` をローカル broker として使い、`mcp-bridge-auto.jsx` パネル経由で AE と連携します。
開いているAEパネルは `~/Documents/ae-mcp-bridge/instances/<instanceId>/` にインスタンスとして登録されます。

- English: [README.md](README.md)

## 0. 目次

- [1. このフォークの目的](#1-このフォークの目的)
- [2. 仕組み](#2-仕組み)
  - [2.1 MCPサーバーの役割](#21-mcpサーバーの役割)
  - [2.2 JSX中心のtool設計](#22-jsx中心のtool設計)
  - [2.3 実行モデル](#23-実行モデル)
- [3. セットアップ](#3-セットアップ)
  - [3.1 クイックセットアップ](#31-クイックセットアップ)
  - [3.2 インストール補足](#32-インストール補足)
  - [3.3 開発者向けセットアップ](#33-開発者向けセットアップ)
- [4. クイック動作確認](#4-クイック動作確認)
- [5. 使用例](#5-使用例)
- [6. 利用可能な MCP ツール](#6-利用可能な-mcp-ツール)
- [7. トラブルシュート](#7-トラブルシュート)
- [8. 設定](#8-設定)
- [9. ドキュメント](#9-ドキュメント)
- [10. ライセンス](#10-ライセンス)

## 1. このフォークの目的

このフォークは、After Effects の自動化をインストールしやすく、運用しやすく、LLM から扱いやすくするために作成しました。フォーク元の TypeScript 実装は動作していましたが、Node.js ランタイムが必要で、細かい用途別 tool が多く、単一の command/result ファイルに依存していたため、導入や同時利用の見通しが悪くなりやすい構成でした。

Rust 版では、AE 側の `mcp-bridge-auto.jsx` パネルを使う方針は残しつつ、実行基盤を単一の `ae-mcp` バイナリへ移行しています。`serve-daemon` がローカルの調停プロセスとして AE 実行を管理し、`serve-stdio` は MCP クライアントとの通信に集中します。これにより、LLM へ見せる MCP 経路と AE 実行制御を分離しています。

主な改善点は、Rust 単体での配布、daemon 経由の request routing、AE instance ごとの FIFO 実行、`requestId` による結果保持と再確認、AE instance 一覧取得、そして JSX 中心の小さな tool 構成です。ブリッジ側も dockable panel、ファイル/ネットワーク権限の検知、モーダルダイアログ時の再試行、ExtendScript 互換性、debug log に対応しています。

## 2. 仕組み

### 2.1 MCPサーバーの役割

このプロジェクトは、After Effects 操作を Model Context Protocol 経由で LLM に提供します。MCP クライアントは `ae-mcp serve-stdio` に接続し、`serve-stdio` が公開 tool の呼び出しを受け付けます。実際の AE 実行は `ae-mcp serve-daemon` に渡されます。

daemon は、起動中の AE bridge panel を監視し、どの AE instance で実行するかを決め、request を queue に入れ、対象 panel 用の command を書き込み、結果を待って registry に保持します。各 AE panel は `~/Documents/ae-mcp-bridge/instances/<instanceId>/` に登録され、heartbeat で AE version も返します。

### 2.2 JSX中心のtool設計

現在の公開 tool は、LLM が扱いやすいように意図的に少なくしています。AE の個別操作は原則として `run-jsx` または `run-jsx-file` で実行します。任意 JSX は安全境界として扱えないため、これらの tool は `mode: "unsafe"` と `description` を必須にしています。

残している tool は、汎用補助または例外的に専用化したものです。

- `list-ae-instances`: 起動中の AE instance と version を確認します。
- `get-jsx-result` / `get-results`: 保持済みの実行結果を確認します。
- `get-help`: 基本的な使い方を表示します。
- `run-bridge-test`: ブリッジ疎通確認を行います。
- `save-frame-png`: 1フレームの preview PNG を保存します。
- `cleanup-preview-folder`: preview folder を掃除します。共有 folder 競合を避けるため global exclusive で実行します。

コンポジション作成、レイヤー作成、エフェクト適用、エフェクト調査などは、専用 MCP tool ではなく JSX から行います。ブリッジ内には `applyEffect(args)`、`applyEffectTemplate(args)`、`listSupportedEffects(args)`、`describeEffect(args)` などの helper が用意されています。

### 2.3 実行モデル

daemon は request ごとに `requestId` を発行し、状態を `~/Documents/ae-mcp-bridge/registry/` に保持します。MCP 呼び出しが timeout しても AE 側の処理が継続している場合があるため、後から `get-jsx-result` で結果を確認できます。

同じ AE instance 内では FIFO で順番に実行します。異なる AE instance では並列実行できます。複数の AE instance が起動している状態で target を指定しない場合は、誤実行を避けるため error になります。必要に応じて `targetInstanceId` または `targetVersion` を指定してください。

## 3. セットアップ

### 3.1 クイックセットアップ

1. Release 版をインストールするか、source から `ae-mcp` を build します。
2. `mcp-bridge-auto.jsx` を After Effects の `ScriptUI Panels` folder に配置します。
3. After Effects で `Allow Scripts to Write Files and Access Network` を有効化します。
4. AE を再起動し、`Window > mcp-bridge-auto.jsx` を開いて `Auto-run commands` を ON にします。
5. `ae-mcp serve-daemon` を起動するか、service を install/start します。
6. MCP クライアントに `ae-mcp serve-stdio` を登録します。
7. `list-ae-instances` を実行し、AE が見えていることを確認します。

> [!NOTE]
> `serve-stdio` 単体では AE 実行は行いません。実行系 tool を使うには、同じ設定で `serve-daemon` が起動している必要があります。

### 3.2 インストール補足

最新版は [GitHub Releases](https://github.com/Aodaruma/after-effects-mcp-rs/releases/latest) から取得できます。

- Windows: `.msi` インストーラー、または portable `.zip`
- macOS: `.pkg` インストーラー、または portable `.tar.gz`

`.msi` / `.pkg` で導入した場合、検出された After Effects に `mcp-bridge-auto.jsx` が自動配置されます。portable 版を使う場合は手動で配置してください。

Bridge panel の配置先:

- Windows: `C:\Program Files\Adobe\Adobe After Effects <YEAR>\Support Files\Scripts\ScriptUI Panels\`
- macOS: `/Applications/Adobe After Effects <YEAR>/Scripts/ScriptUI Panels/`

`ae-mcp` インストール後に AE を追加・更新した場合は、bridge installer を再実行してください。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

```bash
bash ./scripts/install-bridge.sh
```

インストール済み binary で daemon を service 起動する例:

```powershell
& "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" service install
& "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" service start
```

```bash
ae-mcp service install
ae-mcp service start
```

Codex CLI への登録例:

```powershell
codex mcp add aftereffects -- "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" serve-stdio
```

```bash
codex mcp add aftereffects -- /usr/local/bin/ae-mcp serve-stdio
```

### 3.3 開発者向けセットアップ

前提は Adobe After Effects、Rust stable、Cargo です。

source から build します。

```bash
cargo build --release -p ae-mcp
```

repository 内の bridge panel を配置します。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

```bash
bash ./scripts/install-bridge.sh
```

別 terminal で daemon を起動します。

```powershell
.\target\release\ae-mcp.exe serve-daemon
```

MCP クライアントに stdio server を登録します。

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH>/target/release/ae-mcp.exe" serve-stdio
```

macOS では `.exe` を外してください。

## 4. クイック動作確認

```powershell
<AE_MCP_PATH> health
<AE_MCP_PATH> serve-daemon
```

別ターミナルでMCP tool経路を確認します。

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list-ae-instances","arguments":{}}}' | <AE_MCP_PATH> serve-stdio
```

AEで `Window > mcp-bridge-auto.jsx` を開き `Auto-run commands` をONにすると、`list-ae-instances` に `instanceId` と `appVersion` が表示されます。

## 5. 使用例

任意JSXを実行:

```json
{
  "code": "return app.project ? app.project.numItems : 0;",
  "mode": "unsafe",
  "description": "Count project items",
  "timeoutMs": 10000,
  "resultRetentionSeconds": 3600
}
```

特定のAE instanceを指定:

```json
{
  "code": "return app.version;",
  "mode": "unsafe",
  "description": "Check AE version",
  "targetInstanceId": "ae-25.0-...",
  "timeoutMs": 10000
}
```

timeout後に結果を再確認:

```json
{
  "requestId": "req-..."
}
```

このpayloadを `get-jsx-result` に渡します。

`run-jsx` 経由で、安定 ID 指定でエフェクトを適用:

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

エフェクトの利用可能パラメータを確認:

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

環境で使えるエフェクト一覧を確認:

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

## 6. 利用可能な MCP ツール

| ツール | 説明 |
|---|---|
| `run-jsx` | daemon broker経由でunsafe JSXを実行 |
| `run-jsx-file` | daemon broker経由でローカルJSXファイルを実行 |
| `get-jsx-result` | `requestId` から保持済み結果を取得 |
| `list-ae-instances` | 起動中のAE bridge instanceとバージョンを取得 |
| `get-results` | 最新の保持済み結果、または `requestId` 指定結果を取得 |
| `get-help` | 基本ヘルプ |
| `save-frame-png` | 1フレームPNGプレビュー保存 |
| `cleanup-preview-folder` | previewファイル削除。AE instance間でglobal exclusive |
| `run-bridge-test` | ブリッジ/エフェクト簡易テスト |

多くのAE操作は `run-jsx` / `run-jsx-file` で行います。daemonは同一AE instance内のFIFOを保証し、異なるAE instanceは並列実行できます。

主要オプション:

| オプション | 説明 |
|---|---|
| `mode` | 必須。現在は `unsafe` のみ |
| `description` | 必須。ログとAE undo groupに使う説明 |
| `timeoutMs` | MCP呼び出しが待つ時間 |
| `resultRetentionSeconds` | 結果保持秒数。既定 `3600`、上限 `86400` |
| `targetInstanceId` | AE instanceを厳密指定 |
| `targetVersion` | AE `appVersion` / 表示名で指定 |

target選択:

- AE instanceが0件ならエラー
- AE instanceが1件だけなら自動選択
- AE instanceが複数件なら `targetInstanceId` または `targetVersion` を指定

## 7. トラブルシュート

- 実行系toolがdaemon接続エラーを返す:
  - `ae-mcp serve-daemon` を起動、またはserviceをinstall/start
  - `health` で `daemon_addr` を確認
- `list-ae-instances` が空:
  - AE パネル未起動
  - `Auto-run commands` が OFF
  - スクリプト更新後のパネル再読込漏れ
- 複数AE instanceが起動している:
  - `list-ae-instances` を実行
  - `targetInstanceId` または `targetVersion` を指定
- `get-jsx-result` が `timeout` を返す:
  - MCP呼び出しが待ちきれなかった状態で、AE側の実行は継続している可能性があります
  - 同じ `requestId` でもう一度 `get-jsx-result` を実行
- インストーラー導入後に AE でパネルが見つからない:
  - AE再起動後に `Window > mcp-bridge-auto.jsx` を確認
  - 見つからない場合は `install-bridge.ps1` / `install-bridge.sh` を手動実行
- 確認対象ファイル:
  - `~/Documents/ae-mcp-bridge/instances/<instanceId>/heartbeat.json`
  - `~/Documents/ae-mcp-bridge/instances/<instanceId>/ae_command.json`
  - `~/Documents/ae-mcp-bridge/instances/<instanceId>/ae_mcp_result.json`
  - `~/Documents/ae-mcp-bridge/registry/<requestId>.json`
- Windows で `service install` が Access Denied:
  - 管理者権限シェル（`gsudo` など）で実行
- `-AfterEffectsPath` が `C:\Program` に分断される:
  - シングルクォートで指定
    - `-AfterEffectsPath 'C:\Program Files\Adobe\Adobe After Effects 2025'`

## 8. 設定

既定値:

| キー | 既定値 | 説明 |
|---|---:|---|
| `daemon_addr` | `127.0.0.1:47655` | ローカルdaemon brokerのアドレス |
| `poll_interval_ms` | `250` | AE結果poll間隔 |
| `result_timeout_ms` | `5000` | 既定の実行待機timeout |
| `result_retention_seconds` | `3600` | 既定の結果保持秒数 |
| `result_retention_max_seconds` | `86400` | 許可する最大保持秒数 |
| `instance_heartbeat_stale_ms` | `10000` | AE heartbeatをstale扱いする閾値 |

TOML設定例:

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

`command_file` と `result_file` は互換用のfallback pathです。daemon経由の実行では `root_dir/instances/<instanceId>/` 以下のinstance別ファイルを使います。

daemonとstdioには同じconfigを指定してください。

```powershell
ae-mcp --config C:\path\ae-mcp.toml serve-daemon
codex mcp add aftereffects -- ae-mcp --config C:\path\ae-mcp.toml serve-stdio
```

## 9. ドキュメント

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Signing and RC guide](docs/signing-and-rc.md)
- [TS to Rust migration guide](docs/migration-guide-ts-to-rust.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)

## 10. ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
