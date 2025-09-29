# Deployment Guide

## 🚀 GitHub Pages Deployment

This project uses GitHub Pages to host the website and installation script.

### Setup GitHub Pages

1. **Fork/Clone the Repository**
   ```bash
   git clone https://github.com/jlopezlira/prjct-cli
   cd prjct-cli
   ```

2. **Configure GitHub Pages**

   **Option A: Using GitHub Actions (Recommended)**
   - Go to Settings → Pages
   - Set Source: **GitHub Actions**
   - The workflow is already configured in `.github/workflows/deploy.yml`

   **Option B: Deploy from Branch**
   - Go to Settings → Pages
   - Set Source: **Deploy from a branch**
   - Set Branch: **main**
   - Set Folder: **/docs**
   - Click Save

### Your Site Will Be Available At

- **Website**: `https://jlopezlira.github.io/prjct-cli`
- **Install Script**: `https://jlopezlira.github.io/prjct-cli/install.sh`

### Deploy Updates

Use the included deployment script:

```bash
./scripts/deploy.sh
```

This script will:
- Make the install script executable
- Check for uncommitted changes
- Push to GitHub
- Trigger GitHub Pages deployment

### Manual Deployment

```bash
# Make install script executable
chmod +x docs/install.sh

# Commit and push
git add .
git commit -m "Update GitHub Pages"
git push origin main
```

### Custom Domain (Optional)

1. Create a `CNAME` file in the `docs/` directory
2. Add your custom domain (e.g., `prjct.yourdomain.com`)
3. Configure DNS settings with your domain provider
4. Update install URLs in documentation

## 📦 GitHub Releases

The actual CLI tool is distributed via GitHub:

1. Users can install directly from GitHub using the curl installer
2. The installer automatically fetches the latest release
3. No build process required - it's all JavaScript

## 🔧 Local Development

For local development:

```bash
# Install dependencies
npm install

# Run locally (if you add a dev server)
npm run dev

# Test the install script locally
./setup.sh
```

## 📝 Notes

- The Vercel deployment only serves the landing page and install script
- The actual CLI code is pulled from GitHub during installation
- This keeps hosting costs minimal while providing a nice installation experience