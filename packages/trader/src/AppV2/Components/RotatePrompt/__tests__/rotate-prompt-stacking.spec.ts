import fs from 'fs';
import path from 'path';

const APP_V2 = path.resolve(__dirname, '../../..');
const PROMPT_SCSS = path.resolve(__dirname, '../rotate-prompt.scss');

const scssFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return scssFiles(full);
        return entry.name.endsWith('.scss') ? [full] : [];
    });

const highestZIndex = (file: string) => {
    const declarations = fs.readFileSync(file, 'utf8').match(/z-index:\s*\d+/g) ?? [];
    return Math.max(0, ...declarations.map(declaration => Number(declaration.replace(/\D/g, ''))));
};

/**
 * The prompt is raised by a trade-type change made from inside the market selector, so it has to
 * cover that selector rather than slide under it. At 999 it did exactly that — invisible in the one
 * situation it exists for.
 *
 * Compared against every other AppV2 stylesheet rather than a hand-picked few: what can be on screen
 * when the prompt appears is not knowable in advance, and hardcoded sibling paths rot silently when
 * a component moves.
 */
describe('rotate prompt stacking', () => {
    it('[PPR-006] sits above every other AppV2 surface', () => {
        const [rival] = scssFiles(APP_V2)
            .filter(file => file !== PROMPT_SCSS)
            .map(file => ({ file: path.relative(APP_V2, file), z: highestZIndex(file) }))
            .sort((a, b) => b.z - a.z);

        // Compared as strings so a failure names the stylesheet that outranked it.
        const verdict = highestZIndex(PROMPT_SCSS) > rival.z ? 'above' : `below ${rival.file} (${rival.z})`;

        expect(verdict).toBe('above');
    });
});
