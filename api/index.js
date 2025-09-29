export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>prjct-cli - AI Project Management for Indie Hackers</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            text-align: center;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .tagline {
            font-size: 1.25rem;
            opacity: 0.9;
            margin-bottom: 3rem;
        }
        .install-box {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .install-command {
            background: rgba(0, 0, 0, 0.3);
            padding: 1rem;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 1rem;
            margin: 1rem 0;
            position: relative;
            overflow-x: auto;
        }
        .copy-btn {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .copy-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-top: 3rem;
        }
        .feature {
            background: rgba(255, 255, 255, 0.1);
            padding: 1.5rem;
            border-radius: 8px;
            backdrop-filter: blur(10px);
        }
        .feature-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .feature-title {
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .feature-desc {
            font-size: 0.9rem;
            opacity: 0.8;
        }
        .warning {
            background: rgba(255, 193, 7, 0.2);
            border: 1px solid rgba(255, 193, 7, 0.5);
            border-radius: 5px;
            padding: 1rem;
            margin-top: 2rem;
        }
        .footer {
            margin-top: 3rem;
            opacity: 0.7;
            font-size: 0.9rem;
        }
        @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            .tagline { font-size: 1rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 prjct-cli</h1>
        <p class="tagline">AI-Integrated Project Management for Indie Hackers</p>

        <div class="install-box">
            <h2 style="margin-bottom: 1rem;">Quick Install</h2>
            <div class="install-command">
                curl -fsSL https://prjct-cli.vercel.app/install.sh | bash
                <button class="copy-btn" onclick="copyCommand()">📋 Copy</button>
            </div>
            <p style="font-size: 0.9rem; opacity: 0.8;">Requires Node.js 14+ installed</p>
        </div>

        <div class="warning">
            <strong>⚠️ Private Tool</strong><br>
            This is a proprietary tool. Installation requires authentication.
        </div>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">🎯</div>
                <div class="feature-title">Zero Friction</div>
                <div class="feature-desc">Integrates seamlessly with your AI workflow</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🤖</div>
                <div class="feature-title">AI Commands</div>
                <div class="feature-desc">Use /p: commands in Claude or ChatGPT</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📊</div>
                <div class="feature-title">Progress Tracking</div>
                <div class="feature-desc">Track what you ship, not story points</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🏆</div>
                <div class="feature-title">Ship & Celebrate</div>
                <div class="feature-desc">Focus on wins and momentum</div>
            </div>
        </div>

        <div class="footer">
            <p>Built for indie hackers, by indie hackers</p>
            <p style="margin-top: 0.5rem;">© 2024 prjct-cli</p>
        </div>
    </div>

    <script>
        function copyCommand() {
            const command = 'curl -fsSL https://prjct-cli.vercel.app/install.sh | bash';
            navigator.clipboard.writeText(command).then(() => {
                const btn = document.querySelector('.copy-btn');
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = '📋 Copy';
                }, 2000);
            });
        }
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}