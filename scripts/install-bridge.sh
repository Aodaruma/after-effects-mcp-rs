#!/usr/bin/env bash
set -euo pipefail

AE_PATH=""
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ae-path)
      AE_PATH="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--ae-path <path>] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_SCRIPT="$REPO_ROOT/src/scripts/mcp-bridge-auto.jsx"

if [[ ! -f "$SOURCE_SCRIPT" ]]; then
  echo "Bridge script not found: $SOURCE_SCRIPT" >&2
  exit 1
fi

if [[ -z "$AE_PATH" ]]; then
  CANDIDATES=(
    "/Applications/Adobe After Effects 2026"
    "/Applications/Adobe After Effects 2025"
    "/Applications/Adobe After Effects 2024"
    "/Applications/Adobe After Effects 2023"
    "/Applications/Adobe After Effects 2022"
    "/Applications/Adobe After Effects 2021"
  )
  for path in "${CANDIDATES[@]}"; do
    if [[ -d "$path" ]]; then
      AE_PATH="$path"
      break
    fi
  done
fi

if [[ -z "$AE_PATH" || ! -d "$AE_PATH" ]]; then
  echo "After Effects path not found. Use --ae-path <path>." >&2
  exit 1
fi

DEST_DIR="$AE_PATH/Scripts/ScriptUI Panels"
DEST_FILE="$DEST_DIR/mcp-bridge-auto.jsx"

echo "Source      : $SOURCE_SCRIPT"
echo "Destination : $DEST_FILE"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run mode: no copy executed."
  exit 0
fi

if [[ -w "$AE_PATH" || -w "$DEST_DIR" ]]; then
  mkdir -p "$DEST_DIR"
  cp "$SOURCE_SCRIPT" "$DEST_FILE"
else
  echo "Destination may require sudo. Installing with sudo..."
  sudo mkdir -p "$DEST_DIR"
  sudo cp "$SOURCE_SCRIPT" "$DEST_FILE"
fi

echo
echo "Bridge script installed."
echo "Next steps:"
echo "1. Open After Effects"
echo "2. After Effects > Settings > Scripting & Expressions"
echo "3. Enable \"Allow Scripts to Write Files and Access Network\""
echo "4. Restart After Effects"
echo "5. Open Window > mcp-bridge-auto.jsx"

