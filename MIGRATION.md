# Migration Guide: v0.1.0 → v0.2.1

**🚨 Breaking Change**: prjct-cli v0.2.0+ introduces a new data storage architecture and multi-editor command installation that requires migration.

## ⚠️ IMPORTANT: Zero Data Loss Guarantee

**This is a RELOCATION, not a deletion**:
- ✅ **ALL your data is preserved** - Every file, every log entry, every timestamp
- ✅ **Complete history maintained** - Nothing is lost or modified
- ✅ **Reversible process** - Can rollback if needed (`.prjct/` kept by default)
- ✅ **Validated migration** - Automatic integrity checks ensure completeness

**You are NOT losing anything. Your data is simply moving to a better location.**

## What Changed?

### Before (v0.1.0)
```
your-project/
├── .prjct/
│   ├── now.md
│   ├── next.md
│   ├── shipped.md
│   ├── ideas.md
│   └── memory.jsonl
├── src/
└── package.json
```

### After (v0.2.1)
```
your-project/
├── .prjct/
│   └── prjct.config.json    # New: References global data location
├── src/
└── package.json

~/.prjct-cli/
├── projects/
│   └── abc123def456/     # Project ID (hash of path)
│       ├── core/
│       │   ├── now.md
│       │   ├── next.md
│       │   └── context.md
│       ├── progress/
│       │   ├── shipped.md
│       │   └── metrics.md
│       ├── planning/
│       │   ├── ideas.md
│       │   └── roadmap.md
│       ├── analysis/
│       │   └── repo-summary.md
│       └── memory/
│           └── context.jsonl
└── templates/
    └── commands/         # Command templates for multi-editor sync

~/.claude/commands/p/     # Claude Code slash commands
~/.cursor/commands/p/     # Cursor AI slash commands
~/.codeium/commands/p/    # Codeium slash commands
```

## Why This Change?

### 1. 🚫 No Bundle Size Inflation
Your project data no longer bloats your repository. Keep your repos lean and fast.

### 2. 🔒 Privacy & Security
Work logs, personal notes, and progress tracking stay on YOUR machine. Never accidentally commit sensitive workflow data.

### 3. 🤝 Collaboration-Ready (Non-Intrusive)
**Designed for team collaboration WITHOUT exposing personal data**:

- **What gets shared** (via git): `prjct.config.json` - Just project metadata
- **What stays private**: Your personal logs, progress, notes in `~/.prjct-cli/`
- **How it works**: Each team member has their own local data with author tracking
- **Why it matters**: You can collaborate on the same project without exposing:
  - Your personal work hours and velocity
  - Private notes and thought processes
  - Individual task breakdowns and planning
  - Personal productivity patterns

**Example Team Workflow**:
```bash
# Alice commits prjct.config.json
git add .prjct/prjct.config.json
git commit -m "Initialize prjct tracking"
git push

# Bob pulls and initializes
git pull
/p:init  # Creates his own ~/.prjct-cli/projects/[id]/ with his author info

# Both work independently with personal tracking
# Shared: Project identity and structure
# Private: Individual logs and progress
```

### 4. 📊 Author Tracking
Every operation logs who did it (via GitHub username or git config). Prepares for future multi-user features while keeping data local.

### 5. 🗂️ Better Organization
Layered structure (core, progress, planning, analysis, memory) makes data management cleaner and more scalable.

### 6. 🤖 Multi-Editor Support (v0.2.1+)
Commands are now automatically installed across multiple AI editors:
- **Claude Code** (`~/.claude/commands/p/`)
- **Cursor AI** (`~/.cursor/commands/p/`)
- **Codeium** (`~/.codeium/commands/p/`)

All editors share the same global data structure, enabling seamless workflow switching between editors.

## Migration Methods

### Method 1: Automatic Migration (Recommended)

Update to the latest version and the CLI will detect v0.1.0 projects and offer automatic migration:

```bash
# Update to latest version
npm update -g prjct-cli

# The CLI will:
# 1. Detect existing .prjct directories
# 2. Prompt for migration
# 3. Migrate all data automatically
# 4. Create prjct.config.json
# 5. Optionally remove .prjct directory
```

### Method 2: Manual Migration via Command

If you're already on v0.2.0 but haven't migrated:

```bash
# Check if migration is needed
/p:status

# Run migration
/p:migrate

# Options:
/p:migrate --dry-run        # See what would happen
/p:migrate --remove-legacy  # Remove .prjct after migration
/p:migrate --keep-legacy    # Keep .prjct as backup
```

### Method 3: Fresh Initialization

