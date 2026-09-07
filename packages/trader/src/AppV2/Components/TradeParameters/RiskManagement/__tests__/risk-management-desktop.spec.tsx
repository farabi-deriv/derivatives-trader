import { mockStore } from '@deriv/stores';
import { act, render, screen } from '@testing-library/react';

import TraderProviders from '../../../../../trader-providers';
import RiskManagementDesktop from '../risk-management-desktop';

// The shared translations mock is identity-like, so it cannot express one key in two languages.
// `createLanguageAwareTranslationsMock` layers language awareness over it; see that helper for why
// each part of it matters to this fix. Required lazily because `jest.mock` is hoisted above imports.
jest.mock('@deriv-com/translations', () =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../../../../../../../__mocks__/language-aware-translations.mock').createLanguageAwareTranslationsMock()
);

const { fireLanguageChanged } = jest.requireActual('@deriv-com/translations') as {
    fireLanguageChanged: (lang?: string) => void;
};

describe('RiskManagementDesktop language switch', () => {
    const buildStore = (trade_overrides: Record<string, unknown> = {}) =>
        mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    currency: 'USD',
                    ...trade_overrides,
                },
            },
        });

    const renderRiskManagement = (store: ReturnType<typeof mockStore>) =>
        render(
            <TraderProviders store={store}>
                <RiskManagementDesktop />
            </TraderProviders>
        );

    it('[TPL-002] re-translates the deal-cancellation unit once the new language is available', () => {
        renderRiskManagement(buildStore({ has_cancellation: true, cancellation_duration: 5 }));

        expect(screen.getByRole('textbox')).toHaveValue('DC: 5 minutes');

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByRole('textbox')).toHaveValue('DC: 5 ES_minutes');
    });

    it('[TPL-002] leaves a take profit value untouched by a language switch', () => {
        renderRiskManagement(buildStore({ has_take_profit: true, take_profit: '5' }));

        expect(screen.getByRole('textbox')).toHaveValue('TP: $5');

        act(() => fireLanguageChanged('ES'));

        expect(screen.getByRole('textbox')).toHaveValue('TP: $5');
    });
});
