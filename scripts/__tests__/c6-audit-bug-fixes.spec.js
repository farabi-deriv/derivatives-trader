// Structural regression tests for the three C6 (audit-bug-fixes) requirements whose
// scenarios are file-layout / manifest / findings-record facts rather than runtime
// behaviour: ABF-001 (bug 14 recorded as a not-present discrepancy, re-verified at HEAD),
// ABF-015 (the shadowed LandscapeBlocker module is removed) and ABF-016 (imported packages
// are declared in their manifests). Housed in the standalone `scripts` project — run by
// `npm run test:scripts` — alongside the other structural safety-net specs.
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

describe('[ABF-001] bug 14 is re-verified at HEAD and recorded as a not-present discrepancy', () => {
    const FINDING = 'docs/spec-to-pr/findings/c6-bug-14-toolbar-widgets-not-present.md';
    const TOOLBAR = 'packages/trader/src/Modules/SmartChart/Components/toolbar-widgets.tsx';
    const OS_DETECT = 'packages/shared/src/utils/os/os_detect.ts';

    it('[ABF-001] the not-present bug (14) is recorded as a findings note under docs/spec-to-pr/findings/', () => {
        expect(fs.existsSync(path.join(ROOT, FINDING))).toBe(true);
        const note = read(FINDING).toLowerCase();
        // The discrepancy is recorded: which bug, tied to this requirement, and that it is NOT present at HEAD.
        expect(note).toContain('bug 14');
        expect(note).toContain('abf-001');
        expect(note).toContain('toolbar-widgets');
        expect(note).toMatch(/not present at head|absent at head/);
        // The re-verification rationale (why it is not present) is captured, not merely asserted.
        expect(note).toContain('isdesktopos');
        expect(note).toContain('istabletos');
        expect(note).toContain('boolean constant');
        expect(note).toMatch(/no code change|no code changed/);
    });

    it('[ABF-001] re-verifying at HEAD confirms the reported bug is absent (isDesktopOs is called; isTabletOs is a boolean constant)', () => {
        const os = read(OS_DETECT);
        // isDesktopOs is a function (must be *called* with parens to gate anything).
        expect(os).toMatch(/export const isDesktopOs\s*=\s*\(\s*\)\s*=>/);
        // isTabletOs is a module-level boolean constant (a `.test(...)` expression), NOT a function.
        expect(os).toMatch(/export const isTabletOs\s*=[\s\S]*?\.test\(/);
        expect(os).not.toMatch(/export const isTabletOs\s*=\s*\(?\s*\)?\s*=>/);

        const toolbar = read(TOOLBAR);
        // HEAD uses the valid form: call isDesktopOs(), negate the isTabletOs constant.
        expect(toolbar).toMatch(/isDesktopOs\(\)\s*&&\s*!isTabletOs/);
        // The reported buggy forms are absent: no bare function-reference negation, no call of the constant.
        expect(toolbar).not.toMatch(/!isDesktopOs\b(?!\()/); // `!isDesktopOs` (missing call parens)
        expect(toolbar).not.toMatch(/!isTabletOs\s*\(/); // `!isTabletOs()` (calling a boolean)
    });

    it('[ABF-001] bug 14 was NOT coded: StudyLegend and Share stay gated on real-desktop detection so they render on desktop', () => {
        const toolbar = read(TOOLBAR);
        // The desktop gate is derived from the (valid) detection above and guards both widgets.
        expect(toolbar).toMatch(/const is_real_desktop_device = isDesktopOs\(\) && !isTabletOs/);
        expect(toolbar).toMatch(/is_real_desktop_device && !isMobile[\s\S]*<StudyLegend/);
        expect(toolbar).toMatch(/is_real_desktop_device && !isMobile && <Share/);
    });
});

describe('[ABF-015] the shadowed LandscapeBlocker module is removed', () => {
    const LB_DIR = 'packages/core/src/App/Components/Elements/LandscapeBlocker';

    it('[ABF-015] exactly one barrel (index.ts) remains — the shadowed index.tsx is gone', () => {
        const entries = fs.readdirSync(path.join(ROOT, LB_DIR));
        const barrels = entries.filter(name => /^index\.(t|j)sx?$/.test(name));
        expect(barrels).toEqual(['index.ts']);
        expect(fs.existsSync(path.join(ROOT, LB_DIR, 'index.tsx'))).toBe(false);
    });

    it('[ABF-015] the surviving barrel still re-exports LandscapeBlocker so consumers resolve it', () => {
        const barrel = read(`${LB_DIR}/index.ts`);
        expect(barrel).toMatch(/from ['"]\.\/landscape-blocker['"]/);
        expect(barrel).toMatch(/export default/);
        // The re-export target exists, so `import LandscapeBlocker from '.../LandscapeBlocker'` resolves.
        expect(fs.existsSync(path.join(ROOT, LB_DIR, 'landscape-blocker.tsx'))).toBe(true);
    });

    it('[ABF-015] the sole consumer imports the barrel directory (resolution selects index.ts)', () => {
        const consumer = read('packages/core/src/App/AppContent.tsx');
        expect(consumer).toMatch(/import LandscapeBlocker from ['"]\.\/Components\/Elements\/LandscapeBlocker['"]/);
    });
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
