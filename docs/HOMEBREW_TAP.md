# Homebrew Tap Setup Instructions

This document explains how to set up the Homebrew tap repository for prjct-cli.

## Creating the Tap Repository

1. **Create new GitHub repository:**
   ```bash
   # Repository name MUST follow pattern: homebrew-<name>
   # For prjct, create: homebrew-prjct
   ```

2. **Initialize the repository:**
   ```bash
   git clone https://github.com/jlopezlira/homebrew-prjct.git
   cd homebrew-prjct
   mkdir -p Formula
   ```

3. **Copy the formula:**
   ```bash
   # Copy Formula/prjct.rb from this repository to homebrew-prjct/Formula/
   cp /path/to/prjct-cli/Formula/prjct.rb Formula/
   ```

4. **Create README.md:**
   ```markdown
   # Homebrew Tap for prjct

   Official Homebrew tap for [prjct-cli](https://github.com/jlopezlira/prjct-cli).

   ## Installation

   ```bash
   brew tap jlopezlira/prjct
   brew install prjct
   ```

   ## Updating

   ```bash
   brew upgrade prjct
   ```

   ## Uninstalling

   ```bash
   brew uninstall prjct
   brew untap jlopezlira/prjct
   ```
   ```

5. **Commit and push:**
   ```bash
   git add .
   git commit -m "Initial tap setup for prjct"
   git push origin main
   ```

## GitHub Token for Automated Updates

The release workflow automatically updates the Homebrew formula when a new version is released. To enable this:

1. **Create a Personal Access Token (PAT):**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Name: `HOMEBREW_TAP_TOKEN`
   - Scopes: Select `repo` (full control)
   - Generate and copy the token

2. **Add token to prjct-cli repository secrets:**
   - Go to prjct-cli repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `HOMEBREW_TAP_TOKEN`
   - Value: Paste your PAT
   - Add secret

3. **Verify workflow permissions:**
   - The release workflow (`.github/workflows/release.yml`) uses this token
   - It automatically updates the formula URL and SHA256 on each release

## Testing the Tap Locally

Before publishing, test the tap locally:

```bash
# Add local tap
brew tap jlopezlira/prjct

# Test installation (dry-run)
brew install --dry-run prjct

# Audit formula
brew audit --strict prjct

# Test installation
brew install prjct

# Verify
prjct --version
```

## Formula Maintenance

### Updating the Formula

When releasing a new version:

1. **Manual update (if automated workflow fails):**
   ```bash
   cd homebrew-prjct

   # Update URL and version
   vim Formula/prjct.rb
   # Change: url "https://github.com/.../archive/refs/tags/vX.Y.Z.tar.gz"

   # Download tarball and calculate SHA256
   curl -fsSL https://github.com/jlopezlira/prjct-cli/archive/refs/tags/v0.4.0.tar.gz | sha256sum

   # Update sha256 in formula
   # Change: sha256 "new_checksum_here"

   git add Formula/prjct.rb
   git commit -m "Update prjct to vX.Y.Z"
   git push
   ```

2. **Automatic update (via GitHub Actions):**
   - Push a new tag to prjct-cli: `git tag v0.4.0 && git push origin v0.4.0`
   - Release workflow automatically updates homebrew-prjct repository
   - No manual intervention needed

### Testing Formula Changes

```bash
# Audit for issues
brew audit --strict --online prjct

# Test installation from source
brew install --build-from-source prjct

# Test dependencies
brew deps prjct

# Uninstall for clean test
brew uninstall prjct
brew install prjct
```

## Troubleshooting

### Formula Won't Install

**Issue**: `Error: No available formula with the name "prjct"`

**Solution**:
```bash
brew update
brew untap jlopezlira/prjct
brew tap jlopezlira/prjct
brew install prjct
```

### SHA256 Mismatch

**Issue**: `SHA256 mismatch`

**Solution**:
```bash
# Recalculate checksum
curl -fsSL https://github.com/jlopezlira/prjct-cli/archive/refs/tags/v0.4.0.tar.gz | sha256sum

# Update in Formula/prjct.rb
```

### Dependencies Not Found

**Issue**: `Error: node@18 not found`

**Solution**:
```bash
# Install dependency
brew install node@18

# Link if needed
brew link node@18
```

## Best Practices

1. **Versioning**: Always use semantic versioning (vX.Y.Z)
2. **Testing**: Test formula changes locally before pushing
3. **Auditing**: Run `brew audit` before releases
4. **Documentation**: Keep formula comments up to date
5. **Dependencies**: Minimize dependencies, specify versions if needed

## Resources

- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew Tap Documentation](https://docs.brew.sh/Taps)
- [Formula API Reference](https://rubydoc.brew.sh/Formula)
