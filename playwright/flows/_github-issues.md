# Playwright → GitHub Issue Reporter

Create GitHub issues for failing Playwright tests directly from your AI assistant (Cline, Claude, etc.), using the **GitHub MCP server** — no scripts, no tokens in code.

---

## How It Works

```
1. Run Playwright tests locally
         │
         ▼
   playwright/playwright-report/results.json  (produced automatically)
         │
         ▼  (if failures exist)
   Tell the AI: "Create GitHub issues for the failing tests"
         │
         ▼
   The AI reads results.json, shows failures,
   checks for duplicate open issues (search_issues),
   asks you to select a priority (P0–P4),
   creates issues with title: [Px] [Playwright] <testTitle>,
   then asks if you want to check the network trace for API failures
```

---

## One-Time Setup: Add Your GitHub Token

The GitHub MCP server is already configured in your workspace. You just need to add your token.

**Step 1 — Get a Personal Access Token:**

- Go to: https://github.com/settings/tokens
- **Classic token:** select the `repo` scope
- **Fine-grained token:** grant `Issues: Read & Write` on `deriv-com/derivatives-trader`

**Step 2 — Add it to the MCP settings file:**

Open this file:

```
~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

Find the `"github"` entry and replace `YOUR_GITHUB_TOKEN_HERE`:

```json
"github": {
  "disabled": false,
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_real_token_here"
  }
}
```

**Step 3 — Restart VS Code** so the new token is picked up by the MCP server.

---

## Usage

### Run tests

```bash
npx playwright test
```

### Create issues for failures

After tests finish (with failures), tell the AI any of these:

| What you say | What the AI does |
| --- | --- |
| _"Create GitHub issues for the failing tests"_ | Shows all failures, asks which to file |
| _"Create issues for all failing tests"_ | Creates issues for every failure immediately |
| _"Create a GitHub issue for test failure #2"_ | Creates an issue for that specific failure |
| _"Create issues for test failures 1 and 3"_ | Creates issues for the selected failures |

The AI will:

1. Read `playwright/playwright-report/results.json`
2. List all failing tests with their error messages, tags, and project
3. **Group failures by test title** — if the same test failed on multiple projects (e.g. `chromium` + `chromium-mobile`), it creates **1 issue** covering both, not one per project
4. Check for existing open issues to avoid duplicates
5. **Ask you to select a priority (P0–P4)** before creating the issue
6. Create the issue with the title: `[Px] [Playwright] <testTitle>`
7. **After creating each issue** — ask you whether you want to check the network trace for API failures (HTTP 4xx/5xx). Only if you say **Yes** will it analyse the trace and potentially add a follow-up comment

---

## Priority Levels

Before creating each issue, the AI will ask you to select a priority:

| Priority | When to use |
| --- | --- |
| **P0** — Critical | Login broken, trade form inaccessible, site down |
| **P1** — High | Core trading journey broken, no workaround |
| **P2** — Medium | Specific feature broken, alternatives exist |
| **P3** — Low | Cosmetic / visual glitch, non-blocking |
| **P4** — Enhancement | Nice-to-have, not a bug |

The priority is baked into the issue title at creation time:

```
[P1] [Playwright] VERIFY trade form loads on desktop
[P2] [Playwright] VERIFY stake input accepts decimal values
```

No project name in the title — project details are in the issue body.

---

## API Request Failure Comment

After creating each issue, the AI will **ask you first**:

```
Would you like me to check the network trace for API failures (HTTP 4xx/5xx) that may have caused this test failure?

[Yes] / [No]
```

- **If you say No** → the AI moves on immediately. No trace analysis, no extra comment.
- **If you say Yes** → the AI looks for `trace.zip` in the test results folder, extracts the Playwright network trace, and scans for failed API calls (HTTP status ≥ 400). If any are found, it adds a follow-up comment to the issue with full details. If all requests returned 2xx, it informs you that no API failures were detected.

**This comment is only added when an API failure is detected and you've opted in.** If all requests returned 2xx, no comment is added.

Example comment structure:

````markdown
## 🌐 API Request Failure

The root cause of this test failure is a **400 Bad Request** from the Deriv WebSocket API.

---

### Request

| Field | Value |
| --- | --- |
| **Method** | `WebSocket` |
| **URL** | `wss://api.deriv.com/websockets/v3` |
| **Timestamp** | `2026-06-11T05:48:02.776Z` |
| **Duration** | `3977ms` |

