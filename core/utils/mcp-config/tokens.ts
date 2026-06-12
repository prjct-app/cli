/**
 * mcp-remote version pin.
 *
 * mcp-remote stores OAuth tokens in `~/.mcp-auth/mcp-remote-{version}/`.
 * If mcp.json and the manual auth step use different versions, Claude
 * Code won't find the cached tokens and silently fails to authenticate —
 * so the version is pinned and referenced everywhere from here.
 *
 * The token validation/migration/scanning helpers that used to live in
 * this module served the removed `verify` command and died with it.
 */

export const MCP_REMOTE_VERSION = 'mcp-remote@0.1.38'
