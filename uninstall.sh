#!/bin/bash

# prjct/cli - Uninstaller
# Safely removes prjct/cli from your system

set -e

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Unicode characters
CHECK="✓"
CROSS="✗"
ARROW="▸"
DOT="•"
WARN="⚠️"

# Installation paths
INSTALL_DIR="$HOME/.prjct-cli"
SYMLINK_PATH="$HOME/.local/bin/prjct"
CLAUDE_COMMANDS_DIR="$HOME/.claude/commands/p"

# Clear for clean experience
clear

# Header
echo ""
echo -e "${RED}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║${NC}  ${BOLD}${WHITE}     🗑️  prjct/${MAGENTA}cli${WHITE} uninstaller        ${NC}${RED}║${NC}"
echo -e "${RED}║${NC}  ${DIM}      Remove prjct/cli from system        ${NC}${RED}║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Step counter
STEP=1
TOTAL_STEPS=6

print_step() {
    echo -e "\n${BOLD}${CYAN}[$STEP/$TOTAL_STEPS]${NC} ${BOLD}$1${NC}"
    ((STEP++))
}

# Detect what's installed
print_step "Detecting installed components"

FOUND_COMPONENTS=0

printf "  ${ARROW} Installation directory..."
if [ -d "$INSTALL_DIR" ]; then
    echo -e " ${GREEN}${CHECK}${NC} found"
    ((FOUND_COMPONENTS++))
else
    echo -e " ${DIM}not found${NC}"
fi

printf "  ${ARROW} Symlink..."
if [ -L "$SYMLINK_PATH" ] || [ -f "$SYMLINK_PATH" ]; then
    echo -e " ${GREEN}${CHECK}${NC} found"
    ((FOUND_COMPONENTS++))
else
    echo -e " ${DIM}not found${NC}"
fi

printf "  ${ARROW} Claude Code commands..."
if [ -d "$CLAUDE_COMMANDS_DIR" ]; then
    CMD_COUNT=$(find "$CLAUDE_COMMANDS_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CMD_COUNT" -gt 0 ]; then
        echo -e " ${GREEN}${CHECK}${NC} found ($CMD_COUNT files)"
        ((FOUND_COMPONENTS++))
    else
        echo -e " ${DIM}not found${NC}"
    fi
else
    echo -e " ${DIM}not found${NC}"
fi

# Check for shell configuration
printf "  ${ARROW} Shell configuration..."
SHELL_CONFIGS=()
for config in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
    if [ -f "$config" ] && grep -q "prjct-cli" "$config" 2>/dev/null; then
        SHELL_CONFIGS+=("$config")
    fi
done

