#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="${1:-./dist/macos}"

: "${MAC_CODESIGN_IDENTITY:?MAC_CODESIGN_IDENTITY is required}"
: "${APPLE_ID:?APPLE_ID is required}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?APPLE_APP_SPECIFIC_PASSWORD is required}"

if [[ ! -d "$ARTIFACT_DIR" ]]; then
  echo "Artifact directory not found: $ARTIFACT_DIR" >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Xcode Command Line Tools are required." >&2
  exit 1
fi

# Sign binaries before notarization.
while IFS= read -r -d '' bin_file; do
  echo "Codesigning binary: $bin_file"
  codesign --force --timestamp --sign "$MAC_CODESIGN_IDENTITY" "$bin_file"
done < <(find "$ARTIFACT_DIR" -type f -name "ae-mcp" -print0)

while IFS= read -r -d '' pkg_file; do
  echo "Submitting notarization: $pkg_file"
  xcrun notarytool submit "$pkg_file" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --wait

  echo "Stapling notarization ticket: $pkg_file"
  xcrun stapler staple "$pkg_file"
done < <(find "$ARTIFACT_DIR" -type f -name "*.pkg" -print0)

echo "macOS notarization completed."

