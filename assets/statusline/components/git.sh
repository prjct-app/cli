#!/bin/bash
# prjct statusline - Git component
# Displays the current branch (truncated) and dirty status

# Truncate branch name: keep prefix + 10 chars after slash
# feat/PRJ-101-hierarchical-scope → feat/PRJ-101-hi...
truncate_branch() {
  local branch="$1"
  local max_suffix=10

  # If branch has a slash (e.g., feat/something)
  if [[ "$branch" == *"/"* ]]; then
    local prefix="${branch%%/*}"
    local suffix="${branch#*/}"

    # If suffix is longer than max, truncate with ...
    if [[ ${#suffix} -gt $max_suffix ]]; then
      suffix="${suffix:0:$max_suffix}..."
    fi

    echo "${prefix}/${suffix}"
  else
    # No slash, just truncate if too long
    if [[ ${#branch} -gt 15 ]]; then
      echo "${branch:0:15}..."
    else
      echo "$branch"
    fi
  fi
}

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

  # Truncate long branch names
  local display_branch=$(truncate_branch "$branch")

  echo -e "${SECONDARY}${display_branch}${dirty}${NC}"
}