**Request Body:**

```json
{
  "buy": 1,
  "price": 10,
  "parameters": { ... }
}
```
````

---

### Response

| Field | Value |
| --- | --- |
| **Status** | `400 Bad Request` |

**Response Body:**

```json
{ "error": { "code": "ContractBuyValidationError", "message": "..." } }
```

````

**How it works under the hood:**
1. The AI finds the test result folder: `playwright/test-results/<test-name>-<project>/`
2. Extracts `trace.zip` → parses `0-trace.network` / `1-trace.network`
3. Scans all requests for `response.status >= 400`
4. Reads request/response bodies from SHA-referenced files inside the zip
5. Calls `add_issue_comment` on the created issue with the formatted details

---

## Issue Body Template

Issues are created with this structure:

```markdown
## 🐛 Bug Report — Playwright Test Failure

### Test Details

| Field | Value |
| --- | --- |
| **Test** | `VERIFY trade form loads on desktop` |
| **Suite** | `Trade Form — Desktop` |
| **File** | `playwright/tests/trade/verify-trade-form-desktop.spec.ts` |
| **Branch** | `feat/trade-form-tests` |
| **Project** | `chromium` |
| **Duration** | `12345ms` |
| **Retries** | `0` |
| **Status** | ❌ Failed |

---

### ❌ Error Message

````

Error: Trade container should be visible

```

---

### 📍 Stack Trace

```

at TradePage.gotoTradePage (playwright/pages/TradePage.ts:42:5)
...

````

**Failing code in `TradePage.ts:42`:**

```typescript
40 |
41 |     async gotoTradePage() {
> 42 |         await expect(this.tradeContainer).toBeVisible();
     |                                           ^
````

---

### 🔍 Root Cause Analysis

The locator `tradeContainer` could not find an element with `data-testid="dt_trade_container"`.

**Possible causes:**

- The element was not rendered or took too long to appear
- A selector or test ID changed in the UI
- WebSocket API did not settle before the assertion ran

---

### 🔁 Steps to Reproduce

1. Log in with a test account on staging
2. Navigate to `https://staging-dtrader.deriv.com/`
3. Wait for the trade form to load
4. Observe that `dt_trade_container` is not visible

---

### 🧪 Reproduce with Playwright

```bash
npx playwright test playwright/tests/trade/verify-trade-form-desktop.spec.ts --project=chromium
```

---

### 📅 Run Date

`2026-06-11` _(Asia/Kuala_Lumpur, UTC+8)_

```

---

## What's in `results.json`?

The file is at `playwright/playwright-report/results.json`. Key fields the AI uses:

| Field | JSON path |
| --- | --- |
| Test title | `suites[].suites[].specs[].title` |
| Tags | `suites[].suites[].specs[].tags` |
| Project | `suites[].suites[].specs[].tests[].projectName` |
| Status | `suites[].suites[].specs[].tests[].results[].status` |
| Error message | `suites[].suites[].specs[].tests[].results[].errors[0].message` |
| Stack trace | `suites[].suites[].specs[].tests[].results[].errors[0].stack` |
| Duration | `suites[].suites[].specs[].tests[].results[].duration` |
| Retries | `suites[].suites[].specs[].tests[].results[].retry` |
| Run date | `suites[].suites[].specs[].tests[].results[].startTime` |

> **Note:** `errors` is an **array** — use `errors[0].message` and `errors[0].stack`, not `error.message`.

---

## Troubleshooting

| Problem | Solution |
| --- | --- |
| GitHub MCP is not connected | Add your token to `cline_mcp_settings.json` and restart VS Code |
| Issues created with wrong repo | Tell the AI explicitly: *"create issues in deriv-com/derivatives-trader"* |
| Labels don't exist on the repo | Create the labels (`bug`, `playwright`, `automated`) on GitHub first, or ask the AI to use `bug` only |
| `results.json` not found | Run tests first: `npx playwright test` |
| Duplicate issue not detected | The dedup search uses the test title — make sure the existing issue has `[Playwright]` in its title |
| No API failure comment added | Either no `trace.zip` was found, or all API calls returned 2xx — this is expected behaviour |
| Response body missing from trace | The trace may not have captured the body — the comment will note `"Response body not captured in trace"` |
```
