---
name: qa-announce-ready-for-staging
description: >-
    Fetch GitHub issues in "Ready for Staging" on the deriv-com Options Trading
    Web App project board (org project 17), then announce them in Slack channel
    #project_dtrader_charts_v2 (C096W3LNX32) tagging the dtrader usergroup
    (S05D1BZ5AS1) and asking the team to proceed with milestone creation. Use when
    the user asks for Ready for Staging items, staging-ready issues, to announce
    staging cards, create a milestone from Ready for Staging, project 17 Board
    view, or links https://github.com/orgs/deriv-com/projects/17/views/2.
version: 1.2.0
last_updated: 2026-09-03
---

# Announce Ready for Staging → Milestone

1. Pull every item whose **Status** is **Ready for Staging** from org project **#17**.
2. Show a draft Slack message (with count), get confirmation, then post it asking the team to **create a milestone**.

## When to Use

- User asks for issues "Ready for Staging", "ready for staging", or "staging ready"
- User asks to announce staging cards / ask for a new milestone
- User pastes https://github.com/orgs/deriv-com/projects/17/views/2

## Prerequisites

- `gh` CLI authenticated with project read access (`read:project` / `project`, plus `repo`).
- Slack MCP available (`slack_send_message` / `slack_send_message_draft`).
- Prefer `gh` over GitHub MCP if GitHub auth fails.

```bash
gh auth status
```

## Constants

### GitHub project

| Key                       | Value                                                 |
| ------------------------- | ----------------------------------------------------- |
| Owner                     | `deriv-com`                                           |
| Project number            | `17`                                                  |
| Project title             | Options Trading Web App                               |
| Board view                | https://github.com/orgs/deriv-com/projects/17/views/2 |
| Target status             | `Ready for Staging` (exact; capital **S**)            |
| Primary repo (milestones) | `deriv-com/derivatives-trader`                        |

### Slack

| Key                 | Value                       |
| ------------------- | --------------------------- |
| Channel name        | `project_dtrader_charts_v2` |
| Channel id          | `C096W3LNX32`               |
| Usergroup (dtrader) | `S05D1BZ5AS1`               |
| Usergroup mention   | `<!subteam^S05D1BZ5AS1>`    |

Do **not** invent other status spellings. Match `Ready for Staging` exactly.

---

## Workflow

### Step 1: Fetch project items

```bash
gh project item-list 17 --owner deriv-com --format json --limit 500
```

If `items` length equals the limit, raise `--limit` (e.g. `1000`) and re-fetch.

### Step 2: Filter, sort, and collect

Keep only items where `status == "Ready for Staging"`.

Sort by repository name, then issue number ascending (stable list).

```bash
gh project item-list 17 --owner deriv-com --format json --limit 500 \
  | python3 -c '
import json, sys
data = json.load(sys.stdin)
items = [i for i in data.get("items", []) if i.get("status") == "Ready for Staging"]
def sort_key(i):
    c = i.get("content") or {}
    repo = (i.get("repository") or "")
    num = c.get("number") or 0
    return (repo, num)
items.sort(key=sort_key)
print(json.dumps({"count": len(items), "items": items}, indent=2))
'
```

For each item capture: repository, number, title, type, URL, assignees.

If **count is 0**: tell the user clearly, **do not** post to Slack, **do not** invent placeholders. Stop.

### Step 3: Show the list + Slack draft in chat

Present the issue list, then the **exact** Slack body that will be sent.

Slack link format: `<https://github.com/.../issues/N|title>`

**Required message shape:**

```text
Hi <!subteam^S05D1BZ5AS1>, we have N cards ready for staging — please proceed to create a milestone:

- <https://github.com/deriv-com/derivatives-trader/issues/NNNN|title>
- <https://github.com/deriv-com/derivatives-trader/issues/NNNN|title>
```

Rules:

- Always include `<!subteam^S05D1BZ5AS1>`. Do **not** omit the tag.
- Include the **count** (`N`) in the opener.
- Lead with: ready for staging + ask to **proceed to create a milestone**.
- Bullet each issue with a clickable GitHub URL (title as link text).
- Prefer `derivatives-trader` links; other repos keep their real URLs.
- Skip draft items with no public URL (mention in chat only unless the user insists).
- Bullets only — no Slack tables/headers.
- Do **not** create the GitHub milestone unless the user explicitly asks afterward.

### Step 4: Send via Slack MCP (with confirmation)

1. Wait for explicit “send it” / “post it” (or use `slack_send_message_draft` if the user wants a Slack Draft first).
2. On confirmation, call `slack_send_message`:
    - `channel_id`: `C096W3LNX32`
    - `message`: the composed text
    - `unfurl_app_links`: `false` by default (titles are already in the bullets; set `true` only if the user asks for GitHub previews)
3. Return the Slack message permalink.

Never post if the list was empty or the user rejected the draft.

### Step 5: Optional follow-ups (only if asked)

- `gh issue view <number> -R deriv-com/derivatives-trader`
- Create / edit a milestone in `deriv-com/derivatives-trader` (pattern `production_VYYYYMMDD_N`) — **only when explicitly requested**
- Format an issue via the `qa-bug-report` skill

Do **not** mutate project Status, labels, or issue bodies unless the user explicitly asks.

---

## Notes / pitfalls

- View **#2** has no saved filter — always filter JSON `status` client-side.
- Other statuses must not appear in the Slack list.
- This skill announces and requests milestone creation; it does not invent a milestone title unless the user specifies one.
- Usergroup mention syntax is exactly `<!subteam^S05D1BZ5AS1>` (not plain `@dtrader`).

## Related

- `qa-bug-report` — rewrite a single issue into the QA bug-report template after picking from this list.
