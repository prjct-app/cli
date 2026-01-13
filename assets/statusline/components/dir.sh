#!/bin/bash
# prjct statusline - Directory component
# Displays the current directory name

component_dir() {
  component_enabled "dir" || return

  local dir_name=$(basename "$CWD")

  echo -e "${ACCENT}${dir_name}${NC}"
}
