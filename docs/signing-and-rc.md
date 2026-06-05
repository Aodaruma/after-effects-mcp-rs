# 署名・公証・RC運用ガイド（Stage 6）

- 最終更新: 2026-03-23
- 対象: `v*-rc*` タグでの RC リリース運用

## 1. 概要

Stage 6 では、配布物の信頼性向上のため以下を実施します。

1. Windows: Authenticode 署名
2. macOS: codesign + Notarization + staple
3. RCタグでのCI自動化

関連ワークフロー:

- `.github/workflows/rc-release.yml`

## 2. Windows 署名

## 2.1 ローカル実行

```powershell
.\scripts\sign-windows.ps1 -ArtifactDir .\dist\windows -PfxPath <path-to-pfx> -PfxPassword <password>
```

必要条件:

1. `signtool.exe` が利用可能
2. PFX証明書とパスワード

## 2.2 CIシークレット

1. `WIN_SIGN_PFX_BASE64` (PFXをbase64化した文字列)
2. `WIN_SIGN_PFX_PASSWORD`
3. 任意: `WIN_SIGN_TIMESTAMP_URL`

## 3. macOS 公証

## 3.1 ローカル実行

```bash
MAC_CODESIGN_IDENTITY="<identity>" \
APPLE_ID="<apple-id>" \
APPLE_TEAM_ID="<team-id>" \
APPLE_APP_SPECIFIC_PASSWORD="<app-password>" \
./scripts/notarize-macos.sh ./dist/macos
```

必要条件:

1. `xcrun`（Xcode Command Line Tools）
2. 有効な署名ID（keychain内）
3. Apple notarization 用資格情報

## 3.2 CIシークレット

必須（notarization実行時）:

1. `MAC_CODESIGN_IDENTITY`
2. `APPLE_ID`
3. `APPLE_TEAM_ID`
4. `APPLE_APP_SPECIFIC_PASSWORD`

任意（証明書をCIにimportする場合）:

1. `MAC_CERT_P12_BASE64`
2. `MAC_CERT_PASSWORD`
3. `MAC_KEYCHAIN_PASSWORD`

## 4. RC リリース手順

1. `vX.Y.Z-rcN` タグを作成して push
2. `RC Release` workflow を確認
3. 生成物（Windows/macOS）をダウンロード
4. 署名/公証がスキップされていないことを確認

## 5. 注意事項

1. シークレット未設定時、ワークフローは警告を出して署名工程をスキップします。
2. 実運用では本番リリース前に必ず署名済みファイルの検証を行ってください。
3. macOS証明書運用は組織ポリシーに合わせてkeychainの扱いを固定化してください。

