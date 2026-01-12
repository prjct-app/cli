# prjct-bar 🎯

macOS Status Bar app for prjct-cli - Ship fast, track progress, stay focused.

## Features

- 🎯 **Current Task Display** - See what you're working on at a glance
- ⚡ **Quick Actions** - Complete, pause, or switch tasks instantly
- 💡 **Idea Capture** - Brain dump without leaving your flow
- 📋 **Queue Preview** - See what's next in your pipeline
- 🚀 **Ship Celebrations** - Native notifications when you ship
- 🔄 **Real-time Sync** - SSE connection to prjct server
- ⌨️ **Global Hotkeys** - `⌘⇧P` to toggle, `⌘⇧N` for quick idea

## Requirements

- macOS 13.0+ (Ventura)
- prjct-cli server running (`prjct server`)
- Xcode 15+ (for development)

## Installation

### From Release (Recommended)

```bash
# Download latest release
curl -L https://github.com/jlopezlira/prjct-cli/releases/latest/download/PrjctBar.dmg -o PrjctBar.dmg
open PrjctBar.dmg
# Drag to Applications
```

### Build from Source

```bash
cd packages/status-bar/PrjctBar
xcodebuild -scheme PrjctBar -configuration Release
```

## Architecture

```
PrjctBar/
├── Sources/
│   ├── App/
│   │   ├── PrjctBarApp.swift      # App entry point
│   │   └── AppDelegate.swift       # Menu bar setup
│   ├── Views/
│   │   ├── MenuBarView.swift       # Main popover view
│   │   ├── CurrentTaskView.swift   # Current focus display
│   │   ├── QueueListView.swift     # Task queue
│   │   ├── QuickCaptureView.swift  # Idea input
│   │   └── ProjectSelector.swift   # Project switcher
│   ├── Models/
│   │   ├── Project.swift           # Project model
│   │   ├── Task.swift              # Task model
│   │   └── AppState.swift          # Global state
│   ├── Services/
│   │   ├── APIClient.swift         # HTTP client
│   │   ├── SSEClient.swift         # Real-time events
│   │   └── HotkeyService.swift     # Global shortcuts
│   └── Utilities/
│       ├── TimeFormatter.swift     # Duration formatting
│       └── Theme.swift             # Colors & styling
└── Resources/
    └── Assets.xcassets             # App icons
```

## API Endpoints Used

The app connects to `localhost:3478` (prjct server):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all projects |
| `/api/projects/:id/full` | GET | Full project dashboard |
| `/api/projects/:id/task/complete` | POST | Complete current task |
| `/api/projects/:id/task/pause` | POST | Pause current task |
| `/api/projects/:id/ideas` | POST | Capture new idea |
| `/api/events` | SSE | Real-time updates |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧P` | Toggle panel |
| `⌘⇧N` | Quick capture idea |
| `⌘⇧D` | Complete current task |
| `⌘⇧S` | Switch project |
| `Esc` | Close panel |

## Configuration

Config stored in `~/.prjct-cli/config/status-bar.json`:

```json
{
  "serverPort": 3478,
  "showInDock": false,
  "launchAtLogin": true,
  "theme": "system",
  "notifications": {
    "taskComplete": true,
    "shipped": true,
    "longSession": true
  }
}
```

## Development

```bash
# Open in Xcode
open PrjctBar.xcodeproj

# Run tests
xcodebuild test -scheme PrjctBar

# Build for release
xcodebuild -scheme PrjctBar -configuration Release archive
```

## License

MIT - Part of prjct-cli
