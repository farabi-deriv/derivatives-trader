const {
    normalizeFindings,
    newFindings,
    staleFindings,
    serializeBaseline,
    toRepoRelative,
    parseKnipResult,
} = require('../knip-check');

const ROOT = '/repo';

// A representative slice of knip's `{ files, issues }` JSON reporter output.
const knipJson = {
    files: ['packages/core/src/dead-file.ts', 'packages/trader/src/also-dead.tsx'],
    issues: [
        {
            file: 'packages/reports/src/thing.tsx',
            exports: [{ name: 'UnusedExport' }],
            types: [{ name: 'TUnusedType' }],
            duplicates: [[{ name: 'Thing' }, { name: 'default' }]],
        },
        {
            file: 'package.json',
            dependencies: [{ name: 'left-pad' }],
            unresolved: [{ name: '/repo/packages/trader/src/Constants/index.js' }],
        },
    ],
};

describe('knip-check normaliser', () => {
    it('[CSN-001] normalises knip findings deterministically with repo-relative, sorted output', () => {
        const first = normalizeFindings(knipJson, ROOT);
        const second = normalizeFindings(knipJson, ROOT);

        // Deterministic: two runs on the same input are identical, and stably sorted.
        expect(first).toEqual(second);
        expect([...first]).toEqual([...first].sort());

        // Unused files and typed issues are all represented.
        expect(first).toContain('file packages/core/src/dead-file.ts');
        expect(first).toContain('exports packages/reports/src/thing.tsx UnusedExport');
        expect(first).toContain('types packages/reports/src/thing.tsx TUnusedType');
        expect(first).toContain('dependencies package.json left-pad');
        // duplicate group members are sorted and joined.
        expect(first).toContain('duplicates packages/reports/src/thing.tsx Thing|default');
    });

    it('[CSN-001] strips the absolute repo-root prefix so findings are checkout-independent', () => {
        const findings = normalizeFindings(knipJson, ROOT);
        // The unresolved entry carried an absolute path; it must be made repo-relative.
        expect(findings).toContain('unresolved package.json packages/trader/src/Constants/index.js');
        // No finding retains the absolute repo-root prefix.
        expect(findings.some(f => f.includes(`${ROOT}/packages`))).toBe(false);
        expect(toRepoRelative('/repo/x/y.ts', ROOT)).toBe('x/y.ts');
    });

    it('[CSN-001] serialises the baseline as byte-identical JSON across runs', () => {
        const findings = normalizeFindings(knipJson, ROOT);
        expect(serializeBaseline(findings)).toBe(serializeBaseline(findings));
        expect(serializeBaseline(findings).endsWith('\n')).toBe(true);
    });

    it('[CSN-002] flags only findings absent from the baseline, ignoring known ones', () => {
        const baseline = ['file packages/core/src/dead-file.ts', 'exports packages/reports/src/thing.tsx UnusedExport'];
        const current = [...baseline, 'file packages/trader/src/brand-new-dead.ts'];

        const added = newFindings(current, baseline);
        expect(added).toEqual(['file packages/trader/src/brand-new-dead.ts']);
    });

    it('[CSN-002] passes (no new findings) when current findings are a subset of the baseline', () => {
        const baseline = ['file a.ts', 'file b.ts', 'exports c.ts X'];
        // A deletion PR shrinks the set — fewer findings than baseline is never a failure.
        expect(newFindings(['file a.ts'], baseline)).toEqual([]);
    });
});

describe('knip-check output parsing', () => {
    it('[CSN-003] parses valid knip JSON from stdout regardless of a findings exit code', () => {
        const result = { status: 1, stdout: JSON.stringify(knipJson), stderr: '' };
        expect(parseKnipResult(result)).toEqual(knipJson);
    });

    it('[CSN-003] surfaces knip stderr instead of crashing when a config load error prints to stdout', () => {
        // knip exits 2 and writes a plain-text hint to stdout when it cannot load a config file.
        const result = {
            status: 2,
            stdout: 'Configuration file load error? Visit https://knip.dev/reference/known-issues\n',
            stderr: 'ERROR: Error loading playwright.config.ts\nReason: Environment file not found',
        };
        expect(() => parseKnipResult(result)).toThrow(/knip failed to produce JSON output \(exit 2\)/);
        expect(() => parseKnipResult(result)).toThrow(/Error loading playwright.config.ts/);
    });

    it('[CSN-003] throws with the exit code when knip produces no output at all', () => {
        expect(() => parseKnipResult({ status: 127, stdout: '', stderr: 'command not found' })).toThrow(
            /knip failed to produce JSON output \(exit 127\)/
        );
    });

    it('[CSN-003] propagates a spawn error verbatim', () => {
        const spawnError = new Error('spawn npx ENOENT');
        expect(() => parseKnipResult({ error: spawnError })).toThrow(spawnError);
    });
});

describe('knip-check baseline staleness (CSN-002)', () => {
    const baseline = ['exports a.ts Old', 'exports b.ts Kept', 'file c.ts'];

    it('[CSN-002] reports baseline entries knip no longer finds', () => {
        expect(staleFindings(['exports b.ts Kept'], baseline)).toEqual(['exports a.ts Old', 'file c.ts']);
    });

    it('[CSN-002] is empty when every baseline entry is still reported', () => {
        expect(staleFindings(baseline, baseline)).toEqual([]);
    });

    it('[CSN-002] a shrunk baseline is drift in its own right, independent of new findings', () => {
        // Cleanup with nothing orphaned: no NEW findings, but the unbanked shrink is what gates.
        const current = ['exports b.ts Kept'];
        expect(newFindings(current, baseline)).toEqual([]);
        expect(staleFindings(current, baseline)).toHaveLength(2);
    });

    it('[CSN-002] the two directions are reported separately', () => {
        const current = ['exports b.ts Kept', 'exports d.ts BrandNew'];
        expect(newFindings(current, baseline)).toEqual(['exports d.ts BrandNew']);
        expect(staleFindings(current, baseline)).toEqual(['exports a.ts Old', 'file c.ts']);
    });
});
