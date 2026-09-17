import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';

import useAutomationConfig from 'AppV2/Hooks/useAutomationConfig';
import { useAutomationStore } from 'Stores/useAutomationStore';
import { useTraderStore } from 'Stores/useTraderStores';

import { DEFAULT_MULTIPLIER_BOUNDS, KNOWN_PARAM_KEYS } from '../automation-config';
import AutomationPanel from '../automation-panel';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    trackAutomationSectionViewed: jest.fn(),
    trackTradeTypeSwitched: jest.fn(),
}));

jest.mock('Stores/useTraderStores', () => ({ useTraderStore: jest.fn() }));
jest.mock('Stores/useAutomationStore', () => ({ useAutomationStore: jest.fn() }));
jest.mock('AppV2/Hooks/useAutomationConfig', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('AppV2/Hooks/useAutomationLockedSnackbar', () => ({ __esModule: true, default: () => jest.fn() }));

const mockUseTraderStore = useTraderStore as jest.Mock;
const mockUseAutomationStore = useAutomationStore as jest.Mock;
const mockUseAutomationConfig = useAutomationConfig as unknown as jest.Mock;
const mockUseDevice = useDevice as jest.Mock;

const config = { strategy: 'martingale', strategy_params: {} };

const automation_config = {
    strategy_options: [{ value: 'martingale', label: 'Martingale', description: '' }],
    selected_strategy: undefined,
    strategy_description: '',
    schema_keys: new Set([
        KNOWN_PARAM_KEYS.MULTIPLIER,
        KNOWN_PARAM_KEYS.MAX_STAKE,
        KNOWN_PARAM_KEYS.TAKE_PROFIT,
        KNOWN_PARAM_KEYS.STOP_LOSS,
    ]),
    getSchemaDescription: () => undefined,
    // A constant, matching the real hook's per-key caching (consumers memoise on identity).
    getParamBounds: () => DEFAULT_MULTIPLIER_BOUNDS,
    getParamNumber: () => 2,
    getParamNumberOrNull: () => 10,
    setParamFromNumber: jest.fn(),
    setParamFromNumberOrNull: jest.fn(),
    selectStrategy: jest.fn(),
};

// Strategy selector + one field per schema key (MULTIPLIER, MAX_STAKE, TAKE_PROFIT, STOP_LOSS).
const FIELD_COUNT = 5;

const base_trader_store = {
    amount: 10,
    contract_type: 'CALL',
    currency: 'USD',
    is_automation_market_locked: false,
    is_symbol_automatable: true,
    symbol: '1HZ100V',
};

describe('AutomationPanel (desktop) market-closed disabling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseDevice.mockReturnValue({ isMobile: false });
        mockUseAutomationStore.mockReturnValue({ config });
        mockUseAutomationConfig.mockReturnValue(automation_config);
    });

    it('[ASP-001] disables every strategy and risk-management field on a closed market with no lock overlay', () => {
        mockUseTraderStore.mockReturnValue({
            ...base_trader_store,
            is_automation_params_locked: false,
            is_market_closed: true,
        });

        const { container } = render(<AutomationPanel />);

        const fields = screen.getAllByRole('textbox');
        expect(fields).toHaveLength(FIELD_COUNT);
        fields.forEach(field => expect(field).toBeDisabled());
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        expect(container.querySelector('.trade-params__lock-overlay')).toBeNull();
    });

    // Characterization: the automation lock is pre-existing behaviour; this pins that a live run
    // still disables the fields and shows the lock overlay, independent of market state.
    it('[ASP-003] keeps the automation-lock overlay while a run is active, even on a closed market', () => {
        mockUseTraderStore.mockReturnValue({
            ...base_trader_store,
            is_automation_market_locked: true,
            is_automation_params_locked: true,
            is_market_closed: true,
        });

        const { container } = render(<AutomationPanel />);

        screen.getAllByRole('textbox').forEach(field => expect(field).toBeDisabled());
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        expect(container.querySelector('.trade-params__lock-overlay')).not.toBeNull();
    });
});
