#!/usr/bin/env node

/**
 * baseline-check — structural drift detector for Workstream C cleanup / M1 package merge.
 *
 * Regenerates three structural snapshots and diffs them against the committed baselines:
 *
 *   - route-map.json    : the set of route `path` values declared in the three route-config files.
 *   - chunk-names.json  : the set of emitted logical chunk names per package (contenthash and
 *                         volatile chunk-id suffixes stripped), read from each package's dist/.
 *   - alias-usage.json  : the alias-root set per package (from build/constants.js ALIASES) plus the
 *                         count of source files importing through those roots.
 *
 * Gating (CSN-005 / design D6): the process exits non-zero when the committed baselines no longer
 * match this tree — a structural SET change (route path, emitted chunk name, alias root), an alias
 * usage COUNT change, or any byte-level difference in a tree-derived snapshot. All of these are
 * fixed the same way: `npm run baseline:update` and commit the regenerated file, so that committed
 * diff records what the change removed.
 *
 * Bundle byte counts are the one exception and stay INFORMATIONAL: they require a full
 * `analyze:bundle` run and vary with the build environment, so gating them would flake. The
 * ">5% growth → escalate" judgement on those is left to the reader.
 *
 *   default  : regenerate + diff; exit 1 on structural set drift.
 *   --update : write the three snapshots (deliberate regeneration) and exit 0.
 *
 * The chunk snapshot needs a prior `build:all` (it reads dist/). Without dist/, the chunk assertion
 * is skipped with a logged notice (structural-only mode); route-map and alias-usage still run.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINES_DIR = path.join(ROOT, 'docs', 'baselines');
const ROUTE_MAP_PATH = path.join(BASELINES_DIR, 'route-map.json');
const CHUNK_NAMES_PATH = path.join(BASELINES_DIR, 'chunk-names.json');
const ALIAS_USAGE_PATH = path.join(BASELINES_DIR, 'alias-usage.json');
const BUNDLE_BASELINE_PATH = path.join(BASELINES_DIR, 'bundle-baseline.json');

const ROUTE_CONFIG_FILES = [
    'packages/core/src/App/Constants/routes-config.js',
    'packages/reports/src/Constants/routes-config.tsx',
    'packages/trader/src/AppV2/Routes/routes.tsx',
];

// Packages whose emitted chunks are snapshotted (they use webpackChunkName + output templates).
const CHUNK_PACKAGES = ['trader', 'reports', 'core'];

// Packages whose alias inventory is snapshotted (their build/constants.js declares source ALIASES).
const ALIAS_PACKAGES = ['trader', 'core', 'reports'];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// ---------------------------------------------------------------------------------------------
// Route map
// ---------------------------------------------------------------------------------------------

/**
 * Extract route `path` values from a route-config file's source. Captures both `routes.<key>`
 * references and quoted string literals (e.g. '/*'), while ignoring type annotations like
 * `path: string;` (D5 — a scoped structural detector, not a router).
 */
