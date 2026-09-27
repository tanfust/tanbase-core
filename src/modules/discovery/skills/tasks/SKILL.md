---
name: {{id}}-tasks
description: Read and update a person's {{name}} task board through its remote MCP server. Use when someone asks to see, add, or finish tasks in {{name}}.
---

# {{name}} tasks

{{name}} is a personal task board at {{origin}}. Its remote
MCP server lets an agent list, create, and complete the signed-in person's
tasks. It has no public API keys: each person connects their own account
through OAuth.

## Connect

1. Add `{{origin}}/mcp` as a remote MCP server (Streamable
   HTTP). In Claude, add it as a custom connector.
2. The first request returns `401` with
   `WWW-Authenticate: Bearer resource_metadata="{{origin}}/.well-known/oauth-protected-resource/mcp"`.
   Follow it to the authorization server `{{origin}}/api/auth`.
3. Register the client with Dynamic Client Registration, then run the
   authorization code flow with PKCE and
   `resource={{origin}}/mcp`.
4. The person signs in on `/login` and approves the client on
   `/oauth/consent`. They need an account with a verified email; if they sign
   up during the flow, start the connection again after verifying.

Access tokens last one hour and refresh tokens 30 days. To disconnect, the
client revokes its refresh token at `/api/auth/oauth2/revoke`.

## Tools

- `list_tasks`: the person's tasks across projects. Optional filters:
  `projectId`, `status` (`todo`, `doing`, or `done`), `dueBefore`
  (`YYYY-MM-DD`, inclusive), and `limit` (1 to 100, default 50).
- `create_task`: needs a `title`. Optional `notes`, `projectId`, `status`,
  and `dueDate` (`YYYY-MM-DD`). Without a `projectId`, the task goes to the
  person's first project.
- `complete_task`: marks one task done by the `taskId` that `list_tasks`
  returned. Completing a done task again is harmless.

## Conventions

- Due dates are calendar days, not times.
- Get task IDs from `list_tasks`; never guess them.
- Tasks created or completed through MCP appear live on every open board.
- There is no tool to delete tasks or projects. Ask the person to do that on
  the board.
- A tool error, such as `Task not found.`, is a readable message. Correct the
  input and try again rather than retrying unchanged.

## In the browser

When an agent works in the person's browser on `{{host}}`, the page
registers the same three tools through WebMCP (`navigator.modelContext`).
They act as the signed-in person and ask them to sign in otherwise.
