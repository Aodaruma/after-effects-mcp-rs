# インストーラ E2E 手順（Stage 5）

- 最終更新: 2026-03-23
- 対象: Rust版 `ae-mcp` の Windows/macOS インストーラ検証

## 1. 目的

1. クリーン環境で導入から起動確認までを再現する
2. インストーラ導入後に `service` サブコマンドが動作することを確認する
3. AEブリッジとMCPの最小往復が成立することを確認する

## 2. 生成物

## 2.1 Windows

- `after-effects-mcp-rs-windows-x86_64.zip`
- `after-effects-mcp-rs-windows-x86_64.msi`

生成コマンド:

```powershell
.\scripts\package-windows.ps1 -OutputDir .\dist\windows -RequireMsi
```

## 2.2 macOS

- `after-effects-mcp-rs-macos-universal.tar.gz`
- `after-effects-mcp-rs-macos-universal.pkg`

生成コマンド:

```bash
REQUIRE_PKG=true ./scripts/package-macos.sh ./dist/macos
```

## 3. E2E 検証チェックリスト

## 3.1 インストール

1. インストーラ実行（MSI/pkg）
2. `ae-mcp` バイナリが所定の場所へ配置される
3. `ae-mcp --help` が実行できる

## 3.2 サービス

1. `service install`
2. `service start`
3. `service status`
4. `service stop`
5. `service uninstall`

## 3.3 MCP + AE ブリッジ

1. `mcp-bridge-auto.jsx` をAEに配置
2. AEで `Window > mcp-bridge-auto.jsx` を開く
3. `Auto-run commands` をON
4. Codexで `run-script(script=listCompositions)` を実行
5. `get-results` で結果JSON取得

## 4. 失敗時の確認ポイント

1. Windowsで `OpenSCManager FAILED 5`:
   - 管理者PowerShellで再実行
2. macOSでpkg生成失敗:
   - `pkgbuild --version` を確認
3. AE結果が返らない:
   - `~/Documents/ae-mcp-bridge/ae_command.json` の `status` を確認

## 5. CI

- GitHub Actions: `.github/workflows/installer-build.yml`
- 実行方法:
1. `workflow_dispatch` で手動実行
2. `v*` タグPushで自動実行

