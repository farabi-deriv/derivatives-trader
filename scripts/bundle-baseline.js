#!/usr/bin/env node

/**
 * bundle-baseline — derive a committed bundle-size baseline (Workstream C0 safety net).
 *
 * `npm run analyze:bundle` emits a gitignored `bundle-stats.json` per package. This script reads
 * those four stats files and writes a small, committed derived JSON at
 * `docs/baselines/bundle-baseline.json` recording, per package, total JS size, total CSS size
 * (including the core CSS bundle), asset/chunk counts and the largest assets, plus a project total.
 *
 * The bundle baseline is the INFORMATIONAL byte-count comparison point — `baseline:check` reports
 * size deltas but never fails on them (see docs/baselines/README.md). If a stats file is absent the
 * script reports it and exits non-zero rather than fabricating sizes for that package.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'docs', 'baselines', 'bundle-baseline.json');

const PACKAGES = [
    { key: 'core', path: 'packages/core' },
    { key: 'trader', path: 'packages/trader' },
    { key: 'reports', path: 'packages/reports' },
    { key: 'components', path: 'packages/components' },
];

/**
 * Aggregate one webpack stats object into the per-package baseline shape.
 */
function summarizeStats(stats) {
    // Source maps (`.js.map`) and Terser license banners (`.LICENSE.txt`) are build artefacts, not
    // code shipped to users — and maps are routinely larger than the bundle they describe. Drop them
    // before summarising so asset_count and largest_assets reflect the real shipped surface.
    const assets = (stats.assets || [])
        .filter(asset => !asset.name.endsWith('.map') && !asset.name.endsWith('.LICENSE.txt'))
        .map(asset => ({ name: asset.name, size: asset.size }));

    const jsAssets = assets.filter(asset => asset.name.endsWith('.js'));
    const cssAssets = assets.filter(asset => asset.name.endsWith('.css'));

    const jsTotal = jsAssets.reduce((sum, asset) => sum + asset.size, 0);
    const cssTotal = cssAssets.reduce((sum, asset) => sum + asset.size, 0);

    const largestAssets = [...assets]
        // Sort by size desc, then name asc for a deterministic tie-break.
        .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name))
        .slice(0, 5);

    return {
        js_total: jsTotal,
        css_total: cssTotal,
        asset_count: assets.length,
        chunk_count: jsAssets.length,
        largest_assets: largestAssets,
    };
}

/**
 * Build the full baseline from a map of package key -> parsed stats object (or null when absent).
 * Returns { baseline, missing[] }; a non-empty `missing` means the caller must not write a baseline.
 */
function buildBundleBaseline(statsByPackage) {
    const packages = {};
    const missing = [];
    const total = { js_total: 0, css_total: 0, asset_count: 0, chunk_count: 0 };

    for (const { key } of PACKAGES) {
        const stats = statsByPackage[key];
        if (!stats) {
            missing.push(key);
        } else {
            const summary = summarizeStats(stats);
            packages[key] = summary;
            total.js_total += summary.js_total;
            total.css_total += summary.css_total;
            total.asset_count += summary.asset_count;
            total.chunk_count += summary.chunk_count;
        }
    }

    return { baseline: { packages, total }, missing };
}

function serializeBaseline(baseline) {
    return JSON.stringify(baseline, null, 4) + '\n';
}

function readStats() {
    const statsByPackage = {};
    for (const pkg of PACKAGES) {
        const statsPath = path.join(ROOT, pkg.path, 'bundle-stats.json');
        statsByPackage[pkg.key] = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, 'utf8')) : null;
    }
    return statsByPackage;
}

function main() {
    const { baseline, missing } = buildBundleBaseline(readStats());

    if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`Missing bundle-stats.json for: ${missing.join(', ')}.`);
        // eslint-disable-next-line no-console
        console.error('Run `npm run analyze:bundle` first — sizes are not fabricated for missing packages.');
        return 1;
    }

    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, serializeBaseline(baseline));
    // eslint-disable-next-line no-console
    console.log(
        `bundle baseline written to docs/baselines/bundle-baseline.json (project JS ${baseline.total.js_total} B, CSS ${baseline.total.css_total} B).`
    );
    return 0;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = { summarizeStats, buildBundleBaseline, serializeBaseline, PACKAGES, BASELINE_PATH };
