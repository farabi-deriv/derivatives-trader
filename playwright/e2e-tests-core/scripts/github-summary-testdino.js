#!/usr/bin/env node
/**
 * Publish a TestDino test-run summary to $GITHUB_STEP_SUMMARY.
 *
 * Required env vars:
 *   TESTDINO_ACCESS_TOKEN  Read-only Project PAT (`tdp_…`, scope: public-api). Secret.
 *   TESTDINO_PROJECT_ID    e.g. project_xxxxxxxxxxxx. Repo variable.
 *   TESTDINO_ORG_ID        e.g. org_xxxxxxxxxxxx. Repo variable.
 *   GITHUB_RUN_ID          Actions run ID (set automatically by GitHub Actions).
 *
 * Optional env vars:
 *   PLATFORM               Matrix platform (e.g. "chromium"). Disambiguates when
 *                          desktop/mobile jobs share one GITHUB_RUN_ID.
 *   GITHUB_STEP_SUMMARY    Path to the summary file. If unset, output goes to stdout.
 *
 * Behaviour:
 *   - Fetches the 50 most recent TestDino runs and matches on pipeline.id === GITHUB_RUN_ID,
 *     then selects the run tagged/platformed for PLATFORM when that env is set.
 *   - When PLATFORM is set, never falls back to another platform's run — if no tagged
 *     match exists the summary reports unavailable instead of cross-wiring stats.
 *   - Fetches failed test titles via GET /debug-bundle?runId={id} (paginated).
 *     (The retired GET /context endpoint now returns 404.)
 *   - Always writes the "View TestDino Report" link.
 *   - Renders a stats table and a Failed Tests table when failures exist.
 *   - On any API/auth/network failure exits 0 with a fallback note —
 *     it must never fail the calling workflow job.
 *
 * Requires: Node 18+ (built-in `fetch`).
 */

const fs = require('node:fs');

const { TESTDINO_ACCESS_TOKEN, TESTDINO_PROJECT_ID, TESTDINO_ORG_ID, GITHUB_RUN_ID, PLATFORM, GITHUB_STEP_SUMMARY } =
    process.env;

const PROJECT_RE = /^project_[a-zA-Z0-9_-]+$/;
const ORG_RE = /^org_[a-zA-Z0-9_-]+$/;

const fallbackUrl =
    ORG_RE.test(TESTDINO_ORG_ID ?? '') && PROJECT_RE.test(TESTDINO_PROJECT_ID ?? '')
        ? `https://app.testdino.com/${TESTDINO_ORG_ID}/projects/${TESTDINO_PROJECT_ID}/test-runs`
        : 'https://app.testdino.com';

const lines = [];
const write = line => lines.push(line);
const flush = () => {
    const out = lines.join('\n') + '\n';
    if (GITHUB_STEP_SUMMARY) fs.appendFileSync(GITHUB_STEP_SUMMARY, out);
    else process.stdout.write(out);
};

const formatDuration = ms => {
    const total = Number(ms) / 1000;
    if (!Number.isFinite(total) || total <= 0) return '0s';
    const m = Math.floor(total / 60);
    const s = total - m * 60;
    return m > 0 ? `${m}m ${Math.round(s)}s` : `${s.toFixed(1)}s`;
};

const sanitizeMd = text =>
    String(text ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/[|\[\]()`]/g, '\\$&');

async function apiFetch(path, timeoutMs = 10_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`https://api.testdino.com/api/v1/public/${TESTDINO_PROJECT_ID}${path}`, {
            headers: { Authorization: `Bearer ${TESTDINO_ACCESS_TOKEN}` },
            signal: controller.signal,
        });
        const body = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, body };
    } catch (err) {
        return { ok: false, status: 0, body: null, err };
    } finally {
        clearTimeout(timer);
    }
}

