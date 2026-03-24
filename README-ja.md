# 🎬 After Effects MCP Server (Rust)

![Rust](https://img.shields.io/badge/rust-stable-orange)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-After%20Effects-blue)

Adobe After Effects 向けの Rust 製 MCP サーバーです。  
`mcp-bridge-auto.jsx` パネルとファイルブリッジ（`ae_command.json` / `ae_mcp_result.json`）で AE と連携します。

- English: [README.md](README.md)

## 0. 目次

- [1. フォーク元からの改善点](#1-フォーク元からの改善点)
- [2. 機能](#2-機能)
  - [2.1 コンポジション関連](#21-コンポジション関連)
  - [2.2 レイヤー・アニメーション関連](#22-レイヤーアニメーション関連)
  - [2.3 エフェクト適用と調査](#23-エフェクト適用と調査)
  - [2.4 運用・配布](#24-運用配布)
- [3. セットアップ](#3-セットアップ)
  - [3.1 インストール方法（ユーザー向け）](#31-インストール方法ユーザー向け)
    - [3.1-A バイナリを取得](#31-a-バイナリを取得)
    - [3.1-B AE ブリッジパネルを配置](#31-b-ae-ブリッジパネルを配置)
    - [3.1-C After Effects 側を設定](#31-c-after-effects-側を設定)
    - [3.1-D MCP サーバーを登録](#31-d-mcp-サーバーを登録)
  - [3.2 Development setup（開発者向け）](#32-development-setup開発者向け)
    - [3.2-A 前提](#32-a-前提)
    - [3.2-B ビルド](#32-b-ビルド)
    - [3.2-C スクリプトで AE ブリッジ導入](#32-c-スクリプトで-ae-ブリッジ導入)
    - [3.2-D After Effects 側の設定](#32-d-after-effects-側の設定)
    - [3.2-E MCP サーバー登録](#32-e-mcp-サーバー登録)
- [4. クイック動作確認](#4-クイック動作確認)
- [5. 使用例](#5-使用例)
- [6. 利用可能な MCP ツール](#6-利用可能な-mcp-ツール)
- [7. トラブルシュート](#7-トラブルシュート)
- [8. ドキュメント](#8-ドキュメント)
- [9. ライセンス](#9-ライセンス)

## 1. フォーク元からの改善点

- 実行基盤を Node.js/TypeScript から Rust（`ae-mcp`）へ移行
- 実行・導入フローから npm/yarn 依存を削減
- `compId/layerId` 指定を追加し、index ずれによる誤適用リスクを低減
- エフェクト調査機能を追加
  - `list-supported-effects`
  - `describe-effect`
- ExtendScript 互換性を改善（旧エンジンでの `Object.keys` 依存を排除）
- `mcp-bridge-auto.jsx` を強化
  - Dockable panel 対応
  - 権限未許可時のUI状態管理
  - モーダルダイアログ衝突時の再試行制御
- Windows/macOS のパッケージングと Release 自動化を整備

## 2. 機能

### 2.1 コンポジション関連

- 幅・高さ・duration・framerate・背景色を指定したコンポジション作成
- コンポジション一覧取得、プロジェクト情報取得
- 旧 TS サーバーからの tool/resource/prompt 名互換を重視

### 2.2 レイヤー・アニメーション関連

- テキスト・シェイプ・ソリッド/調整レイヤーの作成
- レイヤープロパティ更新
- キーフレーム/エクスプレッション設定
- ターゲット指定方法:
  - `compId/layerId`（推奨）
  - `compName/layerName`
  - `compIndex/layerIndex`

### 2.3 エフェクト適用と調査

- エフェクト直接適用（`apply-effect`）とテンプレート適用（`apply-effect-template`）
- `smooth-gradient` テンプレート（Gradient Ramp フォールバック付き）
- `list-supported-effects`: 既知エフェクトカタログの環境可用性確認
- `describe-effect`: エフェクトを一時適用してパラメータ情報を取得
- ExtendScript 互換性対応（`Object.keys` 非依存）

### 2.4 運用・配布

- `serve-stdio` で MCP クライアントと接続
- `serve-daemon` / `service` で OS サービス運用
- Windows/macOS のパッケージングスクリプトと CI ワークフローを用意
- インストーラー経由のブリッジ自動配置
  - `.msi` / `.pkg` は検出した AE へ `mcp-bridge-auto.jsx` を自動配置
  - ポータブル版（`.zip` / `.tar.gz`）は同梱 jsx を手動配置
- このリポジトリは Rust 一本化済み（npm/TypeScript サーバーは削除済み）

## 3. セットアップ

### 3.1 インストール方法（ユーザー向け）

#### 3.1-A バイナリを取得

[GitHub Releases](https://github.com/Aodaruma/after-effects-mcp-rs/releases/latest) から最新版を取得します。

- Windows:
  - `after-effects-mcp-rs-windows-x86_64.msi`（インストーラ）
  - `after-effects-mcp-rs-windows-x86_64.zip`（ポータブル）
- macOS:
  - `after-effects-mcp-rs-macos-universal.pkg`（インストーラ）
  - `after-effects-mcp-rs-macos-universal.tar.gz`（ポータブル）

#### 3.1-B AE ブリッジパネルを配置

`.msi`（Windows）または `.pkg`（macOS）で導入した場合は、インストーラーが検出した After Effects へ `mcp-bridge-auto.jsx` を自動配置します。

ポータブル版（`.zip` / `.tar.gz`）を使う場合は、以下の手順で手動配置してください。

`mcp-bridge-auto.jsx` を以下のいずれかから取得し、配置します。

- このリポジトリの `src/scripts/mcp-bridge-auto.jsx`
- [raw ファイル](https://raw.githubusercontent.com/Aodaruma/after-effects-mcp-rs/main/src/scripts/mcp-bridge-auto.jsx)

配置先:

- Windows: `C:\Program Files\Adobe\Adobe After Effects <YEAR>\Support Files\Scripts\ScriptUI Panels\`
- macOS: `/Applications/Adobe After Effects <YEAR>/Scripts/ScriptUI Panels/`

`.msi` / `.pkg` 導入後に AE を追加インストール・更新した場合は、1回だけ手動導入を実行してください。

- Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1`
- macOS: `bash ./scripts/install-bridge.sh`

#### 3.1-C After Effects 側を設定

1. `Edit > Preferences > Scripting & Expressions` を開く
2. `Allow Scripts to Write Files and Access Network` を有効化
3. After Effects を再起動
4. `Window > mcp-bridge-auto.jsx` を開く
5. `Auto-run commands` を ON

#### 3.1-D MCP サーバーを登録

Codex CLI 例:

Windows（`.msi` の既定配置先）:

```powershell
codex mcp add aftereffects -- "C:\Program Files\AfterEffectsMcp\ae-mcp.exe" serve-stdio
```

macOS（`.pkg` の既定配置先）:

```bash
codex mcp add aftereffects -- /usr/local/bin/ae-mcp serve-stdio
```

### 3.2 Development setup（開発者向け）

#### 3.2-A 前提

- Adobe After Effects（2022+ 推奨）
- Rust stable / Cargo
- Windows または macOS

#### 3.2-B ビルド

```bash
cargo build --release -p ae-mcp
```

生成物:

- Windows: `target/release/ae-mcp.exe`
- macOS: `target/release/ae-mcp`

#### 3.2-C スクリプトで AE ブリッジ導入

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

`-AfterEffectsPath` を省略した場合、検出された `Adobe After Effects <YEAR>` すべてにコピーします。

macOS (bash):

```bash
bash ./scripts/install-bridge.sh
```

`--ae-path` を省略した場合、検出された `/Applications/Adobe After Effects <YEAR>` すべてにコピーします。

#### 3.2-D After Effects 側の設定

1. `Edit > Preferences > Scripting & Expressions` を開く
2. `Allow Scripts to Write Files and Access Network` を有効化
3. After Effects を再起動
4. `Window > mcp-bridge-auto.jsx` を開く
5. `Auto-run commands` を ON

#### 3.2-E MCP サーバー登録

Codex CLI 例:

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH>/target/release/ae-mcp.exe" serve-stdio
```

macOS では `.exe` を外してください。

## 4. クイック動作確認

```powershell
<AE_MCP_PATH> health
<AE_MCP_PATH> bridge run-script --script listCompositions --parameters '{}'
<AE_MCP_PATH> bridge get-results
```

## 5. 使用例

安定 ID 指定でエフェクトを適用:

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

エフェクトの利用可能パラメータを確認:

```json
{
  "compId": 1,
  "layerId": 15,
  "effectMatchName": "ADBE Glo2"
}
```

環境で使えるエフェクト一覧を確認:

```json
{
  "compName": "Main Comp",
  "layerName": "FX Layer",
  "includeUnavailable": true
}
```

## 6. 利用可能な MCP ツール

| ツール | 説明 |
|---|---|
| `run-script` | allowlist 方式でブリッジスクリプトを実行 |
| `get-results` | 最新のブリッジ結果を取得 |
| `get-help` | 基本ヘルプ |
| `create-composition` | コンポジション作成 |
| `setLayerKeyframe` | キーフレーム設定 |
| `setLayerExpression` | エクスプレッション設定/削除 |
| `apply-effect` | レイヤーへエフェクト適用 |
| `apply-effect-template` | テンプレート適用 |
| `list-supported-effects` | 既知カタログの可用性確認 |
| `describe-effect` | エフェクトパラメータ調査 |
| `mcp_aftereffects_applyEffect` | 直接呼び出し版 |
| `mcp_aftereffects_applyEffectTemplate` | 直接呼び出し版 |
| `mcp_aftereffects_listSupportedEffects` | 直接呼び出し版 |
| `mcp_aftereffects_describeEffect` | 直接呼び出し版 |
| `mcp_aftereffects_get_effects_help` | エフェクトヘルプ |
| `run-bridge-test` | ブリッジ/エフェクト簡易テスト |

## 7. トラブルシュート

- `ae_command.json` が `pending` のまま:
  - AE パネル未起動
  - `Auto-run commands` が OFF
  - スクリプト更新後のパネル再読込漏れ
- インストーラー導入後に AE でパネルが見つからない:
  - AE再起動後に `Window > mcp-bridge-auto.jsx` を確認
  - 見つからない場合は `install-bridge.ps1` / `install-bridge.sh` を手動実行
- `get-results` が `waiting`/stale:
  - `~/Documents/ae-mcp-bridge/ae_command.json` と `ae_mcp_result.json` の更新時刻を確認
- Windows で `service install` が Access Denied:
  - 管理者権限シェル（`gsudo` など）で実行
- `-AfterEffectsPath` が `C:\Program` に分断される:
  - シングルクォートで指定
    - `-AfterEffectsPath 'C:\Program Files\Adobe\Adobe After Effects 2025'`

## 8. ドキュメント

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Signing and RC guide](docs/signing-and-rc.md)
- [TS to Rust migration guide](docs/migration-guide-ts-to-rust.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)

## 9. ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
