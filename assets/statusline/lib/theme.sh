#!/bin/bash
# prjct statusline - Theme loading utilities
# Loads colors and icons from theme JSON files

# Default theme location
STATUSLINE_DIR="${HOME}/.prjct-cli/statusline"
THEME_DIR="${STATUSLINE_DIR}/themes"

# Default colors (ANSI 256) - used as fallback
DEFAULT_PRIMARY='\033[38;5;252m'     # Light gray/white - neutral
DEFAULT_ACCENT='\033[38;5;252m'      # Light gray/white
DEFAULT_SECONDARY='\033[38;5;248m'   # Medium gray
DEFAULT_MUTED='\033[38;5;245m'       # Gray
DEFAULT_SUCCESS='\033[38;5;108m'     # Muted green
DEFAULT_ERROR='\033[38;5;174m'       # Muted red/pink
DEFAULT_WARNING='\033[38;5;180m'     # Muted yellow
DEFAULT_PURPLE='\033[38;5;182m'      # Muted purple

# Default icons
DEFAULT_ICON_PRJCT="⚡"
DEFAULT_ICON_DIR="󰉋"
DEFAULT_ICON_GIT=""
DEFAULT_ICON_SEPARATOR="│"
DEFAULT_ICON_OPUS="🎭"
DEFAULT_ICON_SONNET="📝"
DEFAULT_ICON_HAIKU="🍃"
DEFAULT_ICON_DEFAULT="🤖"
DEFAULT_ICON_PRIORITY_URGENT="🔴"
DEFAULT_ICON_PRIORITY_HIGH="🟠"
DEFAULT_ICON_PRIORITY_MEDIUM="🟡"

# Text formatting
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Convert ANSI 256 color code to escape sequence
color_to_escape() {
  local code="$1"
  [[ -z "$code" ]] && return
  echo "\\033[38;5;${code}m"
}

