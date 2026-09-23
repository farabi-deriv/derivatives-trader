/**
 * Standing guards over the repository's Jest corpus (capability: test-suite-hygiene).
 *
 * These are lint-style invariants on the test suite itself, not tests of application behaviour, so
 * they live in the root `scripts` Jest project (`npm run test:scripts`, a CI step) rather than in a
 * package project. Each one is written so that a FUTURE change re-introducing the thing the
 * requirement forbids fails here — TSH-002's prohibition explicitly applies to every later cleanup
 * change, not only to the one that introduced it.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { serializeBaseline, BASELINE_PATH } = require('../knip-check');

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_ROOTS = ['packages', 'scripts'];
const SPEC_RE = /\.spec\.(ts|tsx|js|jsx)$/;
const MODULE_RE = /\.(ts|tsx|js|jsx|scss)$/;
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.out', 'coverage']);

function listFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => !IGNORED_DIRS.has(entry.name));
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listFiles(full, out);
        else out.push(full);
    }
    return out;
}

const rel = file => path.relative(ROOT, file).split(path.sep).join('/');

// This file holds the detectors' own fixture strings — the literal forms they are built to find —
// so scanning it would report itself. It is the single exclusion, asserted below.
const DETECTOR_FIXTURES = path.join(__dirname, 'test-suite-hygiene.spec.js');

const ALL_SPEC_FILES = SCAN_ROOTS.flatMap(root => listFiles(path.join(ROOT, root))).filter(file => SPEC_RE.test(file));
const SPEC_FILES = ALL_SPEC_FILES.filter(file => file !== DETECTOR_FIXTURES);

describe('test corpus: the scanned corpus (TSH-002)', () => {
    it('[TSH-002] scans the whole Jest corpus, excluding only this file of detector fixtures', () => {
        expect(fs.existsSync(DETECTOR_FIXTURES)).toBe(true);
        expect(ALL_SPEC_FILES).toContain(DETECTOR_FIXTURES);
        expect(ALL_SPEC_FILES.length - SPEC_FILES.length).toBe(1);
        expect(SPEC_FILES.length).toBeGreaterThan(400);
    });
});

// ---------------------------------------------------------------------------------------------
// TSH-002 — no test may be added to confirm a removal
// ---------------------------------------------------------------------------------------------

// Collapsed whitespace, so multi-line `expect(...)` formatting cannot hide a pin from the patterns.
const flatten = source => source.replace(/\s+/g, ' ');

/**
 * The assertion forms whose only possible subject is absent code. Each is anchored tightly enough
 * that a negative assertion about a RUNTIME value — a built URL, rendered DOM, a returned config, a
 * stylesheet declaration — cannot match: the pinned thing has to be a path, a module specifier, a
 * member name or a dedicated absence helper.
 *
 * Known limitation: a source-text token pin (read a `.ts` file, assert `.not.toContain('X')`) needs
 * dataflow to separate from the legitimate `expect(result).not.toContain(...)` next to it in the
 * same file, so it is not detected here. The removal-advertising filename guard below is what
 * catches a file written to do that.
 */
// A call argument list, allowing one level of nesting: `existsSync(path.join(ROOT, 'x'))`.
const ARGS = '(?:[^()]|\\([^()]*\\))*';

const ABSENCE_PINS = [
    {
        label: 'asserts a path does not exist',
        pattern: new RegExp(
            `expect\\( *[\\w.]*existsSync\\(${ARGS}\\) *\\) *\\. *(?:toBe\\( *false *\\)|toBeFalsy\\(\\))`
        ),
    },
    {
        label: 'asserts a module fails to resolve',
        pattern: new RegExp(
            `expect\\( *(?:async )?\\( *\\) *=> *(?:require|import|jest\\.requireActual)\\(${ARGS}\\) *\\) *(?:\\. *rejects)? *\\. *(?:toThrow|rejects)`
        ),
    },
    {
        label: 'asserts a member is not present on an instance',
        pattern: /expect\( *'[A-Za-z_$][\w$]*' +in +[\w.$]+ *\) *\. *(?:toBe\( *false *\)|toBeFalsy\(\))/,
    },
    {
        label: 'uses a dedicated absence-pinning helper',
        pattern: /\bexpect(?:Gone|Present)\b/,
    },
];

