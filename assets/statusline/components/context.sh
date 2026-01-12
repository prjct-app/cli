#!/bin/bash
# prjct statusline - Context component
# Displays context window usage progress bar

component_context() {
  component_enabled "context" || return

  # CTX_PERCENT is set by parse_stdin in cache.sh
  local bar_width="${CONFIG_CONTEXT_BAR_WIDTH:-10}"
  local filled=$((CTX_PERCENT * bar_width / 100))
  local empty=$((bar_width - filled))

  # Determine color based on usage
  local bar_color
  if [[ "$CTX_PERCENT" -ge 80 ]]; then
    bar_color="$ERROR"
  elif [[ "$CTX_PERCENT" -ge 50 ]]; then
    bar_color="$ACCENT"
  else
    bar_color="$SUCCESS"
  fi

  # Build progress bar
  local bar="${bar_color}"
  for ((i=0; i<filled; i++)); do bar+="█"; done
  bar+="${MUTED}"
  for ((i=0; i<empty; i++)); do bar+="░"; done
  bar+="${NC}"

  echo -e "${MUTED}ctx${NC} ${bar} ${MUTED}${CTX_PERCENT}%${NC}"
}
