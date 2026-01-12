#!/bin/bash
# prjct statusline - Linear integration component
# Displays the linked Linear issue ID and priority

component_linear() {
  component_enabled "linear" || return
  [[ "${CONFIG_LINEAR_ENABLED}" != "true" ]] && return

  local cache_file="${CACHE_DIR}/linear.cache"
  local issue_data=""

  # Check cache first
  if cache_valid "$cache_file" "$CONFIG_CACHE_TTL_LINEAR"; then
    issue_data=$(cat "$cache_file")
  else
    # Get project ID
    local project_id=$(get_project_id)
    [[ -z "$project_id" ]] && return

    local global_path="${HOME}/.prjct-cli/projects/${project_id}"
    local state_file="${global_path}/storage/state.json"
    local issues_file="${global_path}/storage/issues.json"

    # Check if state file exists
    [[ ! -f "$state_file" ]] && return

    # Get linked issue from current task
    local linked_issue=$(jq -r '.currentTask.linkedIssue // ""' "$state_file" 2>/dev/null)

    # If no linked issue, try to get from issues.json (last worked)
    if [[ -z "$linked_issue" ]] && [[ -f "$issues_file" ]]; then
      # Get most recently updated issue that's in_progress
      linked_issue=$(jq -r '
        .issues // {} | to_entries
        | map(select(.value.status == "in_progress"))
        | sort_by(.value.updatedAt) | last
        | .key // ""
      ' "$issues_file" 2>/dev/null)
    fi

    [[ -z "$linked_issue" ]] && return

    # Get issue details from issues cache
    if [[ -f "$issues_file" ]]; then
      issue_data=$(jq -r --arg id "$linked_issue" '
        .issues[$id] // {} |
        "\(.externalId // "")|\(.priority // "none")"
      ' "$issues_file" 2>/dev/null)

      # Cache the result
      write_cache "$cache_file" "$issue_data"
    fi
  fi

  # Return empty if no data
  [[ -z "$issue_data" || "$issue_data" == "|" ]] && return

  # Parse issue data
  local issue_id=$(echo "$issue_data" | cut -d'|' -f1)
  local priority=$(echo "$issue_data" | cut -d'|' -f2)

  [[ -z "$issue_id" ]] && return

  # Format output
  local output="${ACCENT}${issue_id}${NC}"

  # Add priority icon if enabled and priority is significant
  if [[ "${CONFIG_LINEAR_SHOW_PRIORITY}" == "true" ]]; then
    local priority_icon=$(get_priority_icon "$priority")
    [[ -n "$priority_icon" ]] && output+="${priority_icon}"
  fi

  echo -e "$output"
}
