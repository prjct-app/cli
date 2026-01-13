#!/bin/bash
# prjct statusline - Context component
# Displays context window usage (minimal - only when it matters)

component_context() {
  component_enabled "context" || return

  # CTX_PERCENT is set by parse_stdin in cache.sh
  local min_percent="${CONFIG_CONTEXT_MIN_PERCENT:-30}"

  # Only show when usage is significant
  [[ "$CTX_PERCENT" -lt "$min_percent" ]] && return

  # Determine color based on usage
  local color
  if [[ "$CTX_PERCENT" -ge 80 ]]; then
    color="$ERROR"
  elif [[ "$CTX_PERCENT" -ge 50 ]]; then
    color="$ACCENT"
  else
    color="$MUTED"
  fi

  echo -e "${color}${CTX_PERCENT}%${NC}"
}
