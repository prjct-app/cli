#!/bin/bash
# prjct-cli SessionStart Hook
# Inyecta contexto fresco del proyecto al inicio de cada sesión Claude Code
# https://prjct.app

set -e

# Solo ejecutar si estamos en un proyecto prjct
if [[ -f ".prjct/prjct.config.json" ]]; then
  # Extraer projectId
  PROJECT_ID=$(cat .prjct/prjct.config.json 2>/dev/null | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

  if [[ -n "$PROJECT_ID" ]]; then
    PRJCT_HOME="$HOME/.prjct-cli/projects/$PROJECT_ID"

    if [[ -d "$PRJCT_HOME" ]]; then
      # Leer versión CLI
      CLI_VERSION="unknown"
      if [[ -f "$PRJCT_HOME/project.json" ]]; then
        CLI_VERSION=$(cat "$PRJCT_HOME/project.json" 2>/dev/null | grep -o '"cliVersion"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        [[ -z "$CLI_VERSION" ]] && CLI_VERSION="unknown"
      fi

      # Leer tarea actual
      CURRENT_TASK=""
      if [[ -f "$PRJCT_HOME/context/now.md" ]]; then
        CURRENT_TASK=$(cat "$PRJCT_HOME/context/now.md" 2>/dev/null | head -20)
      fi

      # Leer nombre del proyecto
      PROJECT_NAME=""
      if [[ -f "$PRJCT_HOME/project.json" ]]; then
        PROJECT_NAME=$(cat "$PRJCT_HOME/project.json" 2>/dev/null | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
      fi

      # Output para Claude Code
      echo "---"
      echo "prjct-cli v$CLI_VERSION"
      echo "Project: $PROJECT_NAME ($PROJECT_ID)"
      echo "Storage: $PRJCT_HOME"
      echo "---"

      if [[ -n "$CURRENT_TASK" ]]; then
        echo ""
        echo "Current Task:"
        echo "$CURRENT_TASK"
      fi
    fi
  fi
fi