function extractRoutePaths(source) {
    const paths = new Set();
    const re = /\bpath:\s*(routes\.\w+|['"][^'"]+['"])/g;
    for (const match of source.matchAll(re)) {
        paths.add(match[1].replace(/['"]/g, ''));
    }
    return [...paths].sort();
}

function buildRouteMap(rootDir = ROOT) {
    const map = {};
    for (const file of ROUTE_CONFIG_FILES) {
        const abs = path.join(rootDir, file);
        map[file] = fs.existsSync(abs) ? extractRoutePaths(fs.readFileSync(abs, 'utf8')) : [];
    }
    return map;
}

// ---------------------------------------------------------------------------------------------
// Chunk names
// ---------------------------------------------------------------------------------------------

/**
 * Reduce an emitted chunk filename to its stable logical name: strip the package prefix, the
 * contenthash, the `.smartcharts` marker, volatile cache-group content (`vendors-*`, `default-*`)
 * and trailing volatile chunk-id/hash suffixes (`-<hex>` / `~<hex>`). Returns '' for names that
 * reduce to nothing.
 */
function toLogicalChunkName(relPath) {
    let base = path
        .basename(relPath)
        .replace(/\.js$/, '')
        .replace(/\.smartcharts$/, '');
    base = base.replace(/^(trader|reports|core)\./, '');
    base = base.replace(/\.[0-9a-f]{16,}$/, ''); // contenthash
    // Cut the auto-generated split-chunk module manifest, keeping the stable cache-group / name
    // prefix (e.g. `vendors-node_modules_...` -> `vendors`, `framework-vendor~node_modules_m` ->
    // `framework-vendor`, `default-src_Modules_...` -> `default`). These manifests encode which
    // modules landed in the chunk and churn as code is deleted, so they are not stable identities.
    base = base.replace(/~.*$/, ''); // everything from the first ~ (webpack chunk-group marker)
    base = base.replace(/-node_modules_.*$/, ''); // node_modules module-path manifest
    base = base.replace(/[-_]src_.*$/, ''); // src module-path manifest (`-src_` or `default-x_src_`)
    base = base.replace(/^default-.*$/, 'default'); // default cache-group + package boundary
    base = base.replace(/[-~][0-9a-f]{6,}$/, ''); // trailing volatile chunk-id / short-hash suffix
    return base;
}

/**
 * A logical chunk name is unstable if it is a bare webpack module-path manifest (an unnamed split
 * chunk) or a numeric chunk id — both renumber/rewrite as code is deleted, so they are excluded
 * from the snapshot. Cache-group names and webpackChunkName-authored names survive.
 */
function isStableChunkName(name) {
    if (!name) return false;
    if (/^\d+$/.test(name)) return false; // numeric chunk id
    if (/node_modules|_src_|-src_/.test(name)) return false; // residual module manifest
    return true;
}

function listFilesRecursive(dir, predicate) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...listFilesRecursive(full, predicate));
        } else if (predicate(full)) {
            results.push(full);
        }
    }
    return results;
}

/**
 * The sorted set of logical chunk names emitted for one package. Purely-numeric chunk ids (webpack's
 * deterministic ids for unnamed split chunks) are excluded — they renumber as code is deleted and
 * are not stable logical identities.
 */
function chunkNamesForPackage(pkg, rootDir = ROOT) {
    const distDir = path.join(rootDir, 'packages', pkg, 'dist');
    const jsFiles = listFilesRecursive(distDir, file => file.endsWith('.js'));
    const names = new Set();
    for (const file of jsFiles) {
        const name = toLogicalChunkName(file);
        if (isStableChunkName(name)) names.add(name);
    }
    return [...names].sort();
}

/**
 * A package counts as "built this run" only once its dist/ actually contains emitted JS — an empty
 * (or webpack-created-then-failed) dist/ directory must read as "not built" (null), not as "built
 * with zero chunks", or a partial local build wipes out another package's committed chunk set.
 */
function distExists(pkg, rootDir = ROOT) {
    const distDir = path.join(rootDir, 'packages', pkg, 'dist');
    return listFilesRecursive(distDir, file => file.endsWith('.js')).length > 0;
}

function anyDistExists(rootDir = ROOT) {
    return CHUNK_PACKAGES.some(pkg => distExists(pkg, rootDir));
}

/**
 * Logical chunk names per package. A package whose dist/ is absent (not rebuilt this run) maps to
 * `null` — meaning "not measured" — rather than an empty set, so a partial local build cannot make
 * the un-rebuilt packages' committed chunks look REMOVED (driftForKeyedSets skips null sides).
 */
function buildChunkNames(rootDir = ROOT) {
    const map = {};
    for (const pkg of CHUNK_PACKAGES) {
        map[pkg] = distExists(pkg, rootDir) ? chunkNamesForPackage(pkg, rootDir) : null;
    }
    return map;
}

// ---------------------------------------------------------------------------------------------
// Alias usage
// ---------------------------------------------------------------------------------------------

/**
 * Alias roots for a package: ALIASES keys whose resolved value points inside the package's own src
 * (this excludes the react/jsx-runtime redirects and core's hoisted node_modules packages).
 */
function aliasRootsForPackage(pkg, rootDir = ROOT) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const constants = require(path.join(rootDir, 'packages', pkg, 'build', 'constants.js'));
    const srcMarker = path.join(rootDir, 'packages', pkg, 'src');
    return Object.entries(constants.ALIASES || {})
        .filter(([, value]) => typeof value === 'string' && value.startsWith(srcMarker))
        .map(([key]) => key)
        .sort();
}