/** Extract display fields from a debug-bundle run-scope item. */
function titleAndSpecFromItem(item) {
    const testObj = item?.test ?? {};
    const specObj = typeof item?.spec === 'object' && item.spec ? item.spec : {};
    const titlePath = Array.isArray(item?.title_path)
        ? item.title_path
        : Array.isArray(testObj?.title_path)
          ? testObj.title_path
          : Array.isArray(testObj?.titlePath)
            ? testObj.titlePath
            : Array.isArray(item?.title)
              ? item.title
              : [];
    const testName = titlePath.length
        ? titlePath[titlePath.length - 1]
        : (item?.title ?? testObj?.title ?? 'Unknown test');
    // Prefer explicit path fields; fall back to title_path (TestDino puts the relative
    // spec there, e.g. "trade-automate/foo.spec.ts"). Do not park '' in a ?? chain —
    // empty string is not nullish, so it used to swallow the title_path fallbacks and
    // leave the Spec column blank in the GH summary.
    const fromFields =
        item?.file_path ||
        specObj?.filePath ||
        specObj?.path ||
        (typeof item?.spec === 'string' ? item.spec : '') ||
        '';
    const fromTitlePath = titlePath.find(part => /\.(spec|test)\.[jt]sx?$/.test(String(part))) || titlePath[2] || '';
    const spec = fromFields || fromTitlePath || '';
    const caseId = item?.caseId ?? testObj?.caseId ?? item?.pw_test_id ?? testObj?.pw_test_id ?? item?.id ?? null;
    return { testName, spec, caseId };
}

/** Fetch one page of run-scope debug bundle (limit max 50 per TestDino API). */
async function fetchDebugBundlePage(runId, page) {
    const path = `/debug-bundle?runId=${encodeURIComponent(runId)}&page=${page}&limit=50`;
    const result = await apiFetch(path);
    if (!result.ok || result.body?.success === false) return null;
    const data = result.body?.data;
    if (!data || data.scope !== 'run') return null;
    const items = Array.isArray(data.items) ? data.items : [];
    const total = Number(data.total) || items.length;
    const hasNext = Boolean(data.nextPage) || page * 50 < total;
    return { items, hasNext, total };
}

/** Fetch failed test cases from /debug-bundle (paginated). */
async function fetchRunFailedTests(runId) {
    const failedTests = [];
    let page = 1;
    let hasNext = true;
    let apiTruncated = false;

    while (hasNext && page <= 20) {
        const pageResult = await fetchDebugBundlePage(runId, page);
        if (!pageResult) break;
        for (const item of pageResult.items) {
            const status = item?.status ?? item?.test?.status;
            if (status && status !== 'failed') continue;
            failedTests.push(item);
        }
        hasNext = pageResult.hasNext;
        if (hasNext && page >= 20) apiTruncated = true;
        page += 1;
    }

    return { failedTests, apiTruncated };
}

