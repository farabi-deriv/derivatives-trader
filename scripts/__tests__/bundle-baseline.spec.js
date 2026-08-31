const { summarizeStats, buildBundleBaseline } = require('../bundle-baseline');

// Minimal webpack-stats shape: only `assets[].name/size` is read.
const coreStats = {
    assets: [
        { name: 'js/core.main.abc.js', size: 1000 },
        { name: 'js/core.vendor.def.js', size: 500 },
        { name: 'css/core.main.css', size: 200 },
        { name: 'js/core.main.abc.js.map', size: 9999 }, // source map: not shipped — excluded entirely
        { name: 'js/core.vendor.def.js.LICENSE.txt', size: 42 }, // Terser banner — excluded entirely
    ],
};
const traderStats = {
    assets: [
        { name: 'trader/js/trader.js', size: 300 },
        { name: 'trader/css/trader.css', size: 100 },
    ],
};

describe('bundle-baseline', () => {
    it('[CSN-003] summarises JS total, CSS total and asset/chunk counts from stats', () => {
        const summary = summarizeStats(coreStats);
        expect(summary.js_total).toBe(1500); // 1000 + 500 (.map excluded)
        expect(summary.css_total).toBe(200); // core CSS bundle captured
        expect(summary.asset_count).toBe(3); // .map and .LICENSE.txt are not shipped assets
        expect(summary.chunk_count).toBe(2); // two .js chunks
        // largest_assets reflects shipped code, not the (larger) source map alongside it.
        expect(summary.largest_assets[0]).toEqual({ name: 'js/core.main.abc.js', size: 1000 });
        expect(summary.largest_assets.map(a => a.name)).not.toContain('js/core.main.abc.js.map');
    });

    it('[CSN-003] builds a per-package baseline plus a project total', () => {
        const { baseline, missing } = buildBundleBaseline({
            core: coreStats,
            trader: traderStats,
            reports: traderStats,
            components: traderStats,
        });
        expect(missing).toEqual([]);
        expect(baseline.packages.core.css_total).toBe(200);
        expect(baseline.total.js_total).toBe(1500 + 300 * 3);
        expect(baseline.total.css_total).toBe(200 + 100 * 3);
    });

    it('[CSN-003] reports missing packages rather than fabricating sizes', () => {
        const { baseline, missing } = buildBundleBaseline({
            core: coreStats,
            trader: null,
            reports: null,
            components: null,
        });
        expect(missing).toEqual(['trader', 'reports', 'components']);
        // No fabricated entries for the missing packages.
        expect(Object.keys(baseline.packages)).toEqual(['core']);
    });
});
