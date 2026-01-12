#!/bin/bash
# prjct statusline - Configuration loading utilities
# Loads user preferences for statusline customization

# Config file location
CONFIG_FILE="${HOME}/.prjct-cli/statusline/config.json"

# Default configuration values
DEFAULT_THEME="default"
DEFAULT_CACHE_TTL_PRJCT=30
DEFAULT_CACHE_TTL_GIT=5
DEFAULT_CACHE_TTL_LINEAR=60
DEFAULT_TASK_MAX_LENGTH=25
DEFAULT_CONTEXT_BAR_WIDTH=10

# Component configuration (will be populated by load_config)
declare -A COMPONENT_ENABLED
declare -A COMPONENT_POSITION

# Load configuration from JSON file
# Sets global CONFIG_* variables
load_config() {
  # Set defaults first
  CONFIG_THEME="$DEFAULT_THEME"
  CONFIG_CACHE_TTL_PRJCT="$DEFAULT_CACHE_TTL_PRJCT"
  CONFIG_CACHE_TTL_GIT="$DEFAULT_CACHE_TTL_GIT"
  CONFIG_CACHE_TTL_LINEAR="$DEFAULT_CACHE_TTL_LINEAR"
  CONFIG_TASK_MAX_LENGTH="$DEFAULT_TASK_MAX_LENGTH"
  CONFIG_CONTEXT_BAR_WIDTH="$DEFAULT_CONTEXT_BAR_WIDTH"
  CONFIG_LINEAR_ENABLED="true"
  CONFIG_LINEAR_SHOW_PRIORITY="true"

  # Default component configuration
  COMPONENT_ENABLED["prjct_icon"]="true"
  COMPONENT_ENABLED["task"]="true"
  COMPONENT_ENABLED["linear"]="true"
  COMPONENT_ENABLED["dir"]="true"
  COMPONENT_ENABLED["git"]="true"
  COMPONENT_ENABLED["changes"]="true"
  COMPONENT_ENABLED["context"]="true"
  COMPONENT_ENABLED["model"]="true"

  COMPONENT_POSITION["prjct_icon"]=0
  COMPONENT_POSITION["task"]=1
  COMPONENT_POSITION["linear"]=2
  COMPONENT_POSITION["dir"]=3
  COMPONENT_POSITION["git"]=4
  COMPONENT_POSITION["changes"]=5
  COMPONENT_POSITION["context"]=6
  COMPONENT_POSITION["model"]=7

  # Load config file if exists
  [[ ! -f "$CONFIG_FILE" ]] && return

  # Parse config in a single jq call
  local config_data
  config_data=$(jq -r '
    [
      (.theme // "default"),
      (.cacheTTL.prjct // 30),
      (.cacheTTL.git // 5),
      (.cacheTTL.linear // 60),
      (.components.task.maxLength // 25),
      (.components.context.barWidth // 10),
      (.components.linear.showPriority // true),
      (.components.prjct_icon.enabled // true),
      (.components.task.enabled // true),
      (.components.linear.enabled // true),
      (.components.dir.enabled // true),
      (.components.git.enabled // true),
      (.components.changes.enabled // true),
      (.components.context.enabled // true),
      (.components.model.enabled // true),
      (.components.prjct_icon.position // 0),
      (.components.task.position // 1),
      (.components.linear.position // 2),
      (.components.dir.position // 3),
      (.components.git.position // 4),
      (.components.changes.position // 5),
      (.components.context.position // 6),
      (.components.model.position // 7)
    ] | @tsv
  ' "$CONFIG_FILE" 2>/dev/null)

  [[ -z "$config_data" ]] && return

  # Parse tab-separated values
  IFS=$'\t' read -r \
    CONFIG_THEME \
    CONFIG_CACHE_TTL_PRJCT CONFIG_CACHE_TTL_GIT CONFIG_CACHE_TTL_LINEAR \
    CONFIG_TASK_MAX_LENGTH CONFIG_CONTEXT_BAR_WIDTH CONFIG_LINEAR_SHOW_PRIORITY \
    E_PRJCT_ICON E_TASK E_LINEAR E_DIR E_GIT E_CHANGES E_CONTEXT E_MODEL \
    P_PRJCT_ICON P_TASK P_LINEAR P_DIR P_GIT P_CHANGES P_CONTEXT P_MODEL \
    <<< "$config_data"

  # Set component enabled states
  COMPONENT_ENABLED["prjct_icon"]="$E_PRJCT_ICON"
  COMPONENT_ENABLED["task"]="$E_TASK"
  COMPONENT_ENABLED["linear"]="$E_LINEAR"
  COMPONENT_ENABLED["dir"]="$E_DIR"
  COMPONENT_ENABLED["git"]="$E_GIT"
  COMPONENT_ENABLED["changes"]="$E_CHANGES"
  COMPONENT_ENABLED["context"]="$E_CONTEXT"
  COMPONENT_ENABLED["model"]="$E_MODEL"

  # Set component positions
  COMPONENT_POSITION["prjct_icon"]="$P_PRJCT_ICON"
  COMPONENT_POSITION["task"]="$P_TASK"
  COMPONENT_POSITION["linear"]="$P_LINEAR"
  COMPONENT_POSITION["dir"]="$P_DIR"
  COMPONENT_POSITION["git"]="$P_GIT"
  COMPONENT_POSITION["changes"]="$P_CHANGES"
  COMPONENT_POSITION["context"]="$P_CONTEXT"
  COMPONENT_POSITION["model"]="$P_MODEL"

  # Update linear enabled based on component config
  CONFIG_LINEAR_ENABLED="${COMPONENT_ENABLED["linear"]}"
}

# Check if a component is enabled
# Usage: if component_enabled "task"; then ...
component_enabled() {
  local name="$1"
  [[ "${COMPONENT_ENABLED[$name]}" == "true" ]]
}

# Get component position
# Usage: pos=$(component_position "task")
component_position() {
  local name="$1"
  echo "${COMPONENT_POSITION[$name]:-99}"
}

# Get sorted list of enabled components
# Usage: components=$(get_enabled_components)
get_enabled_components() {
  local components=()

  for name in "${!COMPONENT_ENABLED[@]}"; do
    if [[ "${COMPONENT_ENABLED[$name]}" == "true" ]]; then
      components+=("${COMPONENT_POSITION[$name]}:$name")
    fi
  done

  # Sort by position and extract names
  printf '%s\n' "${components[@]}" | sort -t: -k1 -n | cut -d: -f2
}