Start fresh with new structure (loses existing data):

```bash
# Remove old structure
rm -rf .prjct

# Initialize with new structure
/p:init

# This creates:
# - prjct.config.json in project
# - Global structure in ~/.prjct-cli/projects/[id]/
# - Commands installed to all detected editors
```

### Method 4: Command Installation Only (v0.2.1+)

If you've already migrated but need to install/update commands:

```bash
# Install commands to all detected editors
prjct install

# Options:
prjct install --force              # Update existing commands
prjct install --editor claude      # Install to specific editor only
prjct install --create-templates   # Create template files first

# Verify installation
prjct install --dry-run            # See what would be installed
```

## Migration Process Details

### What Gets Migrated (100% Data Preservation)

✅ **All markdown files** - now.md, next.md, shipped.md, ideas.md, roadmap.md, etc.
✅ **All memory logs** - Every single entry from memory.jsonl, context.jsonl, decisions.jsonl
✅ **All subdirectories** - tasks/, designs/, and any custom directories you created
✅ **All timestamps** - File creation, modification times, and entry timestamps preserved
✅ **Complete history** - Every action, every decision, every note - NOTHING is lost
✅ **File structure** - Directory hierarchy and organization maintained

**🔒 Migration Validation**:
- Automatic file count verification (source vs destination)
- Content integrity checks
- Structure validation
- Rollback capability if any issues detected

**The migration process is designed to be 100% safe and reversible. Your original `.prjct/` directory is kept by default as a backup.**

### What Gets Created

🆕 `.prjct/prjct.config.json` in project
🆕 Global directory: `~/.prjct-cli/projects/[project-id]/`
🆕 Layered structure: core, progress, planning, analysis, memory
🆕 Author information detected and stored

### Migration Validation

The migration process automatically validates:

- All files successfully copied
- Directory structure created correctly
- Essential layers present (core, progress, planning, analysis, memory)
- At least some files exist in core directory

## Understanding prjct.config.json

After migration, you'll have a new file in your project root:

```json
{
  "version": "0.2.0",
  "projectId": "abc123def456",
  "dataPath": "~/.prjct-cli/projects/abc123def456",
  "author": {
    "name": "John Doe",
    "email": "john@example.com",
    "github": "jj"
  },
  "created": "2025-09-30T12:00:00.000Z",
  "lastSync": "2025-09-30T12:00:00.000Z"
}
```

**Fields**:
- `projectId`: Unique identifier (hash of project path)
- `dataPath`: Where your data is stored globally
- `author`: Detected from GitHub CLI or git config
- `created`: When project was initialized/migrated
- `lastSync`: Last operation timestamp

## Author Detection

The system detects your author information automatically:

### Detection Order

1. **GitHub CLI** (`gh api user`) → username
2. **Git Config** (`git config user.name` and `git config user.email`)
3. **Manual Entry** (if neither available)

### Ensuring Proper Detection

```bash
# Option 1: Install GitHub CLI (recommended)
# macOS
brew install gh

# Login to GitHub
gh auth login

# Option 2: Configure git
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
git config --global github.user "yourusername"

# Verify detection
/p:context
```

## Post-Migration

### What To Do

1. **Verify Migration (Critical Step)**:
   ```bash
   /p:recap    # Should show ALL your shipped features and current task
   /p:next     # Should show your queued tasks
   /p:context  # Check author information

   # Manually verify your data is there
   cd ~/.prjct-cli/projects/[your-project-id]/
   ls -la core/ progress/ planning/ memory/

   # Compare file counts
   # Original: ls -la .prjct/ | wc -l
   # New: find ~/.prjct-cli/projects/[id]/ -type f | wc -l
   ```

2. **Configure Git (Important for Collaboration)**:

   **For Team Projects (Recommended)**:
   ```bash
   # COMMIT .prjct/prjct.config.json for collaboration
   git add .prjct/prjct.config.json
   git commit -m "feat: add prjct configuration for team tracking"
   git push

   # Team members will init their own local tracking
   # Data stays private, only project ID is shared
   ```

   **For Personal Projects**:
   ```bash
   # IGNORE .prjct/prjct.config.json to keep it private
   echo ".prjct/prjct.config.json" >> .gitignore
   git add .gitignore
   git commit -m "chore: ignore prjct config"
   ```

   **What Gets Committed** (if you share `prjct.config.json`):
   - Project ID (hash of path - not sensitive)
   - Data path reference (just a path, no actual data)
   - Author info (your public GitHub username / git name)
   - Timestamps (when initialized/synced)

   **What NEVER Gets Committed**:
   - Your work logs in `~/.prjct-cli/`
   - Your personal notes and progress
   - Your task history and velocity
   - Your memory logs

