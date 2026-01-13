#!/bin/bash
# prjct statusline - Git component
# Displays the current branch and dirty status

component_git() {
  component_enabled "git" || return

  local cache_file="${CACHE_DIR}/git.cache"
  local git_data=""

  # Check cache first
  if cache_valid "$cache_file" "$CONFIG_CACHE_TTL_GIT"; then
    git_data=$(cat "$cache_file")
  else
    # Check if in git repo
    if ! git -C "$CWD" rev-parse --git-dir > /dev/null 2>&1; then
      return
    fi

    # Get branch name
    local branch=$(git -C "$CWD" branch --show-current 2>/dev/null)
    [[ -z "$branch" ]] && return

    # Check for dirty state
    local dirty=""
    if [[ -n $(git -C "$CWD" status --porcelain 2>/dev/null | head -1) ]]; then
      dirty="*"
    fi

    git_data="${branch}|${dirty}"

    # Cache the result
    write_cache "$cache_file" "$git_data"
  fi

  [[ -z "$git_data" ]] && return

  # Parse git data
  local branch=$(echo "$git_data" | cut -d'|' -f1)
  local dirty=$(echo "$git_data" | cut -d'|' -f2)

  [[ -z "$branch" ]] && return

  echo -e "${SECONDARY}${branch}${dirty}${NC}"
}
