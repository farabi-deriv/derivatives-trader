import React from 'react';

import { act, render, screen } from '@testing-library/react';

import DurationUnitSelector from '../duration-unit-selector';

jest.mock('@deriv-com/translations', () =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../../../../../../../__mocks__/language-aware-translations.mock').createLanguageAwareTranslationsMock()
);

const { fireLanguageChanged } = jest.requireActual('@deriv-com/translations') as {
    fireLanguageChanged: (lang?: string) => void;
};

// Closes the [TPL-004] gap `duration.spec.tsx` can't reach: there `VerticalTabSelector`'s own
// `<Localize>` re-translates the label either way, so both implementations look identical. Severing
// the parent cascade leaves only the selector's own subscription to do the work.
describe('DurationUnitSelector under a severed re-render cascade', () => {
    // Stable props, so memo bails out on every parent render — nothing here re-renders from above.
    const MemoisedParent = React.memo(() => <DurationUnitSelector selectedUnit='t' onSelectUnit={jest.fn()} />);
    MemoisedParent.displayName = 'MemoisedParent';

    const Harness = () => {
        const [, forceParentRender] = React.useReducer(count => count + 1, 0);
        return (
            <div>
                <button onClick={forceParentRender} type='button'>
                    rerender parent
                </button>
                <MemoisedParent />
            </div>
        );
    };

    it('[TPL-004] re-translates its labels without an ancestor re-render', () => {
        render(<Harness />);

        expect(screen.getByRole('tab', { name: 'Ticks' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Seconds' })).toBeInTheDocument();

        act(() => fireLanguageChanged('ES'));

        // Fails against the pre-fix selector (module-level `localize` inside `useMemo(…, [])`): with
        // the cascade severed, nothing re-renders it, so the labels stay in the boot language.
        expect(screen.getByRole('tab', { name: 'ES_Ticks' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'ES_Seconds' })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Ticks' })).not.toBeInTheDocument();
    });

    it('[TPL-004] keeps the selected unit selected across the change', () => {
        render(<Harness />);

        expect(screen.getByRole('tab', { name: 'Ticks' })).toHaveAttribute('aria-selected', 'true');

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByRole('tab', { name: 'ES_Ticks' })).toHaveAttribute('aria-selected', 'true');
    });
});
