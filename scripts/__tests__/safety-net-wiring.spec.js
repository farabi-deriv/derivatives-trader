const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('safety-net CI + npm wiring (CSN-006)', () => {
    const pkg = JSON.parse(read('package.json'));

    it('[CSN-006] exposes knip:check and baseline:check as root npm scripts', () => {
        expect(pkg.scripts['knip:check']).toBe('node scripts/knip-check.js');
        expect(pkg.scripts['baseline:check']).toBe('node scripts/baseline-check.js');
    });

    it('[CSN-006] exposes the deliberate regeneration scripts', () => {
        expect(pkg.scripts['knip:baseline']).toBe('node scripts/knip-check.js --update');
        expect(pkg.scripts['baseline:bundle']).toBe('node scripts/bundle-baseline.js');
        expect(pkg.scripts['baseline:update']).toBe('node scripts/baseline-check.js --update');
    });

    it('[CSN-006] wires knip:check and baseline:check into the CI workflow', () => {
        const workflow = read('.github/workflows/test.yml');
        expect(workflow).toContain('npm run knip:check');
        expect(workflow).toContain('npm run baseline:check');
    });
});

describe('baselines documentation (CSN-007)', () => {
    const readme = read('docs/baselines/README.md');

    it('[CSN-007] documents the regeneration command for each baseline', () => {
        expect(readme).toContain('knip:baseline');
        expect(readme).toContain('baseline:bundle');
        expect(readme).toContain('baseline:update');
    });

    it('[CSN-007] distinguishes blocking from informational drift', () => {
        expect(readme.toLowerCase()).toContain('blocking');
        expect(readme.toLowerCase()).toContain('informational');
    });

    it('[CSN-007] records a dated M0 branch-status confirmation, not a pending blocker', () => {
        expect(readme.toLowerCase()).toContain('branch status');
        // The confirmation must be positively recorded (dated), not left pending.
        expect(readme).toMatch(/confirmed on \d{4}-\d{2}-\d{2}/i);
        expect(readme.toLowerCase()).not.toContain('pending human sign-off');
    });
});
