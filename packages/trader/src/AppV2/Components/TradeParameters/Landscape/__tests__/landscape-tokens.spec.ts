import fs from 'fs';
import path from 'path';

// Characterization guard (no red): pins the pill/panel to existing theme-aware tokens and the
// mandatory opaque backdrop-filter fallback, so a later edit can't paste light-only Figma hex
// (LTP-011) — which would leave glaring-white chips over a dark chart.
const scss = fs.readFileSync(path.resolve(__dirname, '../landscape-trade-params.scss'), 'utf8');

describe('landscape pill design tokens', () => {
    it('[LTP-011] maps the surfaces to existing semantic tokens, not light-only hex', () => {
        expect(scss).toContain('var(--semantic-color-monochrome-surface-normal-lowest)');
        expect(scss).toContain('var(--semantic-color-monochrome-surface-normal-low)');
        expect(scss).toContain('var(--semantic-color-monochrome-border-normal-mid)');
        expect(scss).toContain('var(--semantic-color-monochrome-border-normal-high)');
        expect(scss).toContain('var(--semantic-color-slate-solid-surface-frame-low)');

        expect(scss).not.toMatch(/#fff/i);
        expect(scss).not.toMatch(/#181c25/i);
    });

    it('[LTP-011] provides an opaque @supports fallback for both glass surfaces', () => {
        const fallbacks = scss.match(/@supports not \(\(backdrop-filter/g) ?? [];
        expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });
});
