#!/usr/bin/env node

/**
 * knip-check — diff wrapper around `knip --reporter json` (Workstream C0 safety net).
 *
 * knip 5.x has no native "fail only on findings new versus a committed baseline" mode, so this
 * script provides it: it runs knip, normalises the findings into a stable, repo-relative,
 * deterministically-sorted set, and set-diffs that against `docs/baselines/knip-baseline.json`.
 *
 *   default  : exit non-zero when the current findings differ from the baseline in EITHER direction
 *              — a NEW finding (this change orphaned code) or a baseline entry knip no longer
 *              reports (this change cleaned code up and the shrink needs banking). The baseline
 *              file is never modified.
 *   --update : write the normalised findings to the baseline and exit 0 (deliberate regeneration).
 *
 * The baseline is a "known-unused" set that Workstream C shrinks deliberately per deletion PR, not
 * an assertion of correctness — see docs/baselines/README.md.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'docs', 'baselines', 'knip-baseline.json');

// The typed issue arrays knip emits per file, each element carrying a `name`.
const NAMED_ISSUE_TYPES = [
    'dependencies',
    'devDependencies',
    'optionalPeerDependencies',
    'unlisted',
    'binaries',
    'unresolved',
    'exports',
    'nsExports',
    'types',
    'nsTypes',
    'classMembers',
];

/**
 * Strip an absolute repo-root prefix so findings are stable across checkouts/machines.
 */
function toRepoRelative(value, rootDir) {
    if (typeof value !== 'string') return String(value);
    const withSlash = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
    return value
        .split(withSlash)
        .join('')
        .split(rootDir + '/')
        .join('');
}

/**
 * Flatten knip's `{ files, issues }` JSON into a deterministically-sorted, de-duplicated array of
 * canonical finding strings. No timestamps, no absolute paths — so two runs on the same tree
 * produce byte-identical output.
 */
function normalizeFindings(knipJson, rootDir = ROOT) {
    const findings = new Set();

    for (const file of knipJson.files || []) {
        findings.add(`file ${toRepoRelative(file, rootDir)}`);
    }

    for (const record of knipJson.issues || []) {
        const file = toRepoRelative(record.file, rootDir);

        for (const type of NAMED_ISSUE_TYPES) {
            for (const entry of record[type] || []) {
                findings.add(`${type} ${file} ${toRepoRelative(entry.name, rootDir)}`);
            }
        }

        // duplicates: array of groups, each group an array of { name }.
        for (const group of record.duplicates || []) {
            const names = (Array.isArray(group) ? group : [group])
                .map(member => toRepoRelative(member.name, rootDir))
                .sort();
            findings.add(`duplicates ${file} ${names.join('|')}`);
        }

        // enumMembers: object keyed by enum name, each an array of { name }.
        if (record.enumMembers && typeof record.enumMembers === 'object') {
            for (const [enumName, members] of Object.entries(record.enumMembers)) {
                for (const member of members || []) {
                    findings.add(`enumMembers ${file} ${enumName}.${toRepoRelative(member.name, rootDir)}`);
                }
            }
        }
    }

    return [...findings].sort();
}

/**
 * Findings present now but absent from the baseline set. These are what a check fails on.
 */
function newFindings(current, baseline) {
    const known = new Set(baseline);
    return current.filter(finding => !known.has(finding));
}

/**
 * Baseline entries that knip no longer reports. A shrinking baseline is the whole point of
 * Workstream C, so this is never a bug — but leaving the shrink unbanked means the committed
 * allowlist permits more than it needs to, and the next PR inherits a weaker gate. It BLOCKS so the
 * shrink is banked with `npm run knip:baseline` in the PR that earned it, making that committed diff
 * the record of what the change cleaned up.
 */
function staleFindings(current, baseline) {
    const present = new Set(current);
    return baseline.filter(finding => !present.has(finding));
}

function serializeBaseline(findings) {
    return JSON.stringify({ findings }, null, 4) + '\n';
}

function readBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    return Array.isArray(parsed.findings) ? parsed.findings : [];
}

/**
 * Turn a spawnSync result into knip's parsed JSON, or throw with knip's real error.
 *
 * knip exits non-zero whenever it has findings (expected — parse stdout regardless), but on a
 * config/loader failure it exits 2 and writes a plain-text hint to stdout instead of JSON. Blindly
 * parsing that yields a cryptic `Unexpected token` crash, so detect it and surface knip's stderr.
 */
