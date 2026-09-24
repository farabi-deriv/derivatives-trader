---
name: qa-pr-review
description: Sends a PR review request message to the QA Slack channel (C07VARCCFRB). Use when asked to "send PR review", "request PR review", or similar.
argument-hint: '[pr=<url>] [summary=<text>]'
---

# PR Review Slack Notifier

This skill sends a formatted PR review request to the QA Slack channel using the **Slack MCP server**.

## How to Invoke

Type any of the following in the Claude Code prompt:

```
/pr-review
```

```
/pr-review pr=https://github.com/<org>/<repo>/pull/404
```

Both fields are optional — if omitted, the PR (and its title) are auto-detected from the current git branch.

---

## When to Use This Skill

**Use this skill when:**

- Asked to "send PR review message"
- Asked to "request a PR review on Slack"
- Asked to "notify the team about a PR"

---

## IMPORTANT — How to ask questions

Ask each missing field as a **plain text message** and wait for the user's reply before asking the next. Do not use `AskUserQuestion` — these are free-text inputs that don't suit a multiple-choice widget.

---

## Step-by-Step

1. **Collect details from the user** — ask for each missing field **one at a time** as a plain text message, waiting for the user's reply before asking the next:

    | #   | Field     | Question to ask                              | Default                          |
    | --- | --------- | -------------------------------------------- | -------------------------------- |
    | 1   | `pr`      | "What is the GitHub PR URL?"                 | _(auto)_                         |
    | 2   | `summary` | "What does this PR do? (brief summary)"      | PR title (fetched automatically) |
    | 3   | `notes`   | "Any additional notes? (or type NA to skip)" | _(required)_                     |

    Skip asking for a field if it was already provided as an argument.

2. **Resolve the PR** — if no `pr` was provided, detect it from the current git branch:

    ```bash
    gh pr view --json url,title -q '{url: .url, title: .title}'
    ```

    This returns the open PR for the current branch, along with its title. Ask the user only if no open PR exists for the branch.

3. **Resolve the summary** — if no `summary` was provided, use the PR title from the previous step (or from the given `pr` URL via `gh pr view <number> --json title -q .title`). Ask the user only if the title can't be fetched.

4. **Send the main message** — call `slack_send_message` with:
    - `channel_id`: `C07VARCCFRB`
    - `message`: filled-in template below
    - Store the returned `ts` (timestamp) as `{message_ts}`

5. **Send thread reply (if notes provided)** — if `notes` is not `NA`, call `slack_send_message` with:
    - `channel_id`: `C07VARCCFRB`
    - `thread_ts`: `{message_ts}`
    - `message`: `{notes}`

6. **Return the message link** to the user.

---

## Message Template

:wave: <!subteam^S0AP2400XLZ> could you please help to merge this PR?

Summary:

```
{summary}
```

• PR: {pr}

---

## Channel & Mentions

| Setting              | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Channel ID**       | `C07VARCCFRB`                                   |
| **Reviewer subteam** | `<!subteam^S0AP2400XLZ>` (playwright_reviewers) |
