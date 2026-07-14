#!/bin/bash
# prjct statusline - Context component
# Displays context window usage (minimal - only when it matters)

component_context() {
  component_enabled "context" || return

  # CTX_PERCENT is set by parse_stdin in cache.sh (host context-window fill %)
  local min_percent="${CONFIG_CONTEXT_MIN_PERCENT:-30}"

  # Only show when usage is significant
  [[ -z "$CTX_PERCENT" || ! "$CTX_PERCENT" =~ ^[0-9]+$ ]] && return
  [[ "$CTX_PERCENT" -lt "$min_percent" ]] && return

  # Determine color based on usage — ≥60% is prjct compact-path territory
  # (align with context-pressure WARN_RATIO 0.6 / Claude utilization guard).
  local color
  local suffix=""
  if [[ "$CTX_PERCENT" -ge 70 ]]; then
    color="$ERROR"
    suffix=" →land"
  elif [[ "$CTX_PERCENT" -ge 60 ]]; then
    color="$ERROR"
    suffix=" →land"
  elif [[ "$CTX_PERCENT" -ge 50 ]]; then
    color="$ACCENT"
  else
    color="$MUTED"
  fi

  echo -e "${color}${CTX_PERCENT}%${suffix}${NC}"
}
