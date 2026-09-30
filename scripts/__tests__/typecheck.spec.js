const fs = require('fs');
const path = require('path');

const { GATED_PACKAGES, EXCLUDED_PACKAGES, summarize, tsconfigFor } = require('../typecheck');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const result = (name, status, output = '') => ({ name, status, output });

describe('typescript gate aggregation (TSG-001)', () => {
    it('[TSG-001] exits zero only when every package exited zero', () => {
        expect(summarize([result('api', 0), result('shared', 0)]).exit_code).toBe(0);
    });

    it('[TSG-001] exits non-zero when any package exited non-zero', () => {
        expect(summarize([result('api', 0), result('shared', 2)]).exit_code).toBe(1);
        expect(summarize([result('api', 2), result('shared', 0)]).exit_code).toBe(1);
        expect(summarize([result('api', null)]).exit_code).toBe(1);
    });

    it('[TSG-001] names every failing package, not just the first', () => {
        const { failed, summary } = summarize([result('api', 0), result('shared', 2), result('reports', 2)]);

        expect(failed).toEqual(['shared', 'reports']);
        expect(summary).toContain('shared');
        expect(summary).toContain('reports');
    });

    it('[TSG-001] reports a pass summary naming the gated package count when clean', () => {
        const { summary } = summarize(GATED_PACKAGES.map(name => result(name, 0)));

        expect(summary).toContain(String(GATED_PACKAGES.length));
        expect(summary).toContain('passed');
    });
});

describe('the gated package set (TSG-002)', () => {
    const with_tsconfig = fs
        .readdirSync(path.join(ROOT, 'packages'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => fs.existsSync(path.join(ROOT, 'packages', name, 'tsconfig.json')))
        .sort();

    it('[TSG-002] covers every package holding a tsconfig.json, minus the documented exclusions', () => {
        const expected = with_tsconfig.filter(name => !EXCLUDED_PACKAGES.includes(name));
        const ungated = expected.filter(name => !GATED_PACKAGES.includes(name));

        expect(ungated).toEqual([]);
        expect([...GATED_PACKAGES].sort()).toEqual(expected);
    });

    it('[TSG-002] excludes only packages/core, and records why in the script', () => {
        expect(EXCLUDED_PACKAGES).toEqual(['core']);
        expect(read('scripts/typecheck.js')).toMatch(/Types.*alias|alias.*Types/);
    });

    it('[TSG-002] resolves every gated entry to an existing tsconfig.json', () => {
        GATED_PACKAGES.forEach(name => {
            expect(fs.existsSync(tsconfigFor(name))).toBe(true);
        });
    });
});

describe('the gate is wired as an npm script (TSG-003)', () => {
    const pkg = JSON.parse(read('package.json'));

    it('[TSG-003] exposes test:typescript as the aggregating runner', () => {
        expect(pkg.scripts['test:typescript']).toBe('node scripts/typecheck.js');
    });

    it('[TSG-003] asserts zero rather than diffing a committed error baseline', () => {
        // The gated tsconfigs are the runner's only inputs — no allowlist is consulted, so a single
        // known error still fails the gate.
        expect(read('scripts/typecheck.js')).not.toContain('docs/baselines');
        expect(summarize([result('shared', 2)]).exit_code).toBe(1);
        expect(summarize([result('shared', 1), result('reports', 0)]).failed).toEqual(['shared']);
    });
});

describe('gated package tsconfigs (TSG-004)', () => {
    const configs = GATED_PACKAGES.map(name => ({ name, json: JSON.parse(read(`packages/${name}/tsconfig.json`)) }));

    it('[TSG-004] declares no typeRoots in any gated package', () => {
        const narrowed = configs.filter(({ json }) => (json.compilerOptions || {}).typeRoots).map(({ name }) => name);

        expect(narrowed).toEqual([]);
    });

    it('[TSG-004] includes the shared jest-dom registration in every gated package', () => {
        configs.forEach(({ name, json }) => {
            expect({ name, include: json.include }).toEqual({
                name,
                include: expect.arrayContaining(['../../types/testing-library.d.ts']),
            });
        });
    });

    it('[TSG-004] names no include path that does not exist', () => {
        const dangling = [];
        configs.forEach(({ name, json }) => {
            (json.include || []).forEach(entry => {
                const resolved = path.resolve(ROOT, 'packages', name, entry);
                if (!fs.existsSync(resolved)) dangling.push(`packages/${name}/tsconfig.json -> ${entry}`);
            });
        });

        expect(dangling).toEqual([]);
    });
});
