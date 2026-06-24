#!/usr/bin/env bash
# ============================================================================
# prjct statusline v2 for Claude Code
# Modular component system with graceful degradation
# ============================================================================

# Require bash 4.0+ for associative arrays
if [[ ${BASH_VERSINFO[0]} -lt 4 ]]; then
  # Try to find a modern bash and re-exec
  for bash_path in /opt/homebrew/bin/bash /usr/local/bin/bash; do
    if [[ -x "$bash_path" ]] && "$bash_path" -c '[[ ${BASH_VERSINFO[0]} -ge 4 ]]' 2>/dev/null; then
      exec "$bash_path" "$0" "$@"
    fi
  done
  # Fallback: simple output without components
  echo "prjct"
  exit 0
fi

# Current CLI version (replaced by postinstall/setup with actual version)
CLI_VERSION="__VERSION__"

# Base paths
STATUSLINE_DIR="${HOME}/.prjct-cli/statusline"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use installed location or script location for libs/components
if [[ -f "${STATUSLINE_DIR}/lib/cache.sh" && -f "${STATUSLINE_DIR}/lib/theme.sh" && -f "${STATUSLINE_DIR}/lib/config.sh" ]]; then
  LIB_DIR="${STATUSLINE_DIR}/lib"
  COMPONENTS_DIR="${STATUSLINE_DIR}/components"
else
  LIB_DIR="${SCRIPT_DIR}/lib"
  COMPONENTS_DIR="${SCRIPT_DIR}/components"
fi

# Source libraries
source "${LIB_DIR}/cache.sh" 2>/dev/null || {
  echo "prjct: lib/cache.sh missing"
  exit 1
}
source "${LIB_DIR}/theme.sh" 2>/dev/null || {
  echo "prjct: lib/theme.sh missing"
  exit 1
}
source "${LIB_DIR}/config.sh" 2>/dev/null || {
  echo "prjct: lib/config.sh missing"
  exit 1
}

# Source all components
for component_file in "${COMPONENTS_DIR}"/*.sh; do
  [[ -f "$component_file" ]] && source "$component_file" 2>/dev/null
done

# Read stdin (Claude Code passes session data)
INPUT=$(cat)

# Initialize
ensure_cache_dir
load_config
load_theme
parse_stdin "$INPUT"

# Version check removed - was causing confusing duplicate statusline display
# Users will see update prompts when running p. commands

# ============================================================================
# Build Statusline
# ============================================================================
build_statusline() {
  local line=""
  local sep=" ${MUTED}│${NC} "
  local first=true

  # Get sorted list of enabled components
  local components=$(get_enabled_components)

  for component_name in $components; do
    # Call the component function
    local func_name="component_${component_name}"

    # Check if function exists
    if declare -f "$func_name" > /dev/null 2>&1; then
      local output=$($func_name)

      # Skip empty outputs (graceful degradation)
      [[ -z "$output" ]] && continue

      # Add separator between components
      if [[ "$first" == "true" ]]; then
        line="$output"
        first=false
      else
        line+="${sep}${output}"
      fi
    fi
  done

  echo -e "$line"
}

# Output the statusline
build_statusline
