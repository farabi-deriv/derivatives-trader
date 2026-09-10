---
name: qa-bug-report
description: >-
    Create or format structured QA GitHub bug reports with gh CLI. Format/update
    existing issues from screenshots or stubs; create new issues from Slack
    threads; optionally draft Slack pings or thread replies after the user
    confirms. Use when the user asks for /qa-bug-report, /format-gh-issue, create
    a card from Slack, update title/description, or polish a bughunt issue.
version: 1.4.0
last_updated: 2026-09-04
---

# QA Bug Report

Two modes:

| Mode                      | Trigger                                        | Action                                                                 |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **A — Format**            | GitHub issue URL / “format this issue”         | Rewrite title + body via `gh issue edit`                               |
| **B — Create from Slack** | Slack thread URL / “create an issue from this” | Draft issue → user confirms → `gh issue create` → optional Slack reply |

Never create, edit, or post to Slack without an explicit user confirm when the skill says to ask first. Always show drafts before send/create when confirmation is required.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`). Prefer `gh` over GitHub MCP if auth fails.
- Slack MCP for threads (`slack_read_thread`, `slack_read_file`, `slack_send_message`).

## Defaults (DTrader / Options Trading)

- Repo: `deriv-com/derivatives-trader`
- Channel for FE pings: `C0BPHM5QUNQ` (`#war_room_dtrader`)
- Usergroup: `S05D1BZ5AS1` (`@team_dtrader_fe`)

Ask if the user names a different repo/channel.

---

## Title & body rules (both modes)

### Title

- Concise, specific, actionable (under 80 characters).
- Use `[MOB]` when mobile/responsive-specific (and that matches repo convention).
- State the actual bug/UX gap clearly.

### Body template

```markdown
### Description

<1–2 paragraphs: what happens, why it matters, scope (web/mobile).>

### Steps to reproduce

1. Open DTrader (Web / Mobile / Responsive).
2. <setup>
3. <trigger>
4. Observe <element>.

### Actual result

<What goes wrong.>

### Expected result

<Correct behaviour.>

### Context / Links

- Slack Thread: <permalink>
- Reported by: <name> in `#channel`
- Parent Issue: #<n> (if any)

### Screenshots

<Preserve GitHub attachment markup, or note screenshots live in the Slack thread>
```

---

## Mode A — Format an existing GitHub issue

### A1. Inspect

```bash
gh issue view <issue_number> -R <owner>/<repo>
```

Preserve all existing media (`user-attachments` / `<img …>`). Never replace with short-lived `private-user-images...?jwt=…` URLs. Inspect parent issues/comments when it is a sub-issue.

#### View private GitHub screenshots

`user-attachments` URLs fail with API-token `curl` (login HTML). Use GraphQL `bodyHTML` → signed CDN URL → download → `Read`:

```bash
IMG_URL=$(gh api graphql -f query='
query {
  repository(owner:"OWNER", name:"REPO") {
    issue(number:NUMBER) { bodyHTML }
  }
}' --jq '.data.repository.issue.bodyHTML' \
  | python3 -c "import sys,re; m=re.search(r'src=\"([^\"]+)\"', sys.stdin.read()); print(m.group(1) if m else '')")

curl -sL -o /tmp/issue-NUMBER-screenshot.png "$IMG_URL"
file /tmp/issue-NUMBER-screenshot.png
```

Re-fetch if the JWT expires (~5 minutes).

### A2. Gather context

Slack search / thread read if relevant; codebase/PR search for technical context; identify trigger / failure / likely cause.

### A3. Update via `gh`

```bash
gh issue edit <issue_number> -R <owner>/<repo> \
  --title "<Refined Title>" \
  --body "$(cat <<'EOF'
…
EOF
)"
```

### A4. Report back

Summarize new title, key points, and that media was preserved.

### A5. Optional channel ping (ask first)

Ask: post a Slack ping? Show draft; send only after confirm.

Draft style (reference: https://deriv-group.slack.com/archives/C0BPHM5QUNQ/p1788506453959969):

```text
Hi <!subteam^S05D1BZ5AS1>, please take a look at this bughunt card:

[<Title>](https://github.com/OWNER/REPO/issues/NUMBER)

**Summary**
<One short sentence>
```

On confirm: `slack_send_message` with `unfurl_app_links: true`; return the message link.

---

## Mode B — Create a GitHub issue from a Slack thread

Example source thread: https://deriv-group.slack.com/archives/C096W3LNX32/p1788504206827849  
→ produced https://github.com/deriv-com/derivatives-trader/issues/1368

### B1. Read the thread

Parse Slack permalink → `channel_id` + `message_ts` (e.g. `…/archives/C096W3LNX32/p1788504206827849` → `C096W3LNX32` + `1788504206.827849`).

```text
slack_read_thread(channel_id, message_ts)
```

Collect: reporter, channel name, full problem statement, desktop vs mobile notes, and every file ID on the parent/replies.

### B2. Inspect Slack screenshots

For each image file ID, `slack_read_file` → save/decode → `Read` so the write-up matches what is shown (do not invent UI details).

### B3. Draft for user confirmation (required)

Show in chat **before** creating:

- Proposed **repo** (default `deriv-com/derivatives-trader`)
- Proposed **title**
- Full **body** (template above; always include Slack permalink + reporter/channel)
- Proposed **labels** (e.g. `bug` + `bughunt` for defects; `enhancement` for UX polish like removing redundant copy)
- Whether screenshots are only linked via Slack (typical) or the user will attach later

Ask explicitly:

> Create this GitHub issue? (yes / edit title|body|labels / cancel)

Do **not** run `gh issue create` until the user confirms.

### B4. Create after confirm

```bash
gh issue create -R <owner>/<repo> \
  --title "<Title>" \
  --label "bug" \
  --body "$(cat <<'EOF'
…
EOF
)"
```

Adjust labels to what the user approved. Return the issue URL.

If GitHub cannot host Slack binaries easily, keep screenshots in Context (“see Slack thread”) rather than broken image links. Prefer real GitHub `user-attachments` only when already available.

### B5. Optional reply in the Slack thread (ask first)

Ask whether to reply on the **same thread** with the new issue link. Draft:

```text
Created an issue to track this: <https://github.com/OWNER/REPO/issues/NUMBER|github.com/OWNER/REPO/issues/NUMBER>
```

Reference reply style: same thread as the example (`…/p1788504206827849`).

On confirm: `slack_send_message` with `channel_id` + `thread_ts` = parent `message_ts`, `unfurl_app_links: true`. Do not also blast a separate `#war_room_dtrader` ping unless the user asks (that is Mode A Step A5).

---

## Routing

- GitHub issue URL or “format/update this issue” → **Mode A**
- Slack archive URL or “create an issue / card from this thread” → **Mode B**
- Both (“create from Slack then ping FE”) → Mode B, then ask separately for A5-style channel ping if needed
