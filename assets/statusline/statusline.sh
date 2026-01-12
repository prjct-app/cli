#!/bin/bash
# ============================================================================
# prjct statusline v2 for Claude Code
# Modular component system with graceful degradation
# ============================================================================

# Current CLI version (updated by postinstall/sync)
CLI_VERSION="0.29.0"

# Base paths
STATUSLINE_DIR="${HOME}/.prjct-cli/statusline"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use installed location or script location for libs/components
if [[ -d "${STATUSLINE_DIR}/lib" ]]; then
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

# ============================================================================
# Version Check - Show update notification if needed
# ============================================================================
check_version_upgrade() {
  local config_file="${CWD}/.prjct/prjct.config.json"

  [[ ! -f "$config_file" ]] && return 1

  local project_id=$(jq -r '.projectId // ""' "$config_file" 2>/dev/null)
  [[ -z "$project_id" ]] && return 1

  local project_json="${HOME}/.prjct-cli/projects/${project_id}/project.json"
  [[ ! -f "$project_json" ]] && {
    echo -e "${WARNING}prjct v${CLI_VERSION}${NC} ${MUTED}run p. sync${NC}"
    return 0
  }

  local project_version=$(jq -r '.cliVersion // ""' "$project_json" 2>/dev/null)

  if [[ -z "$project_version" ]] || [[ "$project_version" != "$CLI_VERSION" ]]; then
    echo -e "${WARNING}prjct v${CLI_VERSION}${NC} ${MUTED}run p. sync${NC}"
    return 0
  fi

  return 1
}

# Check for version upgrade first
VERSION_MSG=$(check_version_upgrade)
if [[ -n "$VERSION_MSG" ]]; then
  echo -e "$VERSION_MSG"
  exit 0
fi

# ============================================================================
# Build Statusline
# ============================================================================
build_statusline() {
  local line=""
  local sep=" ${MUTED}${ICON_SEPARATOR}${NC} "
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
