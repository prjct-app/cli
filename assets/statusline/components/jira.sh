#!/bin/bash
# prjct statusline - JIRA integration component
# Displays the linked JIRA issue key and priority

component_jira() {
  component_enabled "jira" || return
  [[ "${CONFIG_JIRA_ENABLED}" != "true" ]] && return

  local cache_file="${CACHE_DIR}/jira.cache"
  local issue_data=""

  # Check cache first
  if cache_valid "$cache_file" "$CONFIG_CACHE_TTL_JIRA"; then
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
    local linked_issue=""

    # First check if current task has a linked JIRA issue
    local linked_provider=$(jq -r '.currentTask.linkedIssue.provider // ""' "$state_file" 2>/dev/null)
    if [[ "$linked_provider" == "jira" ]]; then
      linked_issue=$(jq -r '.currentTask.linkedIssue.id // ""' "$state_file" 2>/dev/null)
    fi

    # If no linked issue, try to get from issues.json (last worked)
    if [[ -z "$linked_issue" ]] && [[ -f "$issues_file" ]]; then
      # Check if issues.json is for JIRA
      local provider=$(jq -r '.provider // ""' "$issues_file" 2>/dev/null)
      if [[ "$provider" == "jira" ]]; then
        # Get most recently updated issue that's in_progress
        linked_issue=$(jq -r '
          .issues // {} | to_entries
          | map(select(.value.status == "in_progress"))
          | sort_by(.value.updatedAt) | last
          | .key // ""
        ' "$issues_file" 2>/dev/null)
      fi
    fi

    [[ -z "$linked_issue" ]] && return

    # Get issue details from issues cache
    if [[ -f "$issues_file" ]]; then
      issue_data=$(jq -r --arg id "$linked_issue" '
        .issues[$id] // {} |
        "\(.externalId // "")|\(.priority // "none")|\(.status // "")"
      ' "$issues_file" 2>/dev/null)

      # Cache the result
      write_cache "$cache_file" "$issue_data"
    fi
  fi

  # Return empty if no data
  [[ -z "$issue_data" || "$issue_data" == "||" ]] && return

  # Parse issue data
  local issue_key=$(echo "$issue_data" | cut -d'|' -f1)
  local priority=$(echo "$issue_data" | cut -d'|' -f2)
  local status=$(echo "$issue_data" | cut -d'|' -f3)

  [[ -z "$issue_key" ]] && return

  # Format output with JIRA-style coloring
  local output=""

  # Add status indicator if enabled
  if [[ "${CONFIG_JIRA_SHOW_STATUS}" == "true" ]] && [[ -n "$status" ]]; then
    local status_icon=$(get_jira_status_icon "$status")
    [[ -n "$status_icon" ]] && output+="${status_icon} "
  fi

  # Issue key
  output+="${ACCENT}${issue_key}${NC}"

  # Add priority icon if enabled and priority is significant
  if [[ "${CONFIG_JIRA_SHOW_PRIORITY}" == "true" ]]; then
    local priority_icon=$(get_priority_icon "$priority")
    [[ -n "$priority_icon" ]] && output+=" ${priority_icon}"
  fi

  echo -e "$output"
}

# Get JIRA-specific status icon
get_jira_status_icon() {
  local status="$1"
  case "$status" in
    backlog)      echo "📋" ;;
    todo)         echo "📝" ;;
    in_progress)  echo "🔄" ;;
    in_review)    echo "👀" ;;
    done)         echo "✅" ;;
    cancelled)    echo "❌" ;;
    *)            echo "" ;;
  esac
}
