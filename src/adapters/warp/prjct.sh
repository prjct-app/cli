#!/bin/bash

prjct() {
    local PRJCT_DIR=".prjct"
    local CMD="$1"
    shift

    case "$CMD" in
        init)
            mkdir -p "$PRJCT_DIR"
            echo "# NOW" > "$PRJCT_DIR/now.md"
            echo "# NEXT" > "$PRJCT_DIR/next.md"
            echo "# SHIPPED 🚀" > "$PRJCT_DIR/shipped.md"
            echo "# IDEAS 💡" > "$PRJCT_DIR/ideas.md"
            touch "$PRJCT_DIR/memory.jsonl"
            echo "🚀 Project initialized!"
            ;;

        now)
            if [ -z "$*" ]; then
                cat "$PRJCT_DIR/now.md" 2>/dev/null || echo "No current task"
            else
                echo "# NOW: $*" > "$PRJCT_DIR/now.md"
                echo "Started: $(date -Iseconds)" >> "$PRJCT_DIR/now.md"
                echo "📍 Focus set: $*"
            fi
            ;;

        done)
            TASK=$(head -n 1 "$PRJCT_DIR/now.md" | sed 's/# NOW: //')
            echo "# NOW" > "$PRJCT_DIR/now.md"
            echo "✅ Task complete: $TASK"
            ;;

        ship)
            if [ -z "$*" ]; then
                echo "⚠️  Specify feature: prjct ship \"feature name\""
            else
                echo "- ✅ **$*** _($(date))_" >> "$PRJCT_DIR/shipped.md"
                COUNT=$(grep -c "✅" "$PRJCT_DIR/shipped.md")
                echo "🚀 SHIPPED! Feature #$COUNT 🎉"
            fi
            ;;

        recap)
            echo "📊 Project Recap"
            echo ""
            echo -n "🎯 Current: "
            head -n 1 "$PRJCT_DIR/now.md" | sed 's/# NOW: //'
            echo -n "📦 Shipped: "
            grep -c "✅" "$PRJCT_DIR/shipped.md" 2>/dev/null || echo "0"
            echo -n "📝 Queued: "
            grep -c "^- " "$PRJCT_DIR/next.md" 2>/dev/null || echo "0"
            ;;

        *)
            echo "PRJCT - Project management for indie hackers"
            echo ""
            echo "Commands:"
            echo "  prjct init          Initialize project"
            echo "  prjct now [task]    Set/show current task"
            echo "  prjct done          Complete current task"
            echo "  prjct ship <name>   Ship a feature"
            echo "  prjct recap         Show project recap"
            ;;
    esac
}

_prjct_completions() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local commands="init now done ship recap next idea progress stuck context"

    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    fi
}

complete -F _prjct_completions prjct
