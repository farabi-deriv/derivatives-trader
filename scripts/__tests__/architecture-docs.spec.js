/**
 * CSN-010 — the agent-facing architecture documentation (CLAUDE.md) must describe the store graph
 * that actually ships, and must carry the growth-stopping rule that keeps the Workstream C cleanup
 * from being undone.
 *
 * Lives in the root `scripts` Jest project (`npm run test:scripts`, a CI step) because its subject
 * spans a doc at the repo root and a source file in packages/core — it belongs to no one package.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const CLAUDE_MD = read('CLAUDE.md');
const ROOT_STORE_SOURCE = read('packages/core/src/Stores/index.js');

/**
 * The `{ member: StoreClass }` map RootStore's constructor actually builds.
 */
function constructedRootStoreMembers(source) {
    const constructor_body = source.slice(source.indexOf('constructor('));
    const members = {};
    for (const match of constructor_body.matchAll(/this\.(\w+)\s*=\s*new\s+(\w+)\s*\(/g)) {
        members[match[1]] = match[2];
    }
    return members;
}

/**
 * The member names on CLAUDE.md's inline `RootStore contains:` line.
 */
function documentedInlineMembers(markdown) {
    const line = markdown.match(/^- RootStore contains:\s*(.+)$/m);
    if (!line) return null;
    return line[1]
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
}

/**
 * The `{ member: StoreClass }` map CLAUDE.md's `## Store structure (RootStore modules)` bullets
 * declare, e.g. "- `client`: ClientStore (auth, user profile, accounts)".
 */
function documentedStoreBullets(markdown) {
    const [, after_heading] = markdown.split('## Store structure (RootStore modules)');
    if (!after_heading) return null;
    const section = after_heading.split('\n## ')[0];
    const members = {};
    for (const match of section.matchAll(/^- `(\w+)`:\s*(\w+)/gm)) {
        members[match[1]] = match[2];
    }
    return members;
}

function gotchasSection(markdown) {
    const [, after_heading] = markdown.split('\n# Gotchas\n');
    return after_heading ? after_heading.split('\n# ')[0] : null;
}

describe('CLAUDE.md matches the shipped store graph (CSN-010)', () => {
    const constructed = constructedRootStoreMembers(ROOT_STORE_SOURCE);

    it('[CSN-010] the extractors read a non-empty store graph out of both sides', () => {
        // Guards every set comparison below against passing vacuously on a parse miss.
        expect(Object.keys(constructed).length).toBeGreaterThan(5);
        expect(documentedInlineMembers(CLAUDE_MD)).not.toBeNull();
        expect(documentedStoreBullets(CLAUDE_MD)).not.toBeNull();
        expect(Object.keys(documentedStoreBullets(CLAUDE_MD)).length).toBeGreaterThan(5);
    });

    it('[CSN-010] the documented root-store member list equals what the constructor builds', () => {
        // Set equality in both directions: no documented member is absent from the code, and no
        // constructed member is missing from the documentation.
        expect(documentedInlineMembers(CLAUDE_MD).sort()).toEqual(Object.keys(constructed).sort());
    });

    it('[CSN-010] the store-structure bullets name the same members and the same store classes', () => {
        expect(documentedStoreBullets(CLAUDE_MD)).toEqual(constructed);
    });

    it('[CSN-010] the two documented lists agree with each other', () => {
        expect(documentedInlineMembers(CLAUDE_MD).sort()).toEqual(
            Object.keys(documentedStoreBullets(CLAUDE_MD)).sort()
        );
    });
});

describe('CLAUDE.md carries the growth-stopping rule (CSN-010)', () => {
    const gotchas = gotchasSection(CLAUDE_MD);

    it('[CSN-010] the gotchas section is where the rule is looked for', () => {
        expect(gotchas).not.toBeNull();
        expect(gotchas.length).toBeGreaterThan(200);
    });

    it('[CSN-010] the gotchas state that a new derived value is a computed, not an observable plus reaction', () => {
        expect(gotchas).toMatch(/a new derived value is a `computed`/i);
        expect(gotchas).toMatch(/never an observable kept in step by a reaction/i);
    });

    it('[CSN-010] the gotchas state that a new field has exactly one writer', () => {
        expect(gotchas).toMatch(/a new field has exactly one writer/i);
    });
});
