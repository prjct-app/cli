# Installation Path Fix Documentation

## Issue

Users reported the following error during installation:

```
[3/5] Running setup
  ▸ Installing componentschmod: setup.sh: No such file or directory
```

## Root Cause Analysis

The installation process had two path-related issues:

### Issue 1: Incorrect reference in install.sh

The `install.sh` script (in both `scripts/` and `docs/` directories) was trying to execute `./setup.sh` from the installation directory root, but the file is actually located at `scripts/setup.sh`.

**Before:**

```bash
cd "$INSTALL_DIR"  # Changes to ~/.prjct-cli

# Run setup script
chmod +x setup.sh        # ❌ Looking for setup.sh in current directory
./setup.sh > /tmp/prjct-setup.log 2>&1  # ❌ Not found!
```

### Issue 2: Incorrect SCRIPT_DIR in setup.sh

The `scripts/setup.sh` file was setting `SCRIPT_DIR` to point to the `scripts/` directory itself, but then trying to access files that are in the project root (like `package.json`, `core/`, `bin/`).

**Before:**

```bash
# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# This would set SCRIPT_DIR to ~/.prjct-cli/scripts/

cd "$SCRIPT_DIR"  # Now in scripts/
npm install       # ❌ But package.json is in parent directory!
```

## Solution

### Fix 1: Update install.sh path references

Changed both `scripts/install.sh` and `docs/install.sh` to reference the correct path:

```bash
cd "$INSTALL_DIR"  # Changes to ~/.prjct-cli

# Run setup script
chmod +x scripts/setup.sh        # ✅ Correct path
./scripts/setup.sh > /tmp/prjct-setup.log 2>&1  # ✅ Found!
```

### Fix 2: Update SCRIPT_DIR in setup.sh

Changed `scripts/setup.sh` to set `SCRIPT_DIR` to the project root (parent of scripts/):

```bash
# Get project root directory (parent of scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
# This now sets SCRIPT_DIR to ~/.prjct-cli/ (the project root)

cd "$SCRIPT_DIR"  # Now in project root
npm install       # ✅ package.json is here!
```

## Files Modified

1. **scripts/install.sh** (lines 265, 267)
   - Changed `chmod +x setup.sh` to `chmod +x scripts/setup.sh`
   - Changed `./setup.sh` to `./scripts/setup.sh`

2. **docs/install.sh** (lines 265, 267)
   - Same changes as scripts/install.sh (these files are identical)

3. **scripts/setup.sh** (line 75)
   - Changed from: `SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"`
   - Changed to: `SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"`
   - Added comment: "Get project root directory (parent of scripts/)"

## Testing

A comprehensive verification script has been added at `tests/verify-install-paths.sh` which tests:

1. ✅ scripts/setup.sh exists and is accessible
2. ✅ chmod works with the new path
3. ✅ Script is executable
4. ✅ SCRIPT_DIR logic points to project root
5. ✅ Required files (package.json, core/, bin/) are accessible from SCRIPT_DIR
6. ✅ Syntax validation of all modified scripts
7. ✅ Both install.sh files remain identical

Run the test:

```bash
./tests/verify-install-paths.sh
```

## Impact

This fix resolves the installation failure that users experienced. The installation will now:

1. Successfully find and execute `scripts/setup.sh`
2. Correctly identify the project root directory
3. Access all required resources (package.json, core/, bin/, etc.)

## Related Issues

- Fixes the "setup.sh: No such file or directory" error
- Ensures npm dependencies can be installed in the correct location
- Allows setup.sh to create bin/ executable in the correct location
- Enables proper Claude Code command installation
