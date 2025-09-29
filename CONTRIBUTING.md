# 🚀 Contributing to prjct-cli

Hey there, fellow builder! 👋

First off, **THANK YOU** for considering contributing to prjct-cli. This project is built by indie hackers, for indie hackers, and every contribution makes it better for everyone who just wants to ship fast without the BS.

## 🎯 Our Vibe

We're building something different here. No corporate ceremonies, no 47-step PR processes, no gatekeeping. Just builders helping builders ship better and faster.

**What we value:**

- 🚀 **Ship fast** - Perfect is the enemy of done
- 💡 **Ideas over process** - Got a cool idea? Let's talk about it
- 🤝 **Be cool** - We're all here to help each other
- 🎉 **Celebrate wins** - Every PR merged is a win for the community

## 🛠️ Ways to Contribute

### 1. 🐛 Found a Bug?

No worries, it happens! Open an issue with:

- What you were trying to do
- What actually happened
- Your environment (Claude Code, Codex, Terminal, etc.)
- Any error messages

**Pro tip:** If you can fix it yourself, even better! See the PR section below.

### 2. 💡 Have an Idea?

We LOVE ideas! Open an issue titled `[IDEA] Your awesome idea` and tell us:

- The problem you're trying to solve
- How you think it could work
- Why it would help other indie hackers

Don't worry about having all the details figured out. We can brainstorm together!

### 3. 📝 Want to Improve Docs?

Documentation is super important! If something confused you, it probably confused others too. Feel free to:

- Fix typos (yes, even one typo is worth a PR!)
- Add examples
- Clarify confusing parts
- Add your own tips and tricks

### 4. 🎨 UI/UX Improvements?

The landing page could always be better! If you have ideas for:

- Better copy
- Cooler animations
- Clearer explanations
- Design improvements

Just open a PR or issue. We're not precious about it!

### 5. 🤖 New AI Agent Support?

Want to add support for another AI assistant? Awesome! Check out the agent detection system in `core/agent-detector.js` and follow the pattern.

## 📋 Quick Contribution Guide

### Step 1: Fork & Clone

```bash
# Fork on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/prjct-cli
cd prjct-cli
```

### Step 2: Create a Branch

```bash
# Name it something descriptive
git checkout -b add-cursor-support
# or
git checkout -b fix-ship-command
# or
git checkout -b improve-docs
```

### Step 3: Make Your Changes

Do your thing! Remember:

- Keep it simple
- Follow the existing code style (roughly)
- Test it with at least one AI agent
- Have fun with it

### Step 4: Test It

```bash
# For CLI commands
./test-agent-detection.js

# For landing page
cd landing && npm run dev

# Try your changes with your AI
/p:init
/p:now "testing my awesome change"
```

### Step 5: Commit

```bash
# Be descriptive but don't overthink it
git add .
git commit -m "feat: add support for Cursor AI"
# or
git commit -m "fix: ship command now handles emojis correctly"
# or
git commit -m "docs: add examples for complex tasks"
```

**Commit format** (loosely):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting, missing semicolons, etc
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `test:` - Adding tests
- `chore:` - Maintenance

### Step 6: Push & PR

```bash
git push origin your-branch-name
```

Then open a PR on GitHub with:

- **Title**: What you did
- **Description**: Why you did it (can be super brief)
- **Screenshots**: If it's visual
- **Tested with**: Which AI agent(s) you tested with

## 🚫 What NOT to Do

Please don't:

- Add heavy dependencies without discussion
- Change core philosophy (zero friction, single task focus, celebration)
- Add complex configuration or settings
- Create elaborate project management features
- Add telemetry or tracking (we're local-first!)

## 🤔 Not Sure About Something?

Just ask! Open an issue with `[QUESTION]` in the title. We're friendly, I promise.

## 🎉 Recognition

Every contributor gets:

- Their name in the Contributors section
- Eternal gratitude from indie hackers everywhere
- Good karma for helping builders ship faster

## 💬 Community

- **Issues**: Best place for discussions
- **PRs**: Where the magic happens
- **Twitter/X**: Tag [@jlopezlira](https://twitter.com/jlopezlira) to share what you shipped with prjct!

## 🏗️ Project Structure Quick Guide

```
prjct-cli/
├── core/                 # Core logic
│   ├── agent-detector.js # Agent detection magic
│   ├── agents/          # Agent adapters
│   └── commands.js      # Command implementations
├── commands/            # Command docs/definitions
├── adapters/           # AI platform adapters
├── landing/            # Landing page (React + Vite)
├── docs/              # Documentation
├── install.sh         # Installation script
├── uninstall.sh       # Clean uninstallation script
└── .prjct/           # Your actual project data
```

## 🧹 Uninstallation

If you need to remove prjct-cli:

```bash
cd ~/.prjct-cli
./uninstall.sh
```

The uninstaller will:

- Safely remove all components
- Offer to backup or preserve your project data
- Clean up shell configurations
- Require confirmation before any destructive action

See [UNINSTALL.md](UNINSTALL.md) for detailed information.

## 🚀 Release Process

We ship when we ship. No schedules, no roadmaps, no quarterly planning. When something good is ready, we release it.

## 🙏 Thanks!

Seriously, thank you for contributing. Every line of code, every idea, every bug report makes this better for all of us trying to build cool stuff without the corporate nonsense.

Now go ship something awesome! 🚀

---

**P.S.** - If you use prjct to build prjct improvements, that's meta and we love it.

**P.P.S.** - Yes, you can use `/p:ship "my first prjct contribution"` after your PR gets merged. You earned it!
