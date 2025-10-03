# Catppuccin Color Scheme for prjct-cli

**Version**: 0.6.0
**Theme**: Catppuccin Mocha
**Reference**: https://github.com/catppuccin/catppuccin

## Color Palette

### Base Colors
- **Base**: `#1e1e2e` - Main background
- **Mantle**: `#181825` - Darker background
- **Crust**: `#11111b` - Darkest background

### Text Colors
- **Text**: `#cdd6f4` - Primary text
- **Subtext1**: `#bac2de` - Secondary text
- **Subtext0**: `#a6adc8` - Tertiary text

### Overlay Colors
- **Overlay2**: `#9399b2` - Light overlay
- **Overlay1**: `#7f849c` - Medium overlay
- **Overlay0**: `#6c7086` - Dark overlay
- **Surface2**: `#585b70` - Light surface
- **Surface1**: `#45475a` - Medium surface
- **Surface0**: `#313244` - Dark surface

### Accent Colors
- **Rosewater**: `#f5e0dc` - Soft pink
- **Flamingo**: `#f2cdcd` - Light pink
- **Pink**: `#f5c2e7` - Pink
- **Mauve**: `#cba6f7` - Purple (Primary UI)
- **Red**: `#f38ba8` - Error state
- **Maroon**: `#eba0ac` - Dark red
- **Peach**: `#fab387` - Orange (Accents)
- **Yellow**: `#f9e2af` - Warning state
- **Green**: `#a6e3a1` - Success state
- **Teal**: `#94e2d5` - Progress bars
- **Sky**: `#89dceb` - Light blue
- **Sapphire**: `#74c7ec` - Bright blue (Highlights)
- **Blue**: `#89b4fa` - Info state
- **Lavender**: `#b4befe` - Light purple (Secondary UI)

## Semantic Mapping

### Status Colors
| Usage | Color | Hex | Example |
|-------|-------|-----|---------|
| Success | Green | `#a6e3a1` | Completed tasks, checkmarks |
| Warning | Yellow | `#f9e2af` | Days since ship 3-7 |
| Error | Red | `#f38ba8` | Days since ship >7, errors |
| Info | Blue | `#89b4fa` | Task totals, information |

### UI Colors
| Usage | Color | Hex | Example |
|-------|-------|-----|---------|
| Primary | Mauve | `#cba6f7` | Dashboard borders, main UI |
| Secondary | Lavender | `#b4befe` | Secondary elements |
| Accent | Peach | `#fab387` | Ideas count, highlights |
| Muted | Overlay0 | `#6c7086` | Dimmed text, connectors |

### Progress Colors
| Usage | Color | Hex | Example |
|-------|-------|-----|---------|
| Progress | Teal | `#94e2d5` | Filled progress bars |
| Complete | Green | `#a6e3a1` | Completed metrics |
| Pending | Overlay1 | `#7f849c` | Empty progress bars |

### Text Colors
| Usage | Color | Hex | Example |
|-------|-------|-----|---------|
| Bold | Text (bold) | `#cdd6f4` | Headers, labels |
| Dim | Overlay0 | `#6c7086` | Secondary info |
| Highlight | Sapphire | `#74c7ec` | Current task, percentages |

## Dashboard Example

```
┌─ Project Status ────────────────────────────┐  ← Mauve borders
│ Sprint Progress    [████████░░] 80%         │  ← Teal filled, Overlay1 empty, Sapphire %
│ Tasks Complete     12/15                    │  ← Green/Blue numbers
│ Ideas in Backlog   8                        │  ← Peach number
│ Days Since Ship    3                        │  ← Yellow (warning)
├─ Current Focus ────────────────────────────┤  ← Mauve separator
│ → Building authentication system            │  ← Sapphire arrow, Text bold
│   Started: 2h 15m ago                       │  ← Overlay0 dimmed
└─────────────────────────────────────────────┘  ← Mauve borders
```

## Visual Hierarchy

### Primary Elements (Mauve - `#cba6f7`)
- Dashboard borders
- Box drawing characters
- Main structural elements

### Interactive Elements (Sapphire - `#74c7ec`)
- Current task indicator `→`
- Percentages
- Active items

### Success States (Green - `#a6e3a1`)
- Completed tasks
- Success checkmarks `✓`
- Positive metrics

### Warning States (Yellow - `#f9e2af`)
- Days since ship: 3-7 days
- Moderate alerts
- Caution indicators

### Error States (Red - `#f38ba8`)
- Days since ship: >7 days
- Errors and failures
- Critical alerts

### Progress Visualization (Teal - `#94e2d5`)
- Filled progress bars
- Active progress indicators
- Loading states

### Secondary Information (Overlay0 - `#6c7086`)
- Dimmed text
- Timeline connectors
- Less important details

## Implementation Notes

### Color Application
All colors are applied through the `COLORS` semantic mapping:
```javascript
COLORS.success('✓')    // Green checkmark
COLORS.warning('⚠')    // Yellow warning
COLORS.error('✗')      // Red error
COLORS.progress('█')   // Teal progress
COLORS.bold('Text')    // Bold text
COLORS.dim('Info')     // Dimmed text
COLORS.highlight('→')  // Sapphire highlight
```

### Accessibility
- High contrast between text and background
- Distinct colors for different states
- Color-blind friendly palette
- Semantic meaning reinforced with symbols

### Terminal Compatibility
- Uses true color (24-bit) via chalk.hex()
- Fallbacks to 256-color if needed
- Works on modern terminals
- Tested on iTerm2, Hyper, Windows Terminal

## Color Philosophy

Catppuccin Mocha provides:
- **Pastel colors**: Easy on the eyes
- **High contrast**: Readable text
- **Distinct states**: Clear visual hierarchy
- **Cohesive palette**: Professional appearance
- **Developer-focused**: Optimized for code and terminals

## Related Files

- `core/ascii-graphics.js` - Main implementation
- `templates/commands/status.md` - Dashboard template
- Color constants exported for reuse in other modules

## Preview

To see the colors in action:
```bash
prjct status  # View dashboard with Catppuccin colors
```

---

**Color Scheme**: Catppuccin Mocha
**Maintained by**: Catppuccin community
**License**: MIT
**Integration**: prjct-cli v0.6.0+
