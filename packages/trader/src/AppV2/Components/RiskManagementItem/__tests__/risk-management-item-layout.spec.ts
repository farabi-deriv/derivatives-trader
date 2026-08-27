import fs from 'fs';
import path from 'path';

// Layout contract for the Contract Details Take profit / Stop loss editor sheet. jsdom does no
// layout, so "the sheet has no empty white band" lives in the stylesheet and is asserted here: the
// Quill sheet root carries no height of its own, so whatever this content class declares *is* the
// sheet height. It used to reserve 23.6rem for an `ActionSheet.Footer` Save button that #1169
// removed (the commit action moved to the header), and `space-between` then pushed the Total
// profit/loss row to the bottom of that over-tall box — the band reported in issue #1226.
// Comments are stripped so an assertion reads the declarations, not the prose about them (the rules
// below are explained in comments that quote the very properties being asserted).
const STYLESHEET = fs
    .readFileSync(path.resolve(__dirname, '../risk-management-item.scss'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

/** The first block opened by `selector`, with its nested blocks (and their selectors) removed — so
 *  an assertion reads only the declarations that apply to `selector` itself. */
const readDeclarations = (selector: string) => {
    const start = STYLESHEET.indexOf(`${selector} {`);
    expect(start).toBeGreaterThanOrEqual(0);
    const open = STYLESHEET.indexOf('{', start);

    let depth = 0;
    let end = -1;
    for (let i = open; i < STYLESHEET.length; i++) {
        if (STYLESHEET[i] === '{') depth += 1;
        else if (STYLESHEET[i] === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }
    if (end === -1) throw new Error(`Unbalanced braces after "${selector}" in risk-management-item.scss`);

    let nesting = 0;
    return STYLESHEET.slice(open + 1, end)
        .split('\n')
        .filter(line => {
            const opens = (line.match(/{/g) ?? []).length;
            const closes = (line.match(/}/g) ?? []).length;
            const was_top_level = nesting === 0;
            nesting += opens - closes;
            return was_top_level && opens === 0;
        })
        .join('\n');
};

describe('take profit / stop loss editor sheet layout', () => {
    it('does not pin the sheet to a fixed height, so it hugs whatever rows it renders', () => {
        // A `rem`/`px` height here is the sheet's height: it cannot shrink when the Total
        // profit/loss row is absent, nor grow for a validation message, and the leftover is the
        // white band. `height: auto` is the post-#1169 form used by every other AppV2 sheet.
        const content = readDeclarations('&__action-sheet-content');
        expect(content).not.toMatch(/height:\s*[\d.]+(rem|px|em|vh|dvh)/);
        expect(content).not.toMatch(/min-height/);
    });

    it('flows its rows top-down instead of distributing them to opposite sheet edges', () => {
        // `space-between` is what pushed Total profit/loss to the bottom of the over-tall box. It is
        // a no-op once the box is content-sized, but keeping it re-encodes that intent and would
        // resurrect the band the moment any height re-entered the block.
        const content = readDeclarations('&__action-sheet-content');
        expect(content).not.toMatch(/justify-content/);
        // The rows are held apart by one standard gap rather than by the box being too tall.
        expect(content).toMatch(/gap:\s*var\(--core-spacing-800\)/);
    });

    it('leaves the bottom padding to quill now that no footer sits below the content', () => {
        // The old `padding: sm md 0` zeroed the bottom because `ActionSheet.Footer` supplied it.
        // With the footer gone, only the top is overridden and quill's `.action-sheet--content`
        // padding provides the inline and bottom spacing — the same rule as `.risk-management__picker`.
        const content = readDeclarations('&__action-sheet-content');
        expect(content).toMatch(/padding-block-start:\s*0/);
        expect(content).not.toMatch(/^\s*padding:/m);
    });

    it('keeps Total profit/loss in flow inside the sheet rather than sticky at its top', () => {
        // `total-profit-loss.scss` makes the row sticky with its own background and padding for the
        // contract card; inside the sheet it is just another row, and these resets are what make it
        // read that way. They are unrelated to the height fix and must survive it.
        const total_profit_loss = readDeclarations('.total-profit-loss');
        expect(total_profit_loss).toMatch(/position:\s*relative/);
        expect(total_profit_loss).toMatch(/inset:\s*unset/);
        expect(total_profit_loss).toMatch(/background-color:\s*unset/);
        expect(total_profit_loss).toMatch(/padding:\s*unset/);
    });
});