3. **Remove Legacy .prjct** (optional, only after verification):
   ```bash
   # ONLY do this after confirming ALL data is in new location
   # Verify first!
   /p:recap  # Check your data
   ls -la ~/.prjct-cli/projects/[your-id]/

   # Then remove
   rm -rf .prjct
   ```

### What NOT To Do

❌ Don't delete `~/.prjct-cli/` - this is where your data lives now
❌ Don't manually edit `.prjct/prjct.config.json` - use commands instead
❌ Don't try to use both old and new structure simultaneously

## Troubleshooting

### Issue: "Project needs migration"

```bash
# Solution: Run migration
/p:migrate
```

### Issue: "No author detected"

```bash
# Solution 1: Install gh CLI
brew install gh
gh auth login

# Solution 2: Configure git
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Then retry
/p:init
```

### Issue: Migration failed

```bash
# Check migration status
/p:status

# Try dry run to see what would happen
/p:migrate --dry-run

# Check for errors
cat ~/.prjct-cli/migration.log

# Manual recovery: restore from .prjct
cp -r .prjct ~/.prjct-cli/projects/[your-project-id]/
```

### Issue: Lost data after migration

```bash
# Data is not lost, just moved!
# Check global location
ls -la ~/.prjct-cli/projects/

# View your project ID
cat .prjct/prjct.config.json

# Navigate to data
cd ~/.prjct-cli/projects/[project-id]/
ls -la core/ progress/ planning/
```

## Rollback (Emergency)

If something goes wrong and you need to rollback:

```bash
# 1. The .prjct directory is kept by default during migration
#    If you still have it, just downgrade:
npm install -g prjct-cli@0.1.0

# 2. If .prjct was removed, copy back from global:
cp -r ~/.prjct-cli/projects/[project-id]/* ./.prjct/

# 3. Remove .prjct/prjct.config.json
rm .prjct/prjct.config.json

# 4. Use v0.1.0 normally
```

## FAQ

### Will this affect my repository?

No. The new architecture specifically moves data OUT of your repository to prevent bloat.

### Can I still commit .prjct/?

After migration, `.prjct/` is no longer used. You can safely remove it or add it to `.gitignore`.

### What about CI/CD?

No changes needed! Data is now fully external to your repository.

### Can I migrate multiple projects?

Yes! Each project gets its own unique ID based on its path. You can migrate all your projects independently.

### What if I work on multiple machines?

Currently, data is machine-local (`~/.prjct-cli/`). For multi-machine workflows:
- Option 1: Use git to sync `prjct.config.json` (contains data location)
- Option 2: Wait for future cloud sync features (planned)

### Can I share projects with team members?

**Yes! This is the whole point of v0.2.0!**

The new architecture is specifically designed for **non-intrusive collaboration**:

**How It Works**:
1. Commit `.prjct/prjct.config.json` to git (just project metadata, no personal data)
2. Each team member runs `/p:init` after pulling
3. Everyone gets their own `~/.prjct-cli/projects/[id]/` with their author info
4. Personal progress, notes, and logs stay completely private
5. Optional future features could aggregate anonymous metrics

**What This Enables**:
- Team coordination without exposing individual work patterns
- Author tracking for future collaboration features
- Each developer maintains personal productivity tracking
- No accidental exposure of sensitive workflow data

**Perfect For**:
- Open source projects (contributors track privately)
- Remote teams (personal velocity stays private)
- Consulting (client work tracking without exposure)
- Indie teams (ship together, track separately)

## Getting Help

If you encounter issues:

1. Check this guide first
2. Review [CHANGELOG.md](CHANGELOG.md) for detailed changes
3. Run `/p:status` to diagnose
4. Open an issue: https://github.com/jlopezlira/prjct-cli/issues
5. Include:
   - Output of `/p:status`
   - Contents of `.prjct/prjct.config.json` (if exists)
   - Error messages
   - Output of `/p:migrate --dry-run`

## Summary

✅ **What to do**: Run `/p:migrate` or reinstall with auto-migration
✅ **What changes**: Data moves to `~/.prjct-cli/projects/[id]/`
✅ **What you get**: Clean projects, author tracking, better organization
✅ **What to verify**: `/p:recap` shows your data, `/p:context` shows author
✅ **What's safe**: Remove `.prjct/` after successful migration

**Migration is safe, reversible, and preserves all your data!** 🚀
