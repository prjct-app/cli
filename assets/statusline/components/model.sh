#!/bin/bash
# prjct statusline - Model component
# Displays the current model icon

component_model() {
  component_enabled "model" || return

  # MODEL is set by parse_stdin in cache.sh
  local icon=$(get_model_icon "$MODEL")

  echo -e "$icon"
}
