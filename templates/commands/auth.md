---
allowed-tools: [Read, Write, Bash]
description: 'Manage Cloud Authentication'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:auth - Cloud Authentication

Manage authentication for prjct cloud sync.

## Subcommands

| Command | Purpose |
|---------|---------|
| `/p:auth` | Show current auth status |
| `/p:auth login` | Authenticate with prjct cloud |
| `/p:auth logout` | Clear authentication |
| `/p:auth status` | Detailed auth status |

## Context Variables
- `{authPath}`: `~/.prjct-cli/config/auth.json`
- `{apiUrl}`: API base URL (default: https://api.prjct.app)
- `{dashboardUrl}`: Web dashboard URL (https://app.prjct.app)

---

## /p:auth (default) - Show Status

### Flow

1. READ: `{authPath}`
2. IF authenticated:
   - Show email and API key prefix
3. ELSE:
   - Show "Not authenticated" message

### Output (Authenticated)

```
☁️ Cloud Sync: Connected

Email: {email}
API Key: {apiKeyPrefix}...
Last auth: {lastAuth}

Sync enabled for all projects.
```

### Output (Not Authenticated)

```
☁️ Cloud Sync: Not connected

Run `/p:auth login` to enable cloud sync.

Benefits:
- Sync progress across devices
- Access from web dashboard
- Backup your project data
```

---

## /p:auth login - Authenticate

### Flow

1. **Check existing auth**
   READ: `{authPath}`
   IF already authenticated:
     ASK: "You're already logged in as {email}. Re-authenticate? (y/n)"
     IF no: STOP

2. **Open dashboard**
   OUTPUT: "Opening prjct dashboard to get your API key..."
   OPEN browser: `{dashboardUrl}/settings/api-keys`

3. **Wait for API key**
   OUTPUT instructions:
   ```
   1. Log in to prjct.app (GitHub OAuth)
   2. Go to Settings → API Keys
   3. Click "Create New Key"
   4. Copy the key (starts with prjct_)
   5. Paste it below
   ```

4. **Get API key from user**
   PROMPT: "Paste your API key: "
   READ: `{apiKey}` from user input

5. **Validate key**
   - Check format starts with "prjct_"
   - Test connection with GET /health
   - Fetch user info with GET /auth/me

   IF invalid:
     OUTPUT: "Invalid API key. Please try again."
     STOP

6. **Save auth**
   WRITE: `{authPath}`
   ```json
   {
     "apiKey": "{apiKey}",
     "apiUrl": "https://api.prjct.app",
     "userId": "{userId}",
     "email": "{email}",
     "lastAuth": "{GetTimestamp()}"
   }
   ```

### Output (Success)

```
✅ Authentication successful!

Logged in as: {email}
API Key: {apiKeyPrefix}...

Cloud sync is now enabled. Your projects will sync automatically
when you run /p:sync or /p:ship.
```

### Output (Failure)

```
❌ Authentication failed

{error}

Please check your API key and try again.
Get a new key at: {dashboardUrl}/settings/api-keys
```

---

## /p:auth logout - Clear Auth

### Flow

1. READ: `{authPath}`
   IF not authenticated:
     OUTPUT: "Not logged in. Nothing to do."
     STOP

2. ASK: "Are you sure you want to log out? (y/n)"
   IF no: STOP

3. DELETE or CLEAR: `{authPath}`

### Output

```
✅ Logged out successfully

Cloud sync is now disabled.
Run `/p:auth login` to re-enable.
```

---

## /p:auth status - Detailed Status

### Flow

1. READ: `{authPath}`
2. IF authenticated:
   - Test connection
   - Show detailed status
3. ELSE:
   - Show not connected message

### Output (Connected)

```
☁️ Cloud Authentication Status

Connection:    ✓ Connected
Email:         {email}
User ID:       {userId}
API Key:       {apiKeyPrefix}...
API URL:       {apiUrl}
Last Auth:     {lastAuth}

API Status:    ✓ Reachable
```

### Output (Connection Error)

```
☁️ Cloud Authentication Status

Connection:    ⚠️ Error
Email:         {email}
API Key:       {apiKeyPrefix}...
API URL:       {apiUrl}

Error: {connectionError}

Try `/p:auth login` to re-authenticate.
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Invalid key format | "API key must start with prjct_" |
| Key rejected by API | "Invalid or expired API key" |
| Network error | "Cannot connect to {apiUrl}. Check internet." |
| Already logged in | Offer to re-authenticate |

---

## Auth File Structure

Location: `~/.prjct-cli/config/auth.json`

```json
{
  "apiKey": "prjct_live_xxxxxxxxxxxxxxxxxxxx",
  "apiUrl": "https://api.prjct.app",
  "userId": "uuid-from-server",
  "email": "user@example.com",
  "lastAuth": "2024-01-15T10:00:00.000Z"
}
```

**Security Notes:**
- API key is stored in plain text (like git credentials)
- File permissions should be 600 (user read/write only)
- Never commit this file to version control
