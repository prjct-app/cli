#!/bin/bash
# prjct statusline - Usage limits component
# Displays Claude.ai 5-hour and weekly limit usage when Claude provides it.

limit_circle() {
  local pct="$1"
  if [[ ! "$pct" =~ ^[0-9]+$ ]]; then
    echo ""
  elif [[ "$pct" -ge 90 ]]; then
    echo "●"
  elif [[ "$pct" -ge 75 ]]; then
    echo "◕"
  elif [[ "$pct" -ge 50 ]]; then
    echo "◑"
  elif [[ "$pct" -ge 25 ]]; then
    echo "◔"
  else
    echo "○"
  fi
}

limit_color() {
  local pct="$1"
  if [[ ! "$pct" =~ ^[0-9]+$ ]]; then
    echo "$MUTED"
  elif [[ "$pct" -ge 90 ]]; then
    echo "$ERROR"
  elif [[ "$pct" -ge 75 ]]; then
    echo "$WARNING"
  else
    echo "$MUTED"
  fi
}

format_limit() {
  local label="$1"
  local pct="$2"

  [[ -z "$pct" || "$pct" == "null" || ! "$pct" =~ ^[0-9]+$ ]] && return

  local circle color
  circle=$(limit_circle "$pct")
  color=$(limit_color "$pct")

  echo -e "${color}${circle} ${label} ${pct}%${NC}"
}

component_limits() {
  component_enabled "limits" || return

  local parts=()
  local five_hour weekly

  five_hour=$(format_limit "5h" "$RATE_LIMIT_5H_PERCENT")
  weekly=$(format_limit "7d" "$RATE_LIMIT_WEEKLY_PERCENT")

  [[ -n "$five_hour" ]] && parts+=("$five_hour")
  [[ -n "$weekly" ]] && parts+=("$weekly")

  [[ ${#parts[@]} -eq 0 ]] && return

  local old_ifs="$IFS"
  IFS=" "
  echo -e "${parts[*]}"
  IFS="$old_ifs"
}
