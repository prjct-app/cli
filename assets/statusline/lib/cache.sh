#!/bin/bash
# prjct statusline - Cache utilities
# Optimized caching for fast statusline rendering

# Cache directory
CACHE_DIR="/tmp/prjct_statusline"

# Ensure cache directory exists
ensure_cache_dir() {
  [[ -d "$CACHE_DIR" ]] || mkdir -p "$CACHE_DIR"
}

# Check if cache file is still valid
# Usage: cache_valid "/path/to/cache" 30
# Returns: 0 if valid, 1 if expired/missing
cache_valid() {
  local file="$1"
  local ttl="${2:-30}"

  [[ ! -f "$file" ]] && return 1

  # Get file age in seconds (macOS and Linux compatible)
  local mtime
  if [[ "$OSTYPE" == "darwin"* ]]; then
    mtime=$(stat -f %m "$file" 2>/dev/null)
  else
    mtime=$(stat -c %Y "$file" 2>/dev/null)
  fi

  [[ -z "$mtime" ]] && return 1

  local now=$(date +%s)
  local age=$((now - mtime))

  [[ "$age" -lt "$ttl" ]]
}

# Read from cache if valid, otherwise return empty
# Usage: result=$(read_cache "/path/to/cache" 30)
read_cache() {
  local file="$1"
  local ttl="${2:-30}"

  if cache_valid "$file" "$ttl"; then
    cat "$file"
  fi
}

# Write to cache
# Usage: write_cache "/path/to/cache" "content"
write_cache() {
  local file="$1"
  local content="$2"

  ensure_cache_dir
  echo "$content" > "$file"
}

# Parse all stdin data in a single jq call
# Sets global variables: MODEL, CWD, ADDED, REMOVED, CTX_SIZE, INPUT_TOKENS, etc.
parse_stdin() {
  local input="$1"

  # Single jq call to extract all values
  local parsed
  parsed=$(echo "$input" | jq -r '
    [
      (.model.display_name // "Claude"),
      (.workspace.current_dir // "~"),
      (.cost.total_lines_added // 0),
      (.cost.total_lines_removed // 0),
      (.context_window.context_window_size // 200000),
      (.context_window.current_usage.input_tokens // 0),
      (.context_window.current_usage.cache_creation_input_tokens // 0),
      (.context_window.current_usage.cache_read_input_tokens // 0)
    ] | @tsv
  ' 2>/dev/null)

  # Parse tab-separated values (save/restore IFS to avoid breaking associative arrays)
  local old_ifs="$IFS"
  IFS=$'\t' read -r MODEL CWD ADDED REMOVED CTX_SIZE INPUT_TOKENS CACHE_CREATE CACHE_READ <<< "$parsed"
  IFS="$old_ifs"

  # Set defaults if parsing failed
  MODEL="${MODEL:-Claude}"
  CWD="${CWD:-~}"
  ADDED="${ADDED:-0}"
  REMOVED="${REMOVED:-0}"
  CTX_SIZE="${CTX_SIZE:-200000}"
  INPUT_TOKENS="${INPUT_TOKENS:-0}"
  CACHE_CREATE="${CACHE_CREATE:-0}"
  CACHE_READ="${CACHE_READ:-0}"

  # Calculate context percentage
  TOTAL_USED=$((INPUT_TOKENS + CACHE_CREATE + CACHE_READ))
  if [[ "$CTX_SIZE" -gt 0 ]] 2>/dev/null; then
    CTX_PERCENT=$((TOTAL_USED * 100 / CTX_SIZE))
  else
    CTX_PERCENT=0
  fi
  [[ "$CTX_PERCENT" -gt 100 ]] && CTX_PERCENT=100
  [[ "$CTX_PERCENT" -lt 0 ]] && CTX_PERCENT=0
}

# Get project ID from .prjct/prjct.config.json
# Usage: project_id=$(get_project_id)
get_project_id() {
  local config_file="${CWD}/.prjct/prjct.config.json"

  [[ ! -f "$config_file" ]] && return

  jq -r '.projectId // ""' "$config_file" 2>/dev/null
}

# Get global path for project storage
# Usage: global_path=$(get_global_path "project-id")
get_global_path() {
  local project_id="$1"
  [[ -z "$project_id" ]] && return
  echo "${HOME}/.prjct-cli/projects/${project_id}"
}