# Load theme from JSON file
# Sets global color and icon variables
load_theme() {
  local theme_name="${CONFIG_THEME:-default}"
  local theme_file="${THEME_DIR}/${theme_name}.json"

  # Fallback to default theme
  [[ ! -f "$theme_file" ]] && theme_file="${THEME_DIR}/default.json"

  # If still no theme file, use defaults
  if [[ ! -f "$theme_file" ]]; then
    set_default_colors
    set_default_icons
    return
  fi

  # Load all colors and icons in a single jq call
  local theme_data
  theme_data=$(jq -r '
    [
      (.colors.primary // "51"),
      (.colors.accent // "220"),
      (.colors.secondary // "147"),
      (.colors.muted // "242"),
      (.colors.success // "114"),
      (.colors.error // "204"),
      (.colors.warning // "214"),
      (.colors.purple // "183"),
      (.icons.prjct // "⚡"),
      (.icons.dir // "󰉋"),
      (.icons.git // ""),
      (.icons.separator // "│"),
      (.icons.opus // "🎭"),
      (.icons.sonnet // "📝"),
      (.icons.haiku // "🍃"),
      (.icons.default_model // "🤖"),
      (.icons.priority_urgent // "🔴"),
      (.icons.priority_high // "🟠"),
      (.icons.priority_medium // "🟡")
    ] | @tsv
  ' "$theme_file" 2>/dev/null)

  if [[ -z "$theme_data" ]]; then
    set_default_colors
    set_default_icons
    return
  fi

  # Parse theme data (save/restore IFS to avoid breaking associative arrays)
  local old_ifs="$IFS"
  IFS=$'\t' read -r \
    C_PRIMARY C_ACCENT C_SECONDARY C_MUTED C_SUCCESS C_ERROR C_WARNING C_PURPLE \
    ICON_PRJCT ICON_DIR ICON_GIT ICON_SEPARATOR ICON_OPUS ICON_SONNET ICON_HAIKU ICON_DEFAULT ICON_PRIORITY_URGENT ICON_PRIORITY_HIGH ICON_PRIORITY_MEDIUM \
    <<< "$theme_data"
  IFS="$old_ifs"

  # Convert color codes to escape sequences
  PRIMARY=$(color_to_escape "$C_PRIMARY")
  ACCENT=$(color_to_escape "$C_ACCENT")
  SECONDARY=$(color_to_escape "$C_SECONDARY")
  MUTED=$(color_to_escape "$C_MUTED")
  SUCCESS=$(color_to_escape "$C_SUCCESS")
  ERROR=$(color_to_escape "$C_ERROR")
  WARNING=$(color_to_escape "$C_WARNING")
  PURPLE=$(color_to_escape "$C_PURPLE")

  # Set icons (use defaults for any missing)
  ICON_PRJCT="${ICON_PRJCT:-$DEFAULT_ICON_PRJCT}"
  ICON_DIR="${ICON_DIR:-$DEFAULT_ICON_DIR}"
  ICON_GIT="${ICON_GIT:-$DEFAULT_ICON_GIT}"
  ICON_SEPARATOR="${ICON_SEPARATOR:-$DEFAULT_ICON_SEPARATOR}"
  ICON_OPUS="${ICON_OPUS:-$DEFAULT_ICON_OPUS}"
  ICON_SONNET="${ICON_SONNET:-$DEFAULT_ICON_SONNET}"
  ICON_HAIKU="${ICON_HAIKU:-$DEFAULT_ICON_HAIKU}"
  ICON_DEFAULT="${ICON_DEFAULT:-$DEFAULT_ICON_DEFAULT}"
  ICON_PRIORITY_URGENT="${ICON_PRIORITY_URGENT:-$DEFAULT_ICON_PRIORITY_URGENT}"
  ICON_PRIORITY_HIGH="${ICON_PRIORITY_HIGH:-$DEFAULT_ICON_PRIORITY_HIGH}"
  ICON_PRIORITY_MEDIUM="${ICON_PRIORITY_MEDIUM:-$DEFAULT_ICON_PRIORITY_MEDIUM}"
}

# Set default colors
set_default_colors() {
  PRIMARY="$DEFAULT_PRIMARY"
  ACCENT="$DEFAULT_ACCENT"
  SECONDARY="$DEFAULT_SECONDARY"
  MUTED="$DEFAULT_MUTED"
  SUCCESS="$DEFAULT_SUCCESS"
  ERROR="$DEFAULT_ERROR"
  WARNING="$DEFAULT_WARNING"
  PURPLE="$DEFAULT_PURPLE"
}

# Set default icons
set_default_icons() {
  ICON_PRJCT="$DEFAULT_ICON_PRJCT"
  ICON_DIR="$DEFAULT_ICON_DIR"
  ICON_GIT="$DEFAULT_ICON_GIT"
  ICON_SEPARATOR="$DEFAULT_ICON_SEPARATOR"
  ICON_OPUS="$DEFAULT_ICON_OPUS"
  ICON_SONNET="$DEFAULT_ICON_SONNET"
  ICON_HAIKU="$DEFAULT_ICON_HAIKU"
  ICON_DEFAULT="$DEFAULT_ICON_DEFAULT"
  ICON_PRIORITY_URGENT="$DEFAULT_ICON_PRIORITY_URGENT"
  ICON_PRIORITY_HIGH="$DEFAULT_ICON_PRIORITY_HIGH"
  ICON_PRIORITY_MEDIUM="$DEFAULT_ICON_PRIORITY_MEDIUM"
}

# Get model icon based on model name
get_model_icon() {
  local model="$1"
  case "$model" in
    *Opus*|*opus*)     echo "$ICON_OPUS" ;;
    *Sonnet*|*sonnet*) echo "$ICON_SONNET" ;;
    *Haiku*|*haiku*)   echo "$ICON_HAIKU" ;;
    *)                 echo "$ICON_DEFAULT" ;;
  esac
}

# Get priority icon
get_priority_icon() {
  local priority="$1"
  case "$priority" in
    urgent) echo "$ICON_PRIORITY_URGENT" ;;
    high)   echo "$ICON_PRIORITY_HIGH" ;;
    medium) echo "$ICON_PRIORITY_MEDIUM" ;;
    *)      echo "" ;;
  esac
}
