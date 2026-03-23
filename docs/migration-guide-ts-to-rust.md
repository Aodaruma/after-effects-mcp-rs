# TS版からRust版への移行ガイド（Stage 7）

- 最終更新: 2026-03-23
- 対象: `after-effects-mcp` (Node/TS) から `ae-mcp` (Rust) への移行

## 1. 変更概要

1. MCPサーバー本体を Node.js から Rust バイナリへ移行
2. AEブリッジ方式（`ae_command.json` / `ae_mcp_result.json`）は互換維持
3. サービス化コマンド（`service install/start/...`）を追加

## 2. コマンド対応表

| 旧 (TS) | 新 (Rust) |
|---|---|
| `npm run build` | `cargo build --release -p ae-mcp` |
| `npm start` | `ae-mcp serve-stdio` |
| `npm run install-bridge` | `scripts/install-bridge.ps1` / `scripts/install-bridge.sh` |
| `node build/index.js` | `target/release/ae-mcp serve-stdio` |

## 3. 移行手順

1. Rust版バイナリをビルド
2. AEブリッジパネルをシェルスクリプトで導入
3. CodexのMCP設定を `ae-mcp serve-stdio` に更新
4. `run-script` / `get-results` の最小動作確認
5. 必要に応じて `service install` で常駐化

## 4. 互換性メモ

1. tool/resource/prompt 名は互換維持を優先
2. `test-animation` は一時スクリプト生成型として継続
3. エラーメッセージはRust実装側で明確化（権限不足など）

## 5. ロールバック

このリポジトリでは Node/TS 実装は削除済みです。  
そのため、同一ブランチ内で `node build/index.js` へ戻すロールバックはできません。

ロールバックが必要な場合:

1. 旧TS実装を含むコミット/タグへチェックアウト
2. MCPクライアント設定を旧Nodeエントリポイントへ切替
3. AE側パネル（`mcp-bridge-auto.jsx`）は共通利用可能
