# 🎬 After Effects MCP Server (Rust)

![Rust](https://img.shields.io/badge/rust-stable-orange)
![Build](https://img.shields.io/badge/build-passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-After%20Effects-blue)

Adobe After Effects 向けの Rust 製 MCP サーバーです。  
`mcp-bridge-auto.jsx` パネルとファイルブリッジ（`ae_command.json` / `ae_mcp_result.json`）で AE と連携します。

- English: [README.md](README.md)

## 目次

- [機能](#機能)
  - [コンポジション関連](#コンポジション関連)
  - [レイヤー・アニメーション関連](#レイヤーアニメーション関連)
  - [エフェクト適用と調査](#エフェクト適用と調査)
  - [運用・配布](#運用配布)
- [セットアップ](#セットアップ)
  - [前提](#前提)
  - [ビルド](#ビルド)
  - [AE ブリッジパネルの導入](#ae-ブリッジパネルの導入)
  - [After Effects 側の設定](#after-effects-側の設定)
  - [MCP サーバー登録](#mcp-サーバー登録)
- [クイック動作確認](#クイック動作確認)
- [使用例](#使用例)
- [利用可能な MCP ツール](#利用可能な-mcp-ツール)
- [トラブルシュート](#トラブルシュート)
- [ドキュメント](#ドキュメント)
- [ライセンス](#ライセンス)

## 機能

### コンポジション関連

- 幅・高さ・duration・framerate・背景色を指定したコンポジション作成
- コンポジション一覧取得、プロジェクト情報取得
- 旧 TS サーバーからの tool/resource/prompt 名互換を重視

### レイヤー・アニメーション関連

- テキスト・シェイプ・ソリッド/調整レイヤーの作成
- レイヤープロパティ更新
- キーフレーム/エクスプレッション設定
- ターゲット指定方法:
  - `compId/layerId`（推奨）
  - `compName/layerName`
  - `compIndex/layerIndex`

### エフェクト適用と調査

- エフェクト直接適用（`apply-effect`）とテンプレート適用（`apply-effect-template`）
- `smooth-gradient` テンプレート（Gradient Ramp フォールバック付き）
- `list-supported-effects`: 既知エフェクトカタログの環境可用性確認
- `describe-effect`: エフェクトを一時適用してパラメータ情報を取得
- ExtendScript 互換性対応（`Object.keys` 非依存）

### 運用・配布

- `serve-stdio` で MCP クライアントと接続
- `serve-daemon` / `service` で OS サービス運用
- Windows/macOS のパッケージングスクリプトと CI ワークフローを用意
- このリポジトリは Rust 一本化済み（npm/TypeScript サーバーは削除済み）

## セットアップ

### 前提

- Adobe After Effects（2022+ 推奨）
- Rust stable / Cargo
- Windows または macOS

### ビルド

```bash
cargo build --release -p ae-mcp
```

生成物:

- Windows: `target/release/ae-mcp.exe`
- macOS: `target/release/ae-mcp`

### AE ブリッジパネルの導入

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

macOS (bash):

```bash
bash ./scripts/install-bridge.sh
```

### After Effects 側の設定

1. `Edit > Preferences > Scripting & Expressions` を開く
2. `Allow Scripts to Write Files and Access Network` を有効化
3. After Effects を再起動
4. `Window > mcp-bridge-auto.jsx` を開く
5. `Auto-run commands` を ON

### MCP サーバー登録

Codex CLI 例:

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH>/target/release/ae-mcp.exe" serve-stdio
```

macOS では `.exe` を外してください。

## クイック動作確認

```powershell
.\target\release\ae-mcp.exe health
.\target\release\ae-mcp.exe bridge run-script --script listCompositions --parameters '{}'
.\target\release\ae-mcp.exe bridge get-results
```

## 使用例

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

## 利用可能な MCP ツール

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

## トラブルシュート

- `ae_command.json` が `pending` のまま:
  - AE パネル未起動
  - `Auto-run commands` が OFF
  - スクリプト更新後のパネル再読込漏れ
- `get-results` が `waiting`/stale:
  - `~/Documents/ae-mcp-bridge/ae_command.json` と `ae_mcp_result.json` の更新時刻を確認
- Windows で `service install` が Access Denied:
  - 管理者権限シェル（`gsudo` など）で実行
- `-AfterEffectsPath` が `C:\Program` に分断される:
  - シングルクォートで指定
    - `-AfterEffectsPath 'C:\Program Files\Adobe\Adobe After Effects 2025'`

## ドキュメント

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Signing and RC guide](docs/signing-and-rc.md)
- [TS to Rust migration guide](docs/migration-guide-ts-to-rust.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
