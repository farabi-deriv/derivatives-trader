const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    extractRoutePaths,
    toLogicalChunkName,
    isStableChunkName,
    diffSet,
    driftForKeyedSets,
    countDrift,
    formatDelta,
    freshnessDrift,
    serialize,
    buildAliasImportRegex,
    distExists,
    buildChunkNames,
} = require('../baseline-check');

describe('baseline-check structural snapshots (CSN-004)', () => {
    it('[CSN-004] extracts routes.* references and string literals, ignoring type annotations', () => {
        const source = `
            const config = [
                { path: routes.reports, component: Reports },
                { path: routes.positions },
                { path: '/*', component: NotFound },
            ];
            type TRoute = { path: string; };
        `;
        const paths = extractRoutePaths(source);
        expect(paths).toEqual(['/*', 'routes.positions', 'routes.reports']);
        // `path: string;` must NOT be captured as a route.
        expect(paths).not.toContain('string');
    });

    it('[CSN-004] reduces emitted chunk filenames to stable logical names', () => {
        // contenthash stripped
        expect(toLogicalChunkName('trader/js/trader.trader-positions.1e42765fdee4cc5ab536.js')).toBe(
            'trader-positions'
        );
        // volatile cache-group content collapsed to the cache-group name
        expect(
            toLogicalChunkName('trader/js/trader.vendors-node_modules_lodash_debounce-968f6c.a8aac03410fff884f.js')
        ).toBe('vendors');
        // volatile per-chunk hash suffix stripped
        expect(toLogicalChunkName('trader/js/trader.quill-ui-vendor-ca1ed28e.bfdd42c9be68ddc8d359.js')).toBe(
            'quill-ui-vendor'
        );
        expect(toLogicalChunkName('js/core.main~d5ef20ee.29213337bafbd16f2e10.js')).toBe('main');
        // default cache-group + package/module boundary collapses to the cache-group name.
        expect(toLogicalChunkName('trader/js/trader.default-api-v2_src_index_ts.e7f65b06.js')).toBe('default');
        // core split-chunk vendor manifests collapse to their cache-group name.
        expect(toLogicalChunkName('js/core.framework-vendor~node_modules_m.179f8457.js')).toBe('framework-vendor');
    });

    it('[CSN-004] excludes volatile chunk ids and bare module-path manifests from the snapshot', () => {
        // Authored / cache-group names are stable and kept.
        expect(isStableChunkName('trader-positions')).toBe(true);
        expect(isStableChunkName('quill-ui-vendor')).toBe(true);
        // Numeric ids and bare module-path manifests renumber/rewrite as code is deleted — excluded.
        expect(isStableChunkName('501')).toBe(false);
        expect(isStableChunkName('node_modules_deriv-com_analytics_dist_providers_posthog_index_js')).toBe(false);
    });

    it('[CSN-004] serialises snapshots deterministically with a trailing newline', () => {
        const snapshot = { trader: ['a', 'b'], core: ['x'] };
        expect(serialize(snapshot)).toBe(serialize(snapshot));
        expect(serialize(snapshot).endsWith('\n')).toBe(true);
    });
});

