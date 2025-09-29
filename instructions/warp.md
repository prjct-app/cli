# prjct Commands for Warp AI

Execute these commands when users type `/p:` in Warp terminal.

## Command Execution

### `/p:init`
Initialize project tracking:
```bash
mkdir -p .prjct
cp ~/.prjct-cli/templates/* .prjct/
# Customize templates with current date, week, project info
echo "🚀 Project initialized with .prjct/ structure"
```

### `/p:now [task]`
Focus management:
```bash
if [ -z "$1" ]; then
  # Show current
  cat .prjct/now.md
else
  # Set new task
  echo "# NOW: $1" > .prjct/now.md
  echo "Started: $(date -Iseconds)" >> .prjct/now.md
  echo "📍 Focus set: $1"
fi
```

### `/p:done`
Complete current task:
```bash
task=$(head -n1 .prjct/now.md | sed 's/# NOW: //')
echo "# NOW" > .prjct/now.md
echo "No current task" >> .prjct/now.md
echo "{\"action\":\"done\",\"task\":\"$task\",\"timestamp\":\"$(date -Iseconds)\"}" >> .prjct/memory.jsonl
echo "✅ Task complete: $task"
```

### `/p:ship <feature>`
Ship feature with celebration:
```bash
week=$(date +%V)
year=$(date +%Y)
timestamp=$(date "+%Y-%m-%d %H:%M")

# Add week header if needed
grep -q "## Week $week, $year" .prjct/shipped.md || echo -e "\n## Week $week, $year" >> .prjct/shipped.md

# Add feature
echo "- ✅ **$1** _($timestamp)_" >> .prjct/shipped.md

# Count total
count=$(grep -c "✅" .prjct/shipped.md)
echo "🚀 SHIPPED! Feature #$count 🎉"
echo "Keep shipping! You're on fire! 🔥"
```

### `/p:next`
Show task queue:
```bash
if [ -s .prjct/next.md ]; then
  echo "📋 Next up:"
  grep "^- " .prjct/next.md | nl
else
  echo "📋 Queue is empty. Add tasks with /p:idea"
fi
```

### `/p:idea <text>`
Capture idea:
```bash
echo "- $1 _($(date +%Y-%m-%d))_" >> .prjct/ideas.md

# Add to queue if actionable
if [[ "$1" =~ ^(implement|add|fix|create|build|update) ]]; then
  echo "- $1" >> .prjct/next.md
  echo "💡 Idea captured and added to queue!"
else
  echo "💡 Idea captured!"
fi
```

### `/p:recap`
Project summary:
```bash
current=$(head -n1 .prjct/now.md | sed 's/# NOW: //')
shipped=$(grep -c "✅" .prjct/shipped.md 2>/dev/null || echo 0)
queued=$(grep -c "^- " .prjct/next.md 2>/dev/null || echo 0)
ideas=$(grep -c "^- " .prjct/ideas.md 2>/dev/null || echo 0)

echo "📊 Project Recap"
echo "🎯 Current: $current"
echo "📦 Shipped: $shipped features"
echo "📝 Queued: $queued tasks"
echo "💡 Ideas: $ideas"

if [ $shipped -eq 0 ]; then
  echo "Time to ship your first feature!"
elif [ $shipped -ge 5 ]; then
  echo "You're crushing it! 🔥"
else
  echo "Keep shipping!"
fi
```

### `/p:progress [period]`
Show progress metrics:
```bash
period=${1:-week}
case $period in
  day)   since=$(date -d "1 day ago" +%Y-%m-%d) ;;
  week)  since=$(date -d "1 week ago" +%Y-%m-%d) ;;
  month) since=$(date -d "1 month ago" +%Y-%m-%d) ;;
esac

# Count features shipped in period
count=$(grep "✅" .prjct/shipped.md | grep -c "$since" || echo 0)

echo "📈 Progress Report ($period)"
echo "✅ Shipped: $count features"
echo "⚡ Velocity: $(echo "scale=2; $count/7" | bc) features/day"

if [ $count -ge 5 ]; then
  echo "📈 Trend: Excellent!"
elif [ $count -ge 2 ]; then
  echo "➡️ Trend: Good pace"
else
  echo "📉 Trend: Time to accelerate"
fi
```

### `/p:stuck <issue>`
Contextual help:
```bash
case "$1" in
  *error*|*bug*)
    echo "🔍 Debugging steps:"
    echo "1. Check error message details"
    echo "2. Isolate the problem area"
    echo "3. Test with minimal code"
    echo "4. Search for similar issues"
    ;;
  *design*|*architecture*)
    echo "🏗️ Design approach:"
    echo "1. Define clear requirements"
    echo "2. Start with simplest solution"
    echo "3. Iterate and refactor"
    echo "4. Don't over-engineer"
    ;;
  *performance*|*slow*)
    echo "⚡ Performance strategy:"
    echo "1. Measure first (profile)"
    echo "2. Identify bottlenecks"
    echo "3. Optimize critical path"
    echo "4. Cache when possible"
    ;;
  *)
    echo "💡 General approach:"
    echo "1. Break into smaller tasks"
    echo "2. Start with easiest part"
    echo "3. Build momentum"
    echo "4. Ask for help if needed"
    ;;
esac
```

### `/p:context`
Show project context:
```bash
# Detect project type
if [ -f package.json ]; then
  project="Node.js/JavaScript project"
  [ -f next.config.js ] && project="Next.js project"
elif [ -f go.mod ]; then
  project="Go project"
elif [ -f Cargo.toml ]; then
  project="Rust project"
else
  project="Project"
fi

current=$(head -n1 .prjct/now.md | sed 's/# NOW: //')

echo "📋 Project Context"
echo "🏗️ Type: $project"
echo "📍 Current: $current"
echo ""
echo "📜 Recent actions:"
tail -n 5 .prjct/memory.jsonl | jq -r '"\(.action): \(.task // .feature // .text)"' 2>/dev/null || echo "No recent actions"
```

## Terminal Integration

For Warp's AI to recognize these commands, they should be:
1. Executed as shell commands
2. Return clear text output
3. Use emoji for visual feedback
4. Keep output concise

## File Structure
All project data stored in `.prjct/` directory:
- Portable between machines
- Git-friendly (can commit or ignore)
- Simple text formats
- No external dependencies