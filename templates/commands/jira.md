---
allowed-tools: [Bash, AskUserQuestion]
---

# p. jira $ARGUMENTS

Supports: `setup`, `status` (default), `sync`, `start <KEY>`.

```bash
prjct jira $ARGUMENTS --md
```

Follow the instructions in the CLI output.

For `setup`: ASK for credentials if not set (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN).
