#!/bin/bash
# prjct statusline - Changes component
# Displays lines added and removed

component_changes() {
  component_enabled "changes" || return

  # ADDED and REMOVED are set by parse_stdin in cache.sh
  echo -e "${SUCCESS}+${ADDED}${NC} ${ERROR}-${REMOVED}${NC}"
}
