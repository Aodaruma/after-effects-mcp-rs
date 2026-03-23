# after-effects-mcp-rs

Rust 実装の After Effects MCP サーバーです。  
After Effects 側の `mcp-bridge-auto.jsx` と、`~/Documents/ae-mcp-bridge` の command/result ファイルを使って連携します。

## 現状（2026-03-23）

- 実運用の中心は Rust バイナリ `ae-mcp`
- 旧 npm/TypeScript サーバー実装はこのリポジトリから削除済み（Rust一本化）
- `serve-stdio`（MCP サーバー）、`serve-daemon`、`service`（Win/macOS）を提供
- エフェクト操作は以下をサポート
  - `apply-effect`
  - `apply-effect-template`
  - `list-supported-effects`（既知エフェクトの利用可否チェック）
  - `describe-effect`（エフェクトのパラメータ一覧取得）
- ターゲット指定は `compId/layerId`（推奨）・`compName/layerName`・`compIndex/layerIndex`

## 必要環境

- Adobe After Effects（2022+ 推奨）
- Rust stable / Cargo
- Windows または macOS

## クイックスタート

### 1. ビルド

```bash
cargo build --release -p ae-mcp
```

- Windows: `target/release/ae-mcp.exe`
- macOS: `target/release/ae-mcp`

### 2. Bridge パネル導入（npm不要）

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-bridge.ps1
```

macOS:

```bash
bash ./scripts/install-bridge.sh
```

### 3. After Effects 側設定

1. `Edit > Preferences > Scripting & Expressions`
2. `Allow Scripts to Write Files and Access Network` を有効化
3. After Effects 再起動
4. `Window > mcp-bridge-auto.jsx` を開く
5. `Auto-run commands` を ON

### 4. Codex MCP 設定例

```bash
codex mcp add aftereffects -- "<ABSOLUTE_PATH_TO>/target/release/ae-mcp.exe" serve-stdio
```

macOS は実行ファイル名から `.exe` を外してください。

### 5. 動作確認

```powershell
.\target\release\ae-mcp.exe health
.\target\release\ae-mcp.exe bridge run-script --script listCompositions --parameters '{}'
.\target\release\ae-mcp.exe bridge get-results
```

## 主要ツール

- 基本
  - `run-script`
  - `get-results`
  - `get-help`
  - `create-composition`
  - `setLayerKeyframe`
  - `setLayerExpression`
- エフェクト
  - `apply-effect`
  - `apply-effect-template`
  - `list-supported-effects`
  - `describe-effect`
  - `mcp_aftereffects_get_effects_help`

`run-script` は allowlist 方式です（任意スクリプト実行ではありません）。

## ID 指定について

- Composition ID は `listCompositions` 結果で取得可能
- Layer ID は `createTextLayer` / `createShapeLayer` / `createSolidLayer` / `applyEffect` / `applyEffectTemplate` の結果で取得可能
- `getLayerInfo` でも Layer ID を返します（アクティブコンポ前提）

推奨は `compId/layerId` での指定です。

## エフェクト調査の推奨フロー

1. `list-supported-effects` で環境可用性を確認
2. `describe-effect` で対象エフェクトのパラメータ名・範囲を確認
3. `apply-effect` で `effectSettings` を指定して適用

補足:
- プラグイン系エフェクトは表示名と `matchName` が一致しない場合があります。
- 例: Glow は環境により `ADBE Glow` ではなく `ADBE Glo2` の場合があります。

## トラブルシュート

### `ae_command.json` が `pending` のまま

- `mcp-bridge-auto.jsx` が開いていない
- `Auto-run commands` が OFF
- パネル再読込漏れ（更新後は再オープン推奨）

### `get-results` が `waiting` / stale warning

- AE 側パネル未実行の可能性が高いです。
- `~/Documents/ae-mcp-bridge/ae_command.json` / `ae_mcp_result.json` の更新時刻を確認してください。

### Windows `service install` で Access Denied

- 管理者権限で実行してください（`gsudo` または管理者 PowerShell）。

### PowerShell で `-AfterEffectsPath` が `C:\Program` に切れる

- 引数をシングルクォートで渡してください。
  - 例: `-AfterEffectsPath 'C:\Program Files\Adobe\Adobe After Effects 2025'`

## 関連ドキュメント

- [Rust migration specification](docs/specification-rust-migration.md)
- [Development stages](docs/development-stages.md)
- [Codex MCP setup guide](docs/setup-codex-mcp.md)
- [Installer E2E guide](docs/installer-e2e.md)
- [Operations runbook](docs/operations-runbook.md)
- [GA release checklist](docs/release-checklist.md)