describe('baseline-check gating (CSN-005)', () => {
    it('[CSN-005] diffSet reports added and removed set members', () => {
        expect(diffSet(['a', 'b', 'c'], ['a', 'b'])).toEqual({ added: ['c'], removed: [] });
        expect(diffSet(['a'], ['a', 'b'])).toEqual({ added: [], removed: ['b'] });
    });

    it('[CSN-005] flags a removed chunk / route as structural drift', () => {
        const baseline = { trader: ['trader-positions', 'trader-trade'] };
        const current = { trader: ['trader-trade'] }; // trader-positions dropped
        const drift = driftForKeyedSets('chunk', current, baseline);
        expect(drift).toEqual(['chunk [trader] REMOVED: trader-positions']);
    });

    it('[CSN-005] no drift when the structural set is unchanged (byte/count deltas do not appear here)', () => {
        const baseline = { trader: ['a', 'b'], core: ['x'] };
        const current = { trader: ['b', 'a'], core: ['x'] }; // same set, different order
        expect(driftForKeyedSets('chunk', current, baseline)).toEqual([]);
    });

    it('[CSN-005] flags an added alias root as structural drift', () => {
        const baseline = { trader: ['AppV2', 'Modules'] };
        const current = { trader: ['AppV2', 'Modules', 'NewRoot'] };
        expect(driftForKeyedSets('alias-root', current, baseline)).toEqual(['alias-root [trader] ADDED: NewRoot']);
    });

    it('[CSN-005] treats an empty dist/ (present but no emitted JS) as "not built", not "built with zero chunks"', () => {
        // Regression: a leftover/interrupted-build empty dist/ dir must not be read as a real build
        // that emits zero chunks, or `--update` wipes out that package's committed chunk set.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-empty-dist-'));
        fs.mkdirSync(path.join(dir, 'packages', 'core', 'dist'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'packages', 'trader', 'dist', 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'packages', 'trader', 'dist', 'js', 'trader.main.1e42765fdee4cc5a.js'), '');

        expect(distExists('core', dir)).toBe(false);
        expect(distExists('trader', dir)).toBe(true);
        expect(buildChunkNames(dir)).toEqual({ trader: ['main'], reports: null, core: null });
    });

    it('[CSN-005] does not flag REMOVED when a package was not rebuilt (null current set)', () => {
        // `reports` has no dist/ this run (partial local build), so its current set is null. A null
        // side means "not measured" — it must be skipped, not diffed as an empty set that would report
        // every committed chunk as REMOVED.
        const baseline = { trader: ['trader-trade'], reports: ['reports-main'] };
        const current = { trader: ['trader-trade'], reports: null };
        expect(driftForKeyedSets('chunk', current, baseline)).toEqual([]);
    });
});

describe('baseline-check alias-import detection (CSN-005)', () => {
    it('[CSN-005] counts alias imports only from module specifiers, not incidental strings', () => {
        const re = buildAliasImportRegex(['Modules', 'AppV2']);
        // Genuine module specifiers across the import forms used in the codebase.
        expect(re.test("import Foo from 'Modules/Trading/foo';")).toBe(true);
        expect(re.test("export { bar } from 'Modules/Trading/bar';")).toBe(true);
        expect(re.test("const Lazy = React.lazy(() => import('AppV2/Foo'));")).toBe(true);
        expect(re.test("const x = require('Modules/x');")).toBe(true);
        expect(re.test("import 'AppV2/side-effect';")).toBe(true);
        // Incidental string literals that merely start with an alias root — must NOT be counted.
        expect(re.test("const route = 'Modules/whatever';")).toBe(false);
        expect(re.test("<Comp label='AppV2/Foo' />")).toBe(false);
    });
});

describe('baseline-check freshness gating (CSN-005)', () => {
    it('[CSN-005] reports a committed count that disagrees with the measured one', () => {
        // The exact regression this exists for: the counting logic changed, the baseline did not.
        const drift = countDrift({ trader: 342, core: 32, reports: 30 }, { trader: 384, core: 41, reports: 32 });

        expect(drift).toEqual([
            { key: 'core', baseline: 41, current: 32, delta: -9 },
            { key: 'reports', baseline: 32, current: 30, delta: -2 },
            { key: 'trader', baseline: 384, current: 342, delta: -42 },
        ]);
    });

    it('[CSN-005] is silent when the counts agree, and when there is no committed baseline', () => {
        expect(countDrift({ trader: 342 }, { trader: 342 })).toEqual([]);
        expect(countDrift({ trader: 342 }, null)).toEqual([]);
    });

    it('[CSN-005] ignores non-numeric and missing counterparts rather than reporting bogus drift', () => {
        expect(countDrift({ trader: 342, added: 7 }, { trader: 342 })).toEqual([]);
        expect(countDrift({ trader: 342 }, { trader: 'many' })).toEqual([]);
    });

    it('[CSN-005] signs deltas so a shrink and a growth read differently', () => {
        expect(formatDelta(-42)).toBe('-42');
        expect(formatDelta(7)).toBe('+7');
    });

    it('[CSN-005] byte-level backstop passes only when the committed file is what --update would write', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-fresh-'));
        const file = path.join(dir, 'alias-usage.json');
        const current = { counts: { trader: 342 } };

        fs.writeFileSync(file, serialize(current));
        expect(freshnessDrift('alias-usage', file, current)).toBeNull();

        // A stale committed file is drift even if every named set still matches.
        fs.writeFileSync(file, serialize({ counts: { trader: 384 } }));
        expect(freshnessDrift('alias-usage', file, current)).toMatch(/STALE/);
    });

    it('[CSN-005] a missing baseline file is drift, not a silent pass', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-missing-'));
        expect(freshnessDrift('route-map', path.join(dir, 'nope.json'), {})).toMatch(/MISSING/);
    });
});