function parseKnipResult(result) {
    if (result.error) {
        throw result.error;
    }
    const stdout = result.stdout || '';
    if (!stdout.trim() || !stdout.trimStart().startsWith('{')) {
        throw new Error(
            `knip failed to produce JSON output (exit ${result.status}).\n` +
                `${(result.stderr || '').trim()}\n${stdout.trim()}`.trim()
        );
    }
    return JSON.parse(stdout);
}

const KNIP_MISSING = 'knip is not installed in this workspace — run npm run bootstrap';

/**
 * Resolve the workspace-installed knip binary, so check and regeneration can never run a different
 * major than the one the lockfile pins (a bare `npx knip` would fetch `latest` instead).
 */
function resolveKnipBin(resolveModule = require.resolve) {
    let entry;
    try {
        entry = resolveModule('knip');
    } catch {
        throw new Error(KNIP_MISSING);
    }

    // knip's `exports` map hides package.json, so walk up from the resolved entry to read `bin`.
    let dir = path.dirname(entry);
    for (;;) {
        const manifestPath = path.join(dir, 'package.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (manifest.name === 'knip') {
                const bin = typeof manifest.bin === 'string' ? manifest.bin : (manifest.bin || {}).knip;
                if (!bin) throw new Error(KNIP_MISSING);
                return path.join(dir, bin);
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) throw new Error(KNIP_MISSING);
        dir = parent;
    }
}

function runKnip() {
    const result = spawnSync(process.execPath, [resolveKnipBin(), '--reporter', 'json'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    return parseKnipResult(result);
}

function main() {
    const isUpdate = process.argv.includes('--update');
    const knipJson = runKnip();
    const findings = normalizeFindings(knipJson);

    if (isUpdate) {
        fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
        fs.writeFileSync(BASELINE_PATH, serializeBaseline(findings));
        // eslint-disable-next-line no-console
        console.log(`knip baseline updated: ${findings.length} findings written to docs/baselines/knip-baseline.json`);
        return 0;
    }

    const baseline = readBaseline();
    if (baseline === null) {
        // eslint-disable-next-line no-console
        console.error('No knip baseline found. Run `npm run knip:baseline` to create it.');
        return 1;
    }

    const added = newFindings(findings, baseline);
    const stale = staleFindings(findings, baseline);

    if (added.length === 0 && stale.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`knip:check passed — ${findings.length} findings, exactly matching the committed baseline.`);
        return 0;
    }

    if (added.length === 0) {
        // Only shrinkage: not a bug, but it must be banked in this PR.
        // eslint-disable-next-line no-console
        console.error(
            `knip:check failed — ${stale.length} of the ${baseline.length} baseline entries are no longer` +
                ' reported by knip:'
        );
        // eslint-disable-next-line no-console
        stale.forEach(finding => console.error(`  - ${finding}`));
        // eslint-disable-next-line no-console
        console.error(
            '\nThis is the GOOD direction — this change cleaned up code the baseline still allowed for.' +
                '\nBank it: run `npm run knip:baseline` and commit the smaller' +
                '\ndocs/baselines/knip-baseline.json in this PR, so the gate tightens with the cleanup' +
                '\ninstead of silently permitting more than it needs to.'
        );
        return 1;
    }

    // eslint-disable-next-line no-console
    console.error(`knip:check failed — ${added.length} finding(s) NOT in docs/baselines/knip-baseline.json:`);
    // eslint-disable-next-line no-console
    added.forEach(finding => console.error(`  + ${finding}`));
    // eslint-disable-next-line no-console
    console.error(
        '\nA NEW finding usually means this change ORPHANED code (you deleted/changed its last consumer).' +
            '\nPreferred fix: delete the newly-orphaned code too (or revert if unintended).' +
            '\nOnly if keeping it is deliberate (e.g. an intentional new public API): run `npm run knip:baseline`' +
            '\nand commit the regenerated docs/baselines/knip-baseline.json in this PR. Never update as a reflex.' +
            (stale.length
                ? `\n\nAlso: ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} no longer` +
                  ' reported — the regeneration banks that shrink too.'
                : '')
    );
    return 1;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    normalizeFindings,
    newFindings,
    staleFindings,
    serializeBaseline,
    toRepoRelative,
    parseKnipResult,
    resolveKnipBin,
    BASELINE_PATH,
};
