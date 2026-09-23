import React from 'react';
import fs from 'fs';
import path from 'path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PageOverlay from '../page-overlay';

const STYLESHEET = fs.readFileSync(path.resolve(__dirname, '../page-overlay.scss'), 'utf8');
const BLOCK = 'dc-page-overlay';

/** The source of a brace-matched nested block, e.g. everything inside `&__header { … }`. */
const blockSourceFor = (selector: string, source: string) => {
    const start = source.indexOf(`${selector} {`);
    if (start === -1) return null;
    let depth = 0;
    for (let index = source.indexOf('{', start); index < source.length; index++) {
        if (source[index] === '{') depth++;
        else if (source[index] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    return null;
};

/**
 * Every header class the stylesheet declares, resolved to the class name it emits: the `&-<name>`
 * modifiers nested inside `&__header`, plus any `&__header-<name>` written at the block's top level
 * (the grouped `&__header-wrapper, &__content` rule).
 */
const declaredHeaderClasses = (source: string) => {
    const header_block = blockSourceFor('&__header', source) ?? '';
    const nested = Array.from(header_block.matchAll(/&-([a-z0-9-]+)\s*{/g), match => match[1]);
    const top_level = Array.from(source.matchAll(/&__header-([a-z0-9-]+)\s*[,{]/g), match => match[1]);

    return [...new Set([...nested, ...top_level])].map(modifier => `${BLOCK}__header-${modifier}`).sort();
};

const classNamesInDom = (root: HTMLElement) => {
    const classes = new Set<string>();
    // eslint-disable-next-line testing-library/no-node-access
    root.querySelectorAll<HTMLElement>('[class]').forEach(node => {
        node.classList.forEach(name => classes.add(name));
    });
    return classes;
};

describe('<PageOverlay />', () => {
    it('renders the header, its wrapper and the close control', () => {
        render(<PageOverlay header='Statement'>content</PageOverlay>);

        expect(screen.getByText('Statement')).toBeInTheDocument();
        expect(screen.getByTestId('dt_page_overlay_header_close')).toBeInTheDocument();
        expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('omits the close control when the page is opened from the app', () => {
        render(
            <PageOverlay header='Statement' is_from_app>
                content
            </PageOverlay>
        );

        expect(screen.queryByTestId('dt_page_overlay_header_close')).not.toBeInTheDocument();
    });

    it('calls onClickClose when the close control is pressed', async () => {
        const onClickClose = jest.fn();
        render(
            <PageOverlay header='Statement' onClickClose={onClickClose}>
                content
            </PageOverlay>
        );

        await userEvent.click(screen.getByTestId('dt_page_overlay_header_close'));

        expect(onClickClose).toHaveBeenCalledTimes(1);
    });

    /**
     * DCR-054 closed out the Traders-Hub cosmetic naming by deleting the one surviving residue: a
     * `&-tradershub` modifier on this header that no component emitted. This is the invariant that
     * kept it findable, stated positively so it holds for every future modifier too — a header
     * modifier the stylesheet declares must be a class the component actually puts in the DOM.
     */
    describe('[DCR-054] the header stylesheet declares no consumer-less modifier', () => {
        it('[DCR-054] reads the header modifiers it is meant to check', () => {
            const declared = declaredHeaderClasses(STYLESHEET);

            expect(declared).toEqual(
                expect.arrayContaining([`${BLOCK}__header-close`, `${BLOCK}__header-title`, `${BLOCK}__header-wrapper`])
            );
            expect(declared.length).toBeGreaterThanOrEqual(3);
        });

        it('[DCR-054] every declared header modifier is emitted by the rendered overlay', () => {
            const view = render(<PageOverlay header='Statement'>content</PageOverlay>);
            const emitted = classNamesInDom(view.container);

            const orphans = declaredHeaderClasses(STYLESHEET).filter(name => !emitted.has(name));

            expect(orphans).toEqual([]);
        });

        it('[DCR-054] the orphan check would catch a modifier no component emits', () => {
            const with_orphan = STYLESHEET.replace(
                '&-title {',
                '&-tradershub {\n            padding: 0.8rem;\n        }\n        &-title {'
            );
            const view = render(<PageOverlay header='Statement'>content</PageOverlay>);
            const emitted = classNamesInDom(view.container);

            expect(declaredHeaderClasses(with_orphan).filter(name => !emitted.has(name))).toEqual([
                `${BLOCK}__header-tradershub`,
            ]);
        });
    });
});
