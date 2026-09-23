const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

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

// -------------------------------------------------------------------------------------------------
// CSN-008 — the guardrails C0 installed are re-verified as still wired and still BLOCKING.
// -------------------------------------------------------------------------------------------------

/**
 * Split a GitHub workflow into its steps without a YAML dependency. A step starts at a `- name:`
 * line; every more-indented line that follows belongs to it, and the first line at or left of that
 * indent (the next step, or the next job key) ends it.
 */
function parseWorkflowSteps(workflow) {
    const steps = [];
    let current = null;
    for (const line of workflow.split('\n')) {
        const start = line.match(/^([ \t]*)- name:[ \t]*(.+?)[ \t]*$/);
        if (start) {
            current = { indent: start[1].length, name: start[2], lines: [] };
            steps.push(current);
        } else if (current) {
            const indent = line.search(/\S/);
            if (indent !== -1 && indent <= current.indent) current = null;
            else current.lines.push(line);
        }
    }
    return steps.map(step => ({ name: step.name, body: step.lines.join('\n') }));
}

describe('cleanup guardrails are re-verified, not re-implemented (CSN-008)', () => {
    const pkg = JSON.parse(read('package.json'));
    const workflow = read('.github/workflows/test.yml');
    const steps = parseWorkflowSteps(workflow);

    // Both gates, with the script each must still point at — neither may be replaced.
    const GATES = [
        { script: 'knip:check', implementation: 'node scripts/knip-check.js' },
        { script: 'baseline:check', implementation: 'node scripts/baseline-check.js' },
    ];

    it('[CSN-008] the step parser finds the workflow steps it is asked to inspect', () => {
        // A parser that silently returned [] would make every assertion below vacuous.
        expect(steps.length).toBeGreaterThan(5);
        expect(steps.map(step => step.name)).toContain('Run knip check');
    });

    GATES.forEach(({ script, implementation }) => {
        it(`[CSN-008] ${script} is still the committed gate, not a replacement`, () => {
            expect(pkg.scripts[script]).toBe(implementation);
            const [, script_path] = implementation.split(' ');
            expect(fs.existsSync(path.join(ROOT, script_path))).toBe(true);
        });

        it(`[CSN-008] every CI step running ${script} fails the job on a non-zero exit`, () => {
            const command = `npm run ${script}`;
            const gate_steps = steps.filter(step => step.body.includes(command));
            expect(gate_steps.length).toBeGreaterThan(0);

            gate_steps.forEach(step => {
                // Its own step, invoking the bare command: no `|| true`, no `& … wait` (which
                // discards the child's exit status), nothing appended that could swallow a failure.
                expect(step.body).toMatch(new RegExp(`^\\s*run:\\s*${command}\\s*$`, 'm'));
                expect(step.body).not.toMatch(new RegExp(`${command}[^\\n]*\\|\\|`));
                expect(step.body).not.toMatch(new RegExp(`${command}[^\\n]*&\\s*$`, 'm'));
                expect(step.body).not.toMatch(/continue-on-error/);
            });
        });
    });

    it('[CSN-008] no job or step in the workflow is advisory', () => {
        expect(workflow).not.toMatch(/continue-on-error/);
    });

    it('[CSN-008] no CI project, test-matrix entry or ownership rule names a package that is gone', () => {
        // Workstream C deleted packages (api-v2 among them); a `tsc` project, matrix entry or
        // CODEOWNERS rule left pointing at one is a silently-dead reference.
        const stale = [];
        for (const file of ['.github/workflows/test.yml', '.github/CODEOWNERS']) {
            const referenced = new Set([...read(file).matchAll(/packages\/([A-Za-z0-9_.-]+)/g)].map(m => m[1]));
            for (const name of referenced) {
                if (!fs.existsSync(path.join(ROOT, 'packages', name))) stale.push(`${file} -> packages/${name}`);
            }
        }

        expect(stale).toEqual([]);
        // The workflow still targets the packages it did before: the three tsc projects and the
        // three test-matrix groups are untouched by the reference cleanup.
        expect(workflow).toContain('npx tsc --project packages/api/tsconfig.json -noEmit');
        expect(workflow).toContain('packages/api packages/shared packages/stores packages/utils packages/components');
    });
});

// -------------------------------------------------------------------------------------------------
// CSN-008 — baseline:check still reports the bundle delta informationally AND still blocks on drift.
//
// Exercised end-to-end against a sandbox repo root (the script derives ROOT from its own location),
// so the real committed baselines are never written to.
// -------------------------------------------------------------------------------------------------

describe('baseline:check still reports bundle bytes and still blocks (CSN-008)', () => {
    const BUNDLE_BASELINE = { packages: { trader: { js_total: 123, css_total: 45, chunk_count: 6 } } };
    let sandbox;

    const runGate = (...args) =>
        spawnSync(process.execPath, [path.join(sandbox, 'scripts', 'baseline-check.js'), ...args], {
            encoding: 'utf8',
        });

    beforeAll(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'csn-008-gate-'));
        fs.mkdirSync(path.join(sandbox, 'scripts'), { recursive: true });
        fs.copyFileSync(
            path.join(ROOT, 'scripts', 'baseline-check.js'),
            path.join(sandbox, 'scripts', 'baseline-check.js')
        );
        // The script requires each snapshotted package's build/constants.js for its ALIASES.
        for (const pkg of ['trader', 'core', 'reports']) {
            const build_dir = path.join(sandbox, 'packages', pkg, 'build');
            fs.mkdirSync(build_dir, { recursive: true });
            fs.writeFileSync(path.join(build_dir, 'constants.js'), 'module.exports = { ALIASES: {} };\n');
        }
        fs.mkdirSync(path.join(sandbox, 'docs', 'baselines'), { recursive: true });
        fs.writeFileSync(
            path.join(sandbox, 'docs', 'baselines', 'bundle-baseline.json'),
            JSON.stringify(BUNDLE_BASELINE, null, 4) + '\n'
        );
        // Seed the structural baselines from this sandbox tree, so the first check is clean.
        expect(runGate('--update').status).toBe(0);
    });

    afterAll(() => {
        if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true });
    });

    it('[CSN-008] reports the committed bundle bytes as informational output and exits zero when clean', () => {
        const result = runGate();

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('bundle trader (as committed): JS 123 B, CSS 45 B, 6 chunks');
        expect(result.stdout).toContain('informational — never blocks');
        expect(result.stdout).toContain('committed baselines match this tree');
    });

    it('[CSN-008] still exits non-zero on structural set drift, with the bundle report unchanged', () => {
        const route_map_path = path.join(sandbox, 'docs', 'baselines', 'route-map.json');
        const committed = JSON.parse(fs.readFileSync(route_map_path, 'utf8'));
        const [first_route_file] = Object.keys(committed);
        const restore = fs.readFileSync(route_map_path, 'utf8');

        try {
            committed[first_route_file] = ['routes.phantom'];
            fs.writeFileSync(route_map_path, JSON.stringify(committed, null, 4) + '\n');
            const result = runGate();

            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain('REMOVED: routes.phantom');
            expect(result.stderr).toContain('baseline:check failed');
            // Bundle bytes are still printed, and still not what blocked.
            expect(result.stdout).toContain('bundle trader (as committed): JS 123 B, CSS 45 B, 6 chunks');
            expect(result.stderr).not.toContain('bundle trader');
        } finally {
            fs.writeFileSync(route_map_path, restore);
        }
    });
});
