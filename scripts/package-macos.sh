#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-./dist/macos}"
REQUIRE_PKG="${REQUIRE_PKG:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

mkdir -p "$OUTPUT_DIR"

pushd "$REPO_ROOT" >/dev/null

echo "Building release binary..."
cargo build --release -p ae-mcp

BIN_PATH="$REPO_ROOT/target/release/ae-mcp"
if [[ ! -f "$BIN_PATH" ]]; then
  echo "Release binary not found: $BIN_PATH" >&2
  exit 1
fi

STAGE_DIR="$OUTPUT_DIR/stage"
mkdir -p "$STAGE_DIR"
cp "$BIN_PATH" "$STAGE_DIR/ae-mcp"
chmod +x "$STAGE_DIR/ae-mcp"

ARCHIVE_PATH="$OUTPUT_DIR/after-effects-mcp-rs-macos-universal.tar.gz"
tar -C "$STAGE_DIR" -czf "$ARCHIVE_PATH" .
echo "Created archive: $ARCHIVE_PATH"

if ! command -v pkgbuild >/dev/null 2>&1; then
  MSG="pkgbuild is not available; skipped pkg generation."
  if [[ "$REQUIRE_PKG" == "true" ]]; then
    echo "$MSG" >&2
    exit 1
  fi
  echo "$MSG"
  popd >/dev/null
  exit 0
fi

PKG_ROOT="$OUTPUT_DIR/pkgroot"
INSTALL_BIN_DIR="$PKG_ROOT/usr/local/bin"
mkdir -p "$INSTALL_BIN_DIR"
cp "$STAGE_DIR/ae-mcp" "$INSTALL_BIN_DIR/ae-mcp"

PKG_PATH="$OUTPUT_DIR/after-effects-mcp-rs-macos-universal.pkg"
pkgbuild \
  --root "$PKG_ROOT" \
  --identifier "io.github.aodaruma.after-effects-mcp-rs" \
  --version "0.1.0" \
  --install-location "/" \
  "$PKG_PATH"

echo "Created package: $PKG_PATH"
popd >/dev/null

