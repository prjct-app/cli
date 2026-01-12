#!/bin/bash
# prjct statusline - prjct icon component
# Displays the prjct brand icon

component_prjct_icon() {
  component_enabled "prjct_icon" || return

  echo -e "${PRIMARY}${BOLD}${ICON_PRJCT}${NC}"
}
