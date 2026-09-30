#!/usr/bin/env node

/**
 * typecheck — the blocking per-package TypeScript gate (`npm run test:typescript`).
 *
 * Runs `tsc --noEmit` against every gated package's project concurrently and exits non-zero when
 * ANY of them does, naming every failing package rather than only the first. Nothing excuses a
 * known error: a non-zero `tsc` exit is a failure, full stop.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const GATED_PACKAGES = ['api', 'components', 'reports', 'shared', 'stores', 'trader', 'utils'];

// core resolves @deriv/trader and @deriv/reports sources through the @deriv/* alias without their
// own alias roots, and both claim the bare `Types` alias for different modules — so core's project
// cannot resolve both. Gating it needs one of those aliases renamed first.
const EXCLUDED_PACKAGES = ['core'];

const tsconfigFor = name => path.join(ROOT, 'packages', name, 'tsconfig.json');

/**
 * Fold per-package `{ name, status, output }` results into an exit code and a printable summary.
 */
function summarize(results) {
    const failed = results.filter(result => result.status !== 0).map(result => result.name);

    const summary = failed.length
        ? `test:typescript failed — ${failed.length} of ${results.length} package(s) reported type errors:\n` +
          failed.map(name => `  - packages/${name}`).join('\n')
        : `test:typescript passed — ${results.length} package(s) reported zero type errors.`;

    return { exit_code: failed.length ? 1 : 0, failed, summary };
}

function runPackage(name) {
    return new Promise(resolve => {
        const child = spawn('npx', ['tsc', '--noEmit', '-p', tsconfigFor(name)], {
            cwd: ROOT,
            shell: process.platform === 'win32',
        });

        let output = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => {
            output += chunk;
        });
        child.stderr.on('data', chunk => {
            output += chunk;
        });
        child.on('error', error => resolve({ name, status: 1, output: String(error) }));
        child.on('close', status => resolve({ name, status, output }));
    });
}

async function main() {
    const missing = GATED_PACKAGES.filter(name => !fs.existsSync(tsconfigFor(name)));
    if (missing.length) {
        // eslint-disable-next-line no-console
        console.error(`test:typescript failed — no tsconfig.json for: ${missing.join(', ')}`);
        return 1;
    }

    const results = await Promise.all(GATED_PACKAGES.map(runPackage));
    const { exit_code, failed, summary } = summarize(results);

    results
        .filter(result => failed.includes(result.name))
        .forEach(result => {
            // eslint-disable-next-line no-console
            console.error(`\n--- packages/${result.name} ---\n${result.output.trim()}`);
        });

    // eslint-disable-next-line no-console
    (exit_code ? console.error : console.log)(`\n${summary}`);
    return exit_code;
}

if (require.main === module) {
    main().then(code => process.exit(code));
}

module.exports = {
    GATED_PACKAGES,
    EXCLUDED_PACKAGES,
    summarize,
    tsconfigFor,
};
