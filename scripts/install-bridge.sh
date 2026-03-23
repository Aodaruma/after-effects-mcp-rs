#!/usr/bin/env bash
set -euo pipefail

AE_PATH=""
DRY_RUN="false"
AE_PATHS=()

add_unique_path() {
  local candidate="$1"
  local existing
  for existing in "${AE_PATHS[@]}"; do
    if [[ "$existing" == "$candidate" ]]; then
      return
    fi
  done
  AE_PATHS+=("$candidate")
}

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
      echo "If --ae-path is omitted, installs to all detected After Effects versions." >&2
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

if [[ -n "$AE_PATH" ]]; then
  if [[ ! -d "$AE_PATH" ]]; then
    echo "After Effects path not found: $AE_PATH" >&2
    exit 1
  fi
  add_unique_path "$AE_PATH"
else
  CANDIDATES=(
    "/Applications/Adobe After Effects 2030"
    "/Applications/Adobe After Effects 2029"
    "/Applications/Adobe After Effects 2028"
    "/Applications/Adobe After Effects 2027"
    "/Applications/Adobe After Effects 2026"
    "/Applications/Adobe After Effects 2025"
    "/Applications/Adobe After Effects 2024"
    "/Applications/Adobe After Effects 2023"
    "/Applications/Adobe After Effects 2022"
    "/Applications/Adobe After Effects 2021"
  )

  for path in "${CANDIDATES[@]}"; do
    if [[ -d "$path" ]]; then
      add_unique_path "$path"
    fi
  done

  while IFS= read -r path; do
    case "$path" in
      /Applications/Adobe\ After\ Effects\ [0-9][0-9][0-9][0-9])
        add_unique_path "$path"
        ;;
    esac
  done < <(find /Applications -maxdepth 1 -type d -name "Adobe After Effects *" 2>/dev/null | sort -r)
fi

if [[ "${#AE_PATHS[@]}" -eq 0 ]]; then
  echo "After Effects path not found. Use --ae-path <path>." >&2
  exit 1
fi

echo "Source      : $SOURCE_SCRIPT"
echo "Destinations:"
for ae in "${AE_PATHS[@]}"; do
  echo "  - $ae/Scripts/ScriptUI Panels/mcp-bridge-auto.jsx"
done

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run mode: no copy executed."
  exit 0
fi

for ae in "${AE_PATHS[@]}"; do
  DEST_DIR="$ae/Scripts/ScriptUI Panels"
  DEST_FILE="$DEST_DIR/mcp-bridge-auto.jsx"

  if [[ -w "$ae" || ( -d "$DEST_DIR" && -w "$DEST_DIR" ) ]]; then
    mkdir -p "$DEST_DIR"
    cp "$SOURCE_SCRIPT" "$DEST_FILE"
  else
    echo "Destination may require sudo. Installing with sudo for: $ae"
    sudo mkdir -p "$DEST_DIR"
    sudo cp "$SOURCE_SCRIPT" "$DEST_FILE"
  fi
done

echo
echo "Bridge script installed to ${#AE_PATHS[@]} location(s)."
for ae in "${AE_PATHS[@]}"; do
  echo "  - $ae/Scripts/ScriptUI Panels/mcp-bridge-auto.jsx"
done
echo "Next steps:"
echo "1. Open After Effects"
echo "2. After Effects > Settings > Scripting & Expressions"
echo "3. Enable \"Allow Scripts to Write Files and Access Network\""
echo "4. Restart After Effects"
echo "5. Open Window > mcp-bridge-auto.jsx"