const main = async () => {
    if (!TESTDINO_ACCESS_TOKEN || !TESTDINO_PROJECT_ID) {
        write(`### 🚀 [View TestDino Report](${fallbackUrl})`);
        write('');
        write('_TestDino summary unavailable (missing token or project ID)._');
        return;
    }

    if (!PROJECT_RE.test(TESTDINO_PROJECT_ID)) {
        write(`### 🚀 [View TestDino Report](${fallbackUrl})`);
        write('');
        write('_TestDino summary unavailable (invalid project ID format)._');
        return;
    }

    if (!GITHUB_RUN_ID) {
        write(`### 🚀 [View TestDino Report](${fallbackUrl})`);
        write('');
        write('_TestDino summary unavailable (GITHUB_RUN_ID not set)._');
        return;
    }

    // Fetch the 50 most recent runs and match on metadata.pipeline.id === GITHUB_RUN_ID.
    // The API has no pipeline_id filter, so we fetch and match client-side.
    const listResult = await apiFetch(`/test-runs?limit=50`);

    if (!listResult.ok) {
        const code = listResult.status ?? '000';
        const msg = listResult.err
            ? listResult.err.name === 'AbortError'
                ? 'request timed out'
                : sanitizeMd(listResult.err.message)
            : sanitizeMd(listResult.body?.message ?? listResult.body?.error ?? 'unknown error');
        write(`### 🚀 [View TestDino Report](${fallbackUrl})`);
        write('');
        write(`_Could not fetch TestDino run details from API (HTTP ${code}: ${msg})._`);
        return;
    }

    // Response shape: { items: [...], pagination: { ... } }
    const runs = listResult.body?.items ?? [];
    // Desktop and mobile share one github.run_id — when PLATFORM is set, require a run tagged
    // for THIS platform. Never fall back to another platform's stats (that cross-wires the
    // GH summary so Chromium desktop looks like chromium-mobile).
    const platform = (PLATFORM ?? '').toLowerCase();
    const pipelineMatches = Array.isArray(runs)
        ? runs.filter(r => r.ci?.pipeline?.id === GITHUB_RUN_ID || r.metadata?.pipeline?.id === GITHUB_RUN_ID)
        : [];
    if (pipelineMatches.length === 0) {
        write(`### 🚀 [View TestDino Report](${fallbackUrl})`);
        write('');
        write('_TestDino summary unavailable — no run matched this Actions run ID._');
        return;
    }

    // The list API returns stripped objects — platforms/tags are often null. When PLATFORM is
    // set, fetch full detail for every pipeline match so we can match tags[] / platforms[].
    // (pipelineMatches is non-empty here — the length===0 guard returned above.)
    let detailedRuns = pipelineMatches;
    if (platform) {
        const details = await Promise.all(
            pipelineMatches.map(async r => {
                const res = await apiFetch(`/test-runs/${encodeURIComponent(r.id)}`);
                return res.ok && res.body ? res.body : r;
            })
        );
        detailedRuns = details;
    }

    // Match tags[] first (TESTDINO_TAG = matrix.platform), then platforms[]. When PLATFORM is
    // set, require an explicit match even if there is only one pipeline candidate — a lone
    // match can still be the *other* platform (e.g. desktop job, only chromium-mobile streamed).
    // Prefer "unavailable" over cross-wiring stats.
    const matchesPlatform = r =>
        (r.tags ?? []).some(t => String(t).toLowerCase() === platform) ||
        (r.platforms ?? []).some(p => String(p).toLowerCase() === platform);
    const run = platform ? detailedRuns.find(matchesPlatform) || null : detailedRuns[0] || null;

    if (!run?.id) {
        write(`### 🚀 [View TestDino Report](${fallbackUrl})`);
        write('');
        write(
            platform
                ? `_TestDino summary unavailable — no run matched platform \`${sanitizeMd(platform)}\` for this Actions run ID._`
                : '_TestDino summary unavailable — no run matched this Actions run ID._'
        );
        return;
    }

    const runUrl = ORG_RE.test(TESTDINO_ORG_ID ?? '')
        ? `https://app.testdino.com/${TESTDINO_ORG_ID}/projects/${TESTDINO_PROJECT_ID}/test-runs/${run.id}`
        : fallbackUrl;

    write(`### 🚀 [View TestDino Report](${runUrl})`);
    write('');

    // Stats are nested under run.result; duration is run.duration_ms
    const r = run.result ?? {};
    const total = r.total ?? 0;
    const passed = r.passed ?? 0;
    const failed = r.failed ?? 0;
    const flaky = r.flaky ?? 0;
    const skipped = r.skipped ?? 0;
    const timedOut = r.interrupted ?? 0;
    const duration = formatDuration(run.duration_ms ?? 0);

    write('#### Test Results Summary');
    write('');
    write('| Total 🧪 | Passed ✅ | Failed ❌ | Flaky 🌀 | Skipped ⏭️ | Timed out ⏱️ | Duration ⏳ |');
    write('|---|---|---|---|---|---|---|');
    write(`| ${total} | ${passed} | ${failed} | ${flaky} | ${skipped} | ${timedOut} | ${duration} |`);

    if (failed > 0) {
        const { failedTests, apiTruncated } = await fetchRunFailedTests(run.id);

        if (failedTests.length > 0) {
            const MAX_ROWS = 100;
            const displayed = failedTests.slice(0, MAX_ROWS);
            write('');
            write('#### Failed Tests ❌');
            write('');
            write('| # | Test | Spec |');
            write('|---|---|---|');
            displayed.forEach((item, i) => {
                const { testName, spec, caseId } = titleAndSpecFromItem(item);
                const safeName = sanitizeMd(testName);
                const safeSpec = sanitizeMd(spec);
                const cell = caseId ? `[${safeName}](${runUrl}/${encodeURIComponent(caseId)})` : safeName;
                write(`| ${i + 1} | ${cell} | ${safeSpec} |`);
            });
            if (failedTests.length > MAX_ROWS) {
                write(`| … | _${failedTests.length - MAX_ROWS} more — [see full report](${runUrl})_ | |`);
            }
            if (apiTruncated) {
                write('');
                write(`> ⚠️ Failed-test list truncated at 100 rows — [see full report](${runUrl}).`);
            }
        } else {
            write('');
            write(`_Failed test titles unavailable — see [TestDino report](${runUrl}) for details._`);
        }
    }
};

main()
    .catch(err => {
        write(`_TestDino summary failed: ${sanitizeMd(err?.message ?? String(err))}_`);
    })
    .finally(flush);