/**
 * A spec file whose NAME advertises that its subject is a removal — the shape of every sweep spec
 * TSH-001 deleted (`dead-code-sweep`, `mobile-bridge-removal`, `smc-016-cleanup`, `dead-helpers`).
 */
const REMOVAL_ADVERTISING_NAME = /(?:^|[-.])(?:dead|removal|removed|cleanup|sweep|absence)(?:[-.]|$)/i;

const specBaseName = file => path.basename(file).replace(SPEC_RE, '');

function findAbsencePins(files = SPEC_FILES) {
    const offenders = [];
    for (const file of files) {
        const flat = flatten(fs.readFileSync(file, 'utf8'));
        for (const { label, pattern } of ABSENCE_PINS) {
            if (pattern.test(flat)) offenders.push(`${rel(file)} — ${label}`);
        }
    }
    return offenders;
}

describe('test corpus: no test confirms a removal (TSH-002)', () => {
    it('[TSH-002] no spec asserts that code is absent', () => {
        // Deletions are proven by the build, by the knip ratchet and by the pre-existing suites
        // staying green. A third proof is maintenance cost on every later refactor of a neighbour.
        expect(findAbsencePins()).toEqual([]);
    });

    it('[TSH-002] no spec file is named after the removal it confirms', () => {
        const offenders = SPEC_FILES.filter(file => REMOVAL_ADVERTISING_NAME.test(specBaseName(file))).map(rel);

        expect(offenders).toEqual([]);
    });

    it('[TSH-002] the detector recognises the pinned forms and leaves live-behaviour negatives alone', () => {
        // Without this, an over-tightened pattern would make the sweep above silently vacuous.
        const pins = [
            'expect(fs.existsSync(MODULE_PATH)).toBe(false);',
            "expect(fs.existsSync(path.join(ROOT, 'packages/api-v2'))).toBeFalsy();",
            "expect(() => require('../deleted-module')).toThrow();",
            "expect(async () => import('@deriv/api-v2')).rejects.toThrow();",
            "expect('frozen_chart_controls' in store).toBe(false);",
            "expect(\n    'is_dtrader_v2' in trade_store\n).toBeFalsy();",
            "expectGone('packages/api-v2/src/index.ts');",
        ];
        pins.forEach(sample => expect(ABSENCE_PINS.some(({ pattern }) => pattern.test(flatten(sample)))).toBe(true));

        const live_behaviour = [
            'expect(fs.existsSync(bin)).toBe(true);',
            'expect(config).not.toHaveProperty(trade_type);',
            "expect(readDeclarations('&__chevron')).not.toMatch(/flex-shrink/);",
            "expect(result).not.toContain('date_expiry');",
            "expect('deposit' in payload).toBe(true);",
            'expect(() => store.setInitialRouteHistoryItem(location)).not.toThrow();',
        ];
        live_behaviour.forEach(sample =>
            expect(ABSENCE_PINS.some(({ pattern }) => pattern.test(flatten(sample)))).toBe(false)
        );
    });

    it('[TSH-002] the filename guard recognises the sweep specs the cleanup deleted', () => {
        const removed_spec_names = [
            'dead-code-sweep',
            'dead-helpers',
            'mobile-bridge-removal',
            'smc-016-cleanup',
            'feature-flags-subsystems-removed',
        ];
        removed_spec_names.forEach(name => expect(REMOVAL_ADVERTISING_NAME.test(name)).toBe(true));

        // Names of surviving specs must not trip it.
        ['common-store', 'purchase-button', 'use-onclickoutside', 'baseline-check', 'currency'].forEach(name =>
            expect(REMOVAL_ADVERTISING_NAME.test(name)).toBe(false)
        );
    });
});

// ---------------------------------------------------------------------------------------------
// TSH-003 — a spec file is named after the module it tests
// ---------------------------------------------------------------------------------------------

/** Strips separator style and casing, so `risk_management-picker` and `RiskManagementPicker` meet. */
const normalizeName = name => name.toLowerCase().replace(/[-_.]/g, '');

function editDistance(a, b) {
    const rows = [];
    for (let i = 0; i <= a.length; i++) {
        rows[i] = [i];
        for (let j = 1; j <= b.length; j++) {
            rows[i][j] =
                i === 0
                    ? j
                    : Math.min(
                          rows[i - 1][j] + 1,
                          rows[i][j - 1] + 1,
                          rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                      );
        }
    }
    return rows[a.length][b.length];
}

/** The directory whose modules a spec is a sibling of: `__tests__`'s parent, else its own folder. */
function subjectDir(spec) {
    const dir = path.dirname(spec);
    return path.basename(dir) === '__tests__' ? path.dirname(dir) : dir;
}

function siblingModuleNames(spec) {
    const dir = subjectDir(spec);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && MODULE_RE.test(entry.name) && !SPEC_RE.test(entry.name))
        .map(entry => entry.name.replace(MODULE_RE, ''));
}

/**
 * Specs whose name is a NEAR MISS of a sibling module's: the same name up to separator style or
 * casing, or one character off. Either is a misnamed spec — a typo (`arrow-buton`) or the wrong
 * separator convention (`risk_management-picker`). A spec that matches no sibling closely is a
 * deliberately topic-scoped spec of a larger module, which TSH-003 permits.
 */
function findNearMissSpecNames(files = SPEC_FILES) {
    const offenders = [];
    for (const spec of files) {
        const base = specBaseName(spec);
        const siblings = siblingModuleNames(spec);
        // An exact sibling match is correct naming; only a near miss is an offence.
        const near = siblings.includes(base)
            ? []
            : siblings.filter(
                  sibling =>
                      normalizeName(sibling) === normalizeName(base) ||
                      editDistance(normalizeName(sibling), normalizeName(base)) === 1
              );
        if (near.length) offenders.push(`${rel(spec)} — should be named after ${[...new Set(near)].join(' / ')}`);
    }
    return offenders;
}

/**
 * Specs carrying the JSX extension while holding no JSX. TSH-003 wants the extension to track the
 * content; the list below is the pre-existing set this requirement inherited, held as a shrinking
 * ratchet (the same contract as the knip baseline): a NEW offender fails, and so does a FIXED one,
 * which is what makes the list shrink with the fix instead of drifting.
 */
const JSX_EXTENSION_RATCHET = [
    'packages/api/src/hooks/__tests__/useDebounce.spec.tsx',
    'packages/api/src/hooks/__tests__/useLocalStorageData.spec.tsx',
    'packages/reports/src/Hooks/__tests__/useIsEuAccount.spec.tsx',
    'packages/trader/src/AppV2/Components/TradeParameters/Multiplier/__tests__/commission-formula.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useAutomationConfig.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useContractDetails.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useGuideContractTypes.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useIsAutomationEnabled.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useIsEuAccount.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useLiveTick.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useMarketSelection.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useOrderDetails.spec.tsx',
    'packages/trader/src/AppV2/Hooks/__tests__/useTabletLandscape.spec.tsx',
    'packages/trader/src/Modules/SmartChart/Hooks/__tests__/useBarrierTouchDrag.spec.tsx',
];

// An opening element (`<Foo`, `<div`) or a fragment — enough to tell a JSX file from a plain one.
const JSX_RE = /<[A-Za-z][\w.]*[\s/>]|<>/;

const containsJsx = file => JSX_RE.test(fs.readFileSync(file, 'utf8'));

