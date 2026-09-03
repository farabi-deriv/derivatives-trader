const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Packages that copy static assets into their bundle declare the sources as
// `path.resolve(__dirname, '<relative>')` inside build/config.js. CopyPlugin fails the whole
// webpack build with `unable to locate '<abs path>' glob` when a source no longer exists, and
// that failure surfaces only in CI's Build job — never in jest, tsc, lint or knip. This guard
// catches a deletion PR that removes a committed asset but leaves its copy pattern behind.
const BUILD_CONFIGS = [
    'packages/core/build/config.js',
    'packages/trader/build/config.js',
    'packages/reports/build/config.js',
];

// Sources under node_modules are install/build outputs, not committed files: the sibling-workspace
// dist copies (@deriv/trader, @deriv/reports) only exist once build:all has run. Their existence is
// a build-ordering property, asserted by the Build job itself, so this tree-level guard skips them.
const isCommittedSource = relative_path => !relative_path.split(path.sep).includes('node_modules');

const collectRequiredSources = source => {
    // Each pattern object spans a few lines; `noErrorOnMissing: true` opts a pattern out of the
    // existence requirement, so pair every `from:` with the text that follows it up to the next one.
    const pattern = /from:\s*path\.resolve\(__dirname, '([^']+)'\)([\s\S]*?)(?=from:\s*path\.resolve|$)/g;

    return [...source.matchAll(pattern)]
        .filter(([, , trailing]) => !/noErrorOnMissing:\s*true/.test(trailing))
        .map(([, relative_path]) => relative_path)
        .filter(isCommittedSource);
};

const configs_with_sources = BUILD_CONFIGS.map(config => {
    const config_path = path.resolve(ROOT, config);

    if (!fs.existsSync(config_path)) return null;

    const sources = collectRequiredSources(fs.readFileSync(config_path, 'utf8'));

    return sources.length ? [config, path.dirname(config_path), sources] : null;
}).filter(Boolean);

describe('CopyPlugin asset sources', () => {
    it('finds at least one build config declaring copy sources', () => {
        // Guards the guard: a parser or path change that silently matched nothing would make every
        // assertion below vacuous.
        expect(configs_with_sources.length).toBeGreaterThan(0);
    });

    it.each(configs_with_sources)(
        '[CPS-001] every required copy source in %s exists on disk',
        (_config, config_dir, sources) => {
            const missing = sources.filter(relative_path => !fs.existsSync(path.resolve(config_dir, relative_path)));

            expect(missing).toEqual([]);
        }
    );
});