/**
 * Regex matching a module specifier that resolves through one of the given alias roots. Anchored to
 * an actual import form (`from '...'`, `import('...')`, `import '...'`, `require('...')`) so that
 * incidental string literals starting with an alias-root segment (route data, JSX props, fixtures)
 * are not miscounted as imports.
 */
function buildAliasImportRegex(roots) {
    const escaped = roots.map(root => root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp(`\\b(?:from|import|require)\\s*\\(?\\s*['"](?:${escaped})(?:/|['"])`);
}

function countAliasImports(pkg, roots, rootDir = ROOT) {
    if (roots.length === 0) return 0;
    const importRe = buildAliasImportRegex(roots);
    const srcDir = path.join(rootDir, 'packages', pkg, 'src');
    const sourceFiles = listFilesRecursive(srcDir, file => SOURCE_EXTENSIONS.includes(path.extname(file)));
    let count = 0;
    for (const file of sourceFiles) {
        if (importRe.test(fs.readFileSync(file, 'utf8'))) count++;
    }
    return count;
}

function buildAliasUsage(rootDir = ROOT) {
    const roots = {};
    const counts = {};
    for (const pkg of ALIAS_PACKAGES) {
        roots[pkg] = aliasRootsForPackage(pkg, rootDir);
        counts[pkg] = countAliasImports(pkg, roots[pkg], rootDir);
    }
    return { roots, counts };
}

// ---------------------------------------------------------------------------------------------
// Diffing + serialization
// ---------------------------------------------------------------------------------------------

/**
 * Set difference for two arrays: { added, removed } relative to the baseline.
 */
function diffSet(current, baseline) {
    const currentSet = new Set(current);
    const baselineSet = new Set(baseline);
    return {
        added: current.filter(item => !baselineSet.has(item)),
        removed: baseline.filter(item => !currentSet.has(item)),
    };
}

function serialize(obj) {
    return JSON.stringify(obj, null, 4) + '\n';
}

function readJson(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * Compare a current keyed-set map against a committed one; return an array of drift descriptions.
 * A key present in one but not the other, or a set whose members changed, is drift.
 */
function driftForKeyedSets(label, current, baseline) {
    const drift = [];
    if (!baseline) return drift; // no committed snapshot yet — nothing to block on
    const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
    for (const key of [...keys].sort()) {
        // A null current side means "not measured this run" (e.g. a package whose dist/ was not
        // rebuilt). Diffing it as an empty set would spuriously report the whole committed set as
        // REMOVED, so skip the key entirely.
        if (current[key] != null) {
            const { added, removed } = diffSet(current[key], baseline[key] || []);
            added.forEach(item => drift.push(`${label} [${key}] ADDED: ${item}`));
            removed.forEach(item => drift.push(`${label} [${key}] REMOVED: ${item}`));
        }
    }
    return drift;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

/**
 * Compare freshly-measured informational counts against the committed ones. Returns one entry per
 * key whose count moved, as { key, baseline, current, delta }.
 *
 * A committed count that disagrees with what the generator produces today means the baseline file
 * is stale — either the PR legitimately changed the code, or the generator itself changed without a
 * regeneration. Both must be banked with `baseline:update` and committed, so this drift BLOCKS.
 * Bundle byte counts are the only values that stay informational (they need a full analyze:bundle
 * run and vary with the build environment, so gating them would flake).
 */
function countDrift(current, baseline) {
    if (!baseline) return [];
    const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
    const drift = [];
    for (const key of [...keys].sort()) {
        const before = baseline[key];
        const after = current[key];
        if (typeof before === 'number' && typeof after === 'number' && before !== after) {
            drift.push({ key, baseline: before, current: after, delta: after - before });
        }
    }
    return drift;
}

function formatDelta(delta) {
    return delta > 0 ? `+${delta}` : `${delta}`;
}

function printReport(aliasUsage) {
    const bundle = readJson(BUNDLE_BASELINE_PATH);
    // eslint-disable-next-line no-console
    console.log('\n--- bundle bytes (informational — never blocks) ---');
    if (bundle && bundle.packages) {
        for (const [pkg, summary] of Object.entries(bundle.packages)) {
            // eslint-disable-next-line no-console
            console.log(
                `  bundle ${pkg} (as committed): JS ${summary.js_total} B, CSS ${summary.css_total} B, ${summary.chunk_count} chunks`
            );
        }
    } else {
        // eslint-disable-next-line no-console
        console.log('  bundle: no bundle-baseline.json (run `npm run analyze:bundle` + `npm run baseline:bundle`).');
    }
    // eslint-disable-next-line no-console
    console.log('\n--- alias usage (blocking when it moves) ---');
    const committedCounts = (readJson(ALIAS_USAGE_PATH) || {}).counts || null;
    for (const [pkg, count] of Object.entries(aliasUsage.counts)) {
        const before = committedCounts ? committedCounts[pkg] : undefined;
        // Show the committed number next to the measured one so a delta is visible in the log
        // rather than requiring the reader to diff the baseline file by hand.
        const reference =
            typeof before === 'number' && before !== count
                ? ` (baseline ${before}, ${formatDelta(count - before)})`
                : '';
        // eslint-disable-next-line no-console
        console.log(
            `  alias usage ${pkg}: ${count} source files${reference} import through ${aliasUsage.roots[pkg].length} alias roots`
        );
    }
    return countDrift(aliasUsage.counts, committedCounts);
}

/**
 * Merge freshly-measured chunk names with the committed snapshot: packages that were rebuilt (non-
 * null) take their new set; packages not rebuilt (null) keep their committed set. This keeps a
 * partial `--update` from overwriting an un-rebuilt package's chunks with an empty set.
 */
function mergeChunkNames(current, committed) {
    const base = committed || {};
    const merged = {};
    const regenerated = [];
    const preserved = [];
    for (const pkg of CHUNK_PACKAGES) {
        if (current[pkg] != null) {
            merged[pkg] = current[pkg];
            regenerated.push(pkg);
        } else {
            merged[pkg] = base[pkg] || [];
            preserved.push(pkg);
        }
    }
    return { merged, regenerated, preserved };
}

/**
 * Byte-level backstop: is the committed baseline file exactly what `--update` would write for this
 * tree? The named set/count diffs above give precise messages for the fields we reason about; this
 * catches everything else, including fields added to a snapshot later that nobody wired a diff for.
 *
 * Returns a drift description, or null when the file is already fresh.
 */
function freshnessDrift(label, file, currentObject) {
    if (!fs.existsSync(file)) {
        return `${label} MISSING: ${path.relative(ROOT, file)} is not committed — run \`npm run baseline:update\``;
    }
    const committed = fs.readFileSync(file, 'utf8');
    if (committed === serialize(currentObject)) return null;
    return `${label} STALE: ${path.relative(ROOT, file)} is not what the generator produces for this tree`;
}

function main() {
    const isUpdate = process.argv.includes('--update');
    const anyDist = anyDistExists();

    const routeMap = buildRouteMap();
    const aliasUsage = buildAliasUsage();
    const chunkNames = buildChunkNames();
    const notBuilt = CHUNK_PACKAGES.filter(pkg => chunkNames[pkg] == null);

    if (isUpdate) {
        fs.mkdirSync(BASELINES_DIR, { recursive: true });
        fs.writeFileSync(ROUTE_MAP_PATH, serialize(routeMap));
        fs.writeFileSync(ALIAS_USAGE_PATH, serialize(aliasUsage));
        if (anyDist) {
            const { merged, regenerated, preserved } = mergeChunkNames(chunkNames, readJson(CHUNK_NAMES_PATH));
            fs.writeFileSync(CHUNK_NAMES_PATH, serialize(merged));
            // eslint-disable-next-line no-console
            console.log('baseline:update wrote route-map.json, alias-usage.json and chunk-names.json.');
            if (preserved.length) {
                // eslint-disable-next-line no-console
                console.log(
                    `NOTICE: dist/ missing for ${preserved.join(', ')} — kept their committed chunk sets ` +
                        `(only ${regenerated.join(', ') || 'none'} regenerated). Run \`npm run build:all\` for a full refresh.`
                );
            }
        } else {
            // eslint-disable-next-line no-console
            console.log('baseline:update wrote route-map.json and alias-usage.json.');
            // eslint-disable-next-line no-console
            console.log('NOTICE: no dist/ found — chunk-names.json NOT regenerated. Run `npm run build:all` first.');
        }
        return 0;
    }

    const drift = [];
    drift.push(...driftForKeyedSets('route', routeMap, readJson(ROUTE_MAP_PATH)));
    drift.push(...driftForKeyedSets('alias-root', aliasUsage.roots, (readJson(ALIAS_USAGE_PATH) || {}).roots || null));

    if (anyDist) {
        // Packages with a null (not-rebuilt) set are skipped inside driftForKeyedSets, so a partial
        // build never masquerades as a chunk removal for the packages that were not rebuilt.
        drift.push(...driftForKeyedSets('chunk', chunkNames, readJson(CHUNK_NAMES_PATH)));
        if (notBuilt.length) {
            // eslint-disable-next-line no-console
            console.log(
                `NOTICE: dist/ missing for ${notBuilt.join(', ')} — their chunk sets were not checked ` +
                    '(partial build). Run `npm run build:all` for the full check.'
            );
        }
    } else {
        // eslint-disable-next-line no-console
        console.log(
            'NOTICE: no dist/ found — chunk-name assertion skipped (structural-only mode). Run `build:all` for the full check.'
        );
    }

    // Alias usage counts: reported with their committed reference, and BLOCKING when they move.
    // A deletion PR legitimately shrinks them — the required `baseline:update` + commit is the
    // point, since that committed diff is the reviewer-visible record of what the deletion removed.
    const staleCounts = printReport(aliasUsage);
    staleCounts.forEach(d =>
        drift.push(`alias-count [${d.key}] ${d.baseline} -> ${d.current} (${formatDelta(d.delta)})`)
    );

    // Byte-level backstop over the tree-derived snapshots. Chunk names are only asserted when the
    // build actually produced dist/ for every snapshotted package — a partial or absent build would
    // otherwise report the un-rebuilt packages' committed sets as stale.
    const freshness = [
        freshnessDrift('route-map', ROUTE_MAP_PATH, routeMap),
        freshnessDrift('alias-usage', ALIAS_USAGE_PATH, aliasUsage),
    ];
    if (anyDist && notBuilt.length === 0) {
        freshness.push(
            freshnessDrift(
                'chunk-names',
                CHUNK_NAMES_PATH,
                mergeChunkNames(chunkNames, readJson(CHUNK_NAMES_PATH)).merged
            )
        );
    }
    drift.push(...freshness.filter(Boolean));

    if (drift.length === 0) {
        // eslint-disable-next-line no-console
        console.log('\nbaseline:check passed — committed baselines match this tree.');
        return 0;
    }

    // eslint-disable-next-line no-console
    console.error(`\nbaseline:check failed — ${drift.length} baseline difference(s):`);
    // eslint-disable-next-line no-console
    drift.forEach(line => console.error(`  ${line}`));
    // eslint-disable-next-line no-console
    console.error(
        '\nThe committed baselines no longer match this tree — either what ships changed (a' +
            '\nroute/chunk/alias SET), or a tree-derived baseline is stale.' +
            '\nIf INTENDED (e.g. a deletion PR): run `npm run baseline:update` and commit the regenerated' +
            '\ndocs/baselines/*.json in this PR — that committed diff is the reviewer-visible record of' +
            '\nwhat this change removed.' +
            '\nIf NOT intended: this check just caught a bug — fix the code, do not update the baseline.' +
            '\n\nBundle byte counts are NOT part of this gate; they stay informational (see' +
            '\ndocs/baselines/README.md).'
    );
    return 1;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    extractRoutePaths,
    buildRouteMap,
    toLogicalChunkName,
    isStableChunkName,
    chunkNamesForPackage,
    distExists,
    buildChunkNames,
    aliasRootsForPackage,
    buildAliasImportRegex,
    countAliasImports,
    buildAliasUsage,
    diffSet,
    driftForKeyedSets,
    countDrift,
    formatDelta,
    freshnessDrift,
    serialize,
    ROUTE_MAP_PATH,
    CHUNK_NAMES_PATH,
    ALIAS_USAGE_PATH,
};