describe('test corpus: spec names track the module under test (TSH-003)', () => {
    it('[TSH-003] no spec name is a near miss of a sibling module name', () => {
        expect(findNearMissSpecNames()).toEqual([]);
    });

    it('[TSH-003] the near-miss detector flags a typo and a separator mismatch, not a topic-scoped spec', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsh-003-'));
        const tests_dir = path.join(dir, '__tests__');
        fs.mkdirSync(tests_dir);
        fs.writeFileSync(path.join(dir, 'arrow-button.tsx'), 'export default 1;\n');
        fs.writeFileSync(path.join(dir, 'risk-management-picker.tsx'), 'export default 1;\n');

        try {
            const typo = path.join(tests_dir, 'arrow-buton.spec.tsx');
            fs.writeFileSync(typo, '');
            expect(findNearMissSpecNames([typo])).toHaveLength(1);
            expect(findNearMissSpecNames([typo])[0]).toContain('arrow-button');

            const wrong_separator = path.join(tests_dir, 'risk_management-picker.spec.tsx');
            fs.writeFileSync(wrong_separator, '');
            expect(findNearMissSpecNames([wrong_separator])).toHaveLength(1);

            // Exact match, and a topic-scoped spec of a larger module: both allowed.
            const exact = path.join(tests_dir, 'arrow-button.spec.tsx');
            fs.writeFileSync(exact, '');
            const topic_scoped = path.join(tests_dir, 'commission-formula.spec.tsx');
            fs.writeFileSync(topic_scoped, '');
            expect(findNearMissSpecNames([exact, topic_scoped])).toEqual([]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('[TSH-003] the JSX extension is carried only by specs that contain JSX', () => {
        const offenders = SPEC_FILES.filter(file => /\.spec\.(tsx|jsx)$/.test(file) && !containsJsx(file)).map(rel);

        // Equality in BOTH directions: a new offender fails, and so does a fixed one, whose fix must
        // shrink the ratchet in the same change.
        expect(offenders.sort()).toEqual([...JSX_EXTENSION_RATCHET].sort());
    });

    it('[TSH-003] the JSX detector separates a JSX spec from a plain one', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsh-003-jsx-'));
        try {
            const jsx = path.join(dir, 'a.spec.tsx');
            fs.writeFileSync(jsx, "render(<Foo bar='1' />);\n");
            expect(containsJsx(jsx)).toBe(true);

            const fragment = path.join(dir, 'b.spec.tsx');
            fs.writeFileSync(fragment, 'render(<>{children}</>);\n');
            expect(containsJsx(fragment)).toBe(true);

            const plain = path.join(dir, 'c.spec.ts');
            fs.writeFileSync(plain, 'expect(a < b).toBe(true);\nexpect(1 <2).toBe(true);\n');
            expect(containsJsx(plain)).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------------------------
// TSH-004 — no Jest test is left skipped without a recorded reason
// ---------------------------------------------------------------------------------------------

const SKIP_FORMS = /\b(?:describe|it|test)\.skip\b|\bx(?:it|describe)\s*\(|\bit\.todo\b/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;
const REASON_LOOKBACK = 3;

/**
 * Every skipped/pending Jest test, paired with whether a reason is recorded next to it — an inline
 * trailing comment, or a comment within the three lines above it. A runtime guard that ends a run
 * early on an environment condition (`test.skip(is_mobile, '…')` in playwright/) is a different
 * construct and is not scanned: this only looks at the `packages/` + `scripts/` Jest corpus.
 */
function findSkippedTests(files = SPEC_FILES) {
    const skips = [];
    for (const file of files) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
            if (!SKIP_FORMS.test(line)) return;
            const inline_reason = /\/\/.+$/.test(line.replace(SKIP_FORMS, ''));
            const preceding = lines.slice(Math.max(0, index - REASON_LOOKBACK), index);
            const has_reason = inline_reason || preceding.some(previous => COMMENT_LINE.test(previous));
            skips.push({ location: `${rel(file)}:${index + 1}`, text: line.trim(), has_reason });
        });
    }
    return skips;
}

describe('test corpus: no unexplained skip (TSH-004)', () => {
    it('[TSH-004] every skipped or pending Jest test carries a recorded reason', () => {
        const unexplained = findSkippedTests()
            .filter(skip => !skip.has_reason)
            .map(skip => skip.location);

        // A test that cannot be made to pass is fixed or deleted, never parked silently.
        expect(unexplained).toEqual([]);
    });

    it('[TSH-004] the skip scanner sees each pending form and reads an adjacent reason', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsh-004-'));
        try {
            const parked = path.join(dir, 'parked.spec.ts');
            fs.writeFileSync(
                parked,
                [
                    "describe.skip('a', () => {});",
                    "it.skip('b', () => {});",
                    "xit('c', () => {});",
                    "xdescribe('d', () => {});",
                    "it.todo('e');",
                ].join('\n')
            );
            const parked_skips = findSkippedTests([parked]);
            expect(parked_skips).toHaveLength(5);
            expect(parked_skips.every(skip => skip.has_reason)).toBe(false);

            const explained = path.join(dir, 'explained.spec.ts');
            fs.writeFileSync(
                explained,
                [
                    '// Skipped: the mapper branch under test is commented out.',
                    "it.skip('a', () => {});",
                    '',
                    "it.skip('b', () => {}); // Skipped: awaiting the API field.",
                ].join('\n')
            );
            expect(findSkippedTests([explained]).every(skip => skip.has_reason)).toBe(true);

            const clean = path.join(dir, 'clean.spec.ts');
            fs.writeFileSync(clean, "it('runs', () => {});\n");
            expect(findSkippedTests([clean])).toEqual([]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------------------------
// TSH-005 — deleting specs is reflected in the committed dead-code baseline
// ---------------------------------------------------------------------------------------------

/**
 * A knip finding is either `file <path>` or `<issueType> <path> <name>`, so the path is always the
 * field that carries a `/`. Returns the repo-relative paths a baseline claims findings for.
 */
function baselinePaths(findings) {
    return findings.map(finding => {
        const fields = finding.split(' ');
        return fields[0] === 'file' ? fields[1] : fields[1];
    });
}

const findingsForMissingFiles = findings =>
    findings.filter(finding => !fs.existsSync(path.join(ROOT, baselinePaths([finding])[0])));

describe('dead-code baseline tracks the tree that ships (TSH-005)', () => {
    const committed = fs.readFileSync(BASELINE_PATH, 'utf8');
    const { findings } = JSON.parse(committed);

    it('[TSH-005] the committed baseline names no file the tree no longer has', () => {
        // Deleting a spec changes the finding set. If the baseline still names a deleted file, it was
        // not regenerated in the change that deleted it — which is the exact drift TSH-005 forbids.
        expect(findingsForMissingFiles(findings)).toEqual([]);
    });

    it('[TSH-005] the committed baseline is exactly what the pinned tool writes', () => {
        // Byte-identical to `knip:baseline` output: sorted, de-duplicated, 4-space JSON, trailing
        // newline. A hand-edited or partially-regenerated baseline fails here.
        expect(committed).toBe(serializeBaseline(findings));
        expect(findings).toEqual([...findings].sort());
        expect(new Set(findings).size).toBe(findings.length);
    });

    it('[TSH-005] the staleness detector catches a finding left behind by a deleted spec', () => {
        const deleted_spec_finding =
            'unlisted packages/core/src/Stores/__tests__/smc-016-cleanup.spec.ts @deriv/shared';

        expect(findingsForMissingFiles([deleted_spec_finding])).toEqual([deleted_spec_finding]);
        // And a finding for a file that does exist is not reported.
        expect(findingsForMissingFiles(['file scripts/knip-check.js'])).toEqual([]);
    });
});