if [ ${#SHELL_CONFIGS[@]} -gt 0 ]; then
    echo -e " ${GREEN}${CHECK}${NC} found (${#SHELL_CONFIGS[@]} files)"
    ((FOUND_COMPONENTS++))
else
    echo -e " ${DIM}not found${NC}"
fi

# Check for project data
print_step "Checking for project data"

PROJECT_DIRS=()
echo -e "  ${DIM}Scanning for .prjct directories...${NC}"

# Search for .prjct directories in common project locations
for dir in "$HOME/Projects" "$HOME/projects" "$HOME/Development" "$HOME/dev" "$HOME/Code" "$HOME/code" "$HOME/Documents" "$HOME/Desktop" "$HOME"; do
    if [ -d "$dir" ]; then
        while IFS= read -r -d '' prjct_dir; do
            parent_dir=$(dirname "$prjct_dir")
            PROJECT_DIRS+=("$parent_dir")
        done < <(find "$dir" -maxdepth 3 -type d -name ".prjct" -print0 2>/dev/null || true)
    fi
done

# Remove duplicates
PROJECT_DIRS=($(printf "%s\n" "${PROJECT_DIRS[@]}" | sort -u))

if [ ${#PROJECT_DIRS[@]} -gt 0 ]; then
    echo -e "  ${YELLOW}${WARN}${NC} Found ${BOLD}${#PROJECT_DIRS[@]}${NC} project(s) with .prjct data:"
    for proj in "${PROJECT_DIRS[@]}"; do
        echo -e "    ${DOT} ${DIM}$proj${NC}"
    done
else
    echo -e "  ${GREEN}${CHECK}${NC} No project data found"
fi

# Exit if nothing to uninstall
if [ $FOUND_COMPONENTS -eq 0 ] && [ ${#PROJECT_DIRS[@]} -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}Nothing to uninstall!${NC}"
    echo -e "${DIM}prjct/cli is not installed on this system.${NC}"
    echo ""
    exit 0
fi

# Confirmation
print_step "Confirmation"

echo ""
echo -e "${RED}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║${NC}  ${BOLD}${YELLOW}          ⚠️  WARNING ⚠️                ${NC}${RED}║${NC}"
echo -e "${RED}║${NC}                                                ${RED}║${NC}"
echo -e "${RED}║${NC}  ${BOLD}${WHITE}THIS ACTION IS IRREVERSIBLE!${NC}                ${RED}║${NC}"
echo -e "${RED}║${NC}  ${WHITE}You cannot undo this operation${NC}               ${RED}║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}${WARN} The following will be PERMANENTLY removed:${NC}"
echo ""

[ -d "$INSTALL_DIR" ] && echo -e "  ${RED}${CROSS}${NC} Installation directory: ${DIM}$INSTALL_DIR${NC}"
[ -L "$SYMLINK_PATH" ] || [ -f "$SYMLINK_PATH" ] && echo -e "  ${RED}${CROSS}${NC} Command symlink: ${DIM}$SYMLINK_PATH${NC}"
[ -d "$CLAUDE_COMMANDS_DIR" ] && echo -e "  ${RED}${CROSS}${NC} Claude Code commands: ${DIM}$CLAUDE_COMMANDS_DIR${NC}"
[ ${#SHELL_CONFIGS[@]} -gt 0 ] && echo -e "  ${RED}${CROSS}${NC} Shell configuration in: ${DIM}${SHELL_CONFIGS[*]}${NC}"

echo ""
echo -e "${BOLD}${RED}Are you ABSOLUTELY SURE you want to uninstall prjct/cli?${NC}"
echo -e "${DIM}Type 'yes' to confirm or anything else to cancel${NC}"
echo ""
read -p "$(echo -e ${BOLD}"Confirm uninstall: "${NC})" -r CONFIRM
echo ""

if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "\n${GREEN}Good choice!${NC} Uninstall cancelled."
    echo -e "${DIM}Your prjct/cli installation remains intact.${NC}"
    echo ""
    exit 0
fi

# Handle project data
if [ ${#PROJECT_DIRS[@]} -gt 0 ]; then
    print_step "Project data options"

    echo ""
    echo -e "${YELLOW}What would you like to do with project data?${NC}"
    echo ""
    echo -e "  ${BOLD}1)${NC} ${GREEN}Keep all project data${NC} (recommended)"
    echo -e "  ${BOLD}2)${NC} ${YELLOW}Back up project data${NC} to ${CYAN}~/prjct-backup-$(date +%Y%m%d)${NC}"
    echo -e "  ${BOLD}3)${NC} ${RED}⚠️  DELETE all project data PERMANENTLY${NC}"
    echo ""
    echo -e "     ${RED}${BOLD}WARNING:${NC} ${RED}Option 3 is IRREVERSIBLE!${NC}"
    echo -e "     ${DIM}All your .prjct directories will be deleted forever${NC}"
    echo ""

    read -p "$(echo -e ${BOLD}"Choose an option (1-3, default: 1): "${NC})" -n 1 -r PROJECT_CHOICE
    echo ""

    case $PROJECT_CHOICE in
        2)
            BACKUP_DIR="$HOME/prjct-backup-$(date +%Y%m%d-%H%M%S)"
            echo -e "\n  ${ARROW} Creating backup at ${CYAN}$BACKUP_DIR${NC}..."
            mkdir -p "$BACKUP_DIR"

            for proj in "${PROJECT_DIRS[@]}"; do
                proj_name=$(basename "$proj")
                echo -e "    ${DOT} Backing up ${DIM}$proj_name${NC}"
                cp -r "$proj/.prjct" "$BACKUP_DIR/${proj_name}-prjct" 2>/dev/null || true
            done
            echo -e "  ${GREEN}${CHECK}${NC} Backup complete"

            # Now remove the .prjct directories
            for proj in "${PROJECT_DIRS[@]}"; do
                rm -rf "$proj/.prjct" 2>/dev/null || true
            done
            ;;
        3)
            echo ""
            echo -e "  ${RED}${BOLD}FINAL WARNING!${NC}"
            echo -e "  ${RED}You are about to DELETE all project data PERMANENTLY${NC}"
            echo -e "  ${RED}This action CANNOT be undone!${NC}"
            echo ""
            read -p "$(echo -e ${BOLD}${RED}"Type 'DELETE' to confirm data deletion: "${NC})" -r DELETE_CONFIRM
            echo ""

            if [[ "$DELETE_CONFIRM" == "DELETE" ]]; then
                echo -e "  ${RED}${WARN} Permanently removing all project data...${NC}"
                for proj in "${PROJECT_DIRS[@]}"; do
                    echo -e "    ${RED}${CROSS}${NC} Deleting ${DIM}$proj/.prjct${NC}"
                    rm -rf "$proj/.prjct" 2>/dev/null || true
                done
                echo -e "  ${RED}${CHECK}${NC} Project data permanently deleted"
            else
                echo -e "  ${GREEN}${CHECK}${NC} Project data deletion cancelled - keeping all data"
            fi
            ;;
        *)
            echo -e "\n  ${GREEN}${CHECK}${NC} Keeping all project data"
            ;;
    esac
fi

# Remove components
print_step "Removing prjct/cli components"

# Remove Claude Code commands
if [ -d "$CLAUDE_COMMANDS_DIR" ]; then
    printf "  ${ARROW} Removing Claude Code commands..."
    rm -rf "$CLAUDE_COMMANDS_DIR"
    echo -e " ${GREEN}${CHECK}${NC}"
fi

# Remove symlink
if [ -L "$SYMLINK_PATH" ] || [ -f "$SYMLINK_PATH" ]; then
    printf "  ${ARROW} Removing command symlink..."
    rm -f "$SYMLINK_PATH"
    echo -e " ${GREEN}${CHECK}${NC}"
fi

# Remove shell configuration
if [ ${#SHELL_CONFIGS[@]} -gt 0 ]; then
    printf "  ${ARROW} Cleaning shell configuration..."
    for config in "${SHELL_CONFIGS[@]}"; do
        # Remove prjct/cli related lines
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' '/# prjct\/cli/d' "$config"
            sed -i '' '/prjct-cli\/bin/d' "$config"
        else
            # Linux
            sed -i '/# prjct\/cli/d' "$config"
            sed -i '/prjct-cli\/bin/d' "$config"
        fi
    done
    echo -e " ${GREEN}${CHECK}${NC}"
fi

# Remove installation directory
if [ -d "$INSTALL_DIR" ]; then
    printf "  ${ARROW} Removing installation directory..."
    rm -rf "$INSTALL_DIR"
    echo -e " ${GREEN}${CHECK}${NC}"
fi

# Final cleanup
print_step "Final cleanup"

# Check for npm global installation
printf "  ${ARROW} Checking for npm global installation..."
if npm list -g @prjct/cli &>/dev/null; then
    npm uninstall -g @prjct/cli &>/dev/null || true
    echo -e " ${GREEN}${CHECK}${NC}"
else
    echo -e " ${DIM}not found${NC}"
fi

# Success message
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}${WHITE}   ✅ prjct/cli uninstalled successfully!   ${NC}     ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Show what was done
echo -e "${BOLD}${CYAN}Summary:${NC}"
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""

[ -d "$INSTALL_DIR" ] && echo -e "  ${GREEN}${CHECK}${NC} Removed installation directory"
[ -L "$SYMLINK_PATH" ] || [ -f "$SYMLINK_PATH" ] && echo -e "  ${GREEN}${CHECK}${NC} Removed command symlink"
[ -d "$CLAUDE_COMMANDS_DIR" ] && echo -e "  ${GREEN}${CHECK}${NC} Removed Claude Code commands"
[ ${#SHELL_CONFIGS[@]} -gt 0 ] && echo -e "  ${GREEN}${CHECK}${NC} Cleaned shell configuration"

if [ ${#PROJECT_DIRS[@]} -gt 0 ]; then
    case $PROJECT_CHOICE in
        2)
            echo -e "  ${GREEN}${CHECK}${NC} Backed up project data to ${CYAN}$BACKUP_DIR${NC}"
            ;;
        3)
            echo -e "  ${GREEN}${CHECK}${NC} Removed project data from ${#PROJECT_DIRS[@]} project(s)"
            ;;
        *)
            echo -e "  ${GREEN}${CHECK}${NC} Preserved project data in ${#PROJECT_DIRS[@]} project(s)"
            ;;
    esac
fi

echo ""
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""

# Reinstall instructions
echo -e "${BOLD}To reinstall prjct/cli:${NC}"
echo -e "  ${CYAN}curl -fsSL https://prjct.app/install.sh | bash${NC}"
echo ""

echo -e "${DIM}Thank you for trying prjct/cli!${NC}"
echo ""