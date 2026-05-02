/**
 * Branded HTML pages for the browser-based OAuth callback. Pure
 * functions: take strings in, return HTML out — no I/O, no state.
 */

export function buildSuccessPage(email: string, keyPrefix: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>prjct CLI Connected</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',sans-serif;
background:#0a0a0a;color:#e5e5e5;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center;max-width:420px;padding:2.5rem}
.logo{font-size:.875rem;letter-spacing:.05em;color:#888;margin-bottom:2rem;font-family:ui-monospace,monospace}
.logo span{color:#22d3ee}
.icon{width:64px;height:64px;border-radius:50%;background:rgba(34,211,238,.12);
display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}
.icon svg{width:32px;height:32px;color:#22d3ee}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem}
.details{background:#141414;border:1px solid #262626;border-radius:8px;padding:1rem 1.25rem;
margin:1.25rem 0;text-align:left;font-size:.875rem;line-height:1.75}
.details .label{color:#888}
.details .value{color:#e5e5e5}
.hint{color:#666;font-size:.8125rem;margin-top:1rem}
</style></head>
<body><div class="card">
<div class="logo"><span>prjct</span>/cli</div>
<div class="icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
<h1>CLI Connected</h1>
<div class="details">
<span class="label">Account:</span> <span class="value">${email}</span><br>
<span class="label">Key:</span> <span class="value">${keyPrefix}...</span>
</div>
<p class="hint">Return to your terminal to continue.</p>
</div></body></html>`
}

export function buildErrorPage(error: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>prjct CLI — Error</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',sans-serif;
background:#0a0a0a;color:#e5e5e5;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center;max-width:420px;padding:2.5rem}
.logo{font-size:.875rem;letter-spacing:.05em;color:#888;margin-bottom:2rem;font-family:ui-monospace,monospace}
.logo span{color:#22d3ee}
.icon{width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,.12);
display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}
.icon svg{width:32px;height:32px;color:#ef4444}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem}
.msg{background:#141414;border:1px solid #262626;border-radius:8px;padding:1rem 1.25rem;
margin:1.25rem 0;font-size:.875rem;color:#f87171}
.hint{color:#666;font-size:.8125rem;margin-top:1rem}
</style></head>
<body><div class="card">
<div class="logo"><span>prjct</span>/cli</div>
<div class="icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>
<h1>Authentication Failed</h1>
<div class="msg">${error}</div>
<p class="hint">Return to your terminal and try again.</p>
</div></body></html>`
}
