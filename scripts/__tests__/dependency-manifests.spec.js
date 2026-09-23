// Manifest guard (ABF-016): a package that imports another package declares it in its own
// package.json, rather than relying on workspace hoisting. Housed in the standalone `scripts`
// project — run by `npm run test:scripts` — alongside the other structural safety-net specs.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJSON = rel => JSON.parse(read(rel));

const SRC_EXT = /\.(ts|tsx|js|jsx)$/;
const SKIP_DIRS = ['node_modules', '__tests__', '__mocks__', 'dist'];
// Collect the package's own source files (skip generated/vendored/test trees) so an
// import assertion proves a real production import, not a test- or build-artifact one.
const walkSources = dir => {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).filter(e => !SKIP_DIRS.includes(e.name))) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkSources(full));
        else if (SRC_EXT.test(entry.name)) out.push(full);
    }
    return out;
};
const anyFileImports = (relDir, dep) =>
    walkSources(path.join(ROOT, relDir)).some(file => {
        const src = fs.readFileSync(file, 'utf8');
        return (
            src.includes(`from '${dep}'`) ||
            src.includes(`from "${dep}"`) ||
            src.includes(`require('${dep}')`) ||
            src.includes(`require("${dep}")`)
        );
    });

describe('[ABF-016] imported packages are declared in their manifests', () => {
    // [manifest rel path, dep, 'dependencies' | 'devDependencies', src dir that imports it]
    const CASES = [
        ['packages/components/package.json', '@deriv/quill-icons', 'dependencies', 'packages/components/src'],
        ['packages/reports/package.json', '@deriv/quill-icons', 'dependencies', 'packages/reports/src'],
        ['packages/reports/package.json', '@deriv/utils', 'dependencies', 'packages/reports/src'],
    ];

    it.each(CASES)(
        '[ABF-016] %s declares %s (an actually-imported package) under %s',
        (manifest, dep, field, srcDir) => {
            const pkg = readJSON(manifest);
            // The declaration exists and pins a version (not relying solely on workspace hoisting).
            expect(pkg[field] && typeof pkg[field][dep]).toBe('string');
            expect(pkg[field][dep].length).toBeGreaterThan(0);
            // The declaration is warranted: the package's own source really imports it.
            expect(anyFileImports(srcDir, dep)).toBe(true);
        }
    );

    it('[ABF-016] @deriv/trader declares the build-time devDeps its build/constants.js requires', () => {
        const pkg = readJSON('packages/trader/package.json');
        const constants = read('packages/trader/build/constants.js');
        const devDeps = ['stylelint-webpack-plugin', 'webpack-bundle-analyzer'];
        devDeps.forEach(dep => {
            // Required by the build script...
            expect(constants).toContain(`require('${dep}')`);
            // ...and therefore declared as a devDependency.
            expect(pkg.devDependencies && typeof pkg.devDependencies[dep]).toBe('string');
            expect(pkg.devDependencies[dep].length).toBeGreaterThan(0);
        });
    });
});
