import { configure } from 'mobx';

import { BARRIER_COLORS } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import ContractStore from '../contract-store';

configure({ safeDescriptors: false });

const buildStore = () => new ContractStore(mockStore({}), { contract_id: 123 });

describe('ContractStore.createBarriersArray', () => {
    // CALL is barrier-supported and not a SmartTrader contract, so the barrier colour follows the
    // theme (matching the main-barrier update path) rather than the SmartTrader blue.
    const contract_info = { contract_type: 'CALL', barrier: '1234', entry_spot: '1200', profit: 5 };

    it('[ABF-008] applies the dark-mode barrier colour when is_dark_mode is true', () => {
        const store = buildStore();

        const barriers = store.createBarriersArray(contract_info, true);

        expect(barriers).toHaveLength(1);
        expect(barriers[0].color).toBe(BARRIER_COLORS.GRAY);
        expect(barriers[0].foregroundColor).toBe(BARRIER_COLORS.GRAY);
    });

    it('[ABF-008] applies the light-mode barrier colour when is_dark_mode is false', () => {
        const store = buildStore();

        const barriers = store.createBarriersArray(contract_info, false);

        expect(barriers).toHaveLength(1);
        expect(barriers[0].color).toBe(BARRIER_COLORS.BLACK);
        expect(barriers[0].foregroundColor).toBe(BARRIER_COLORS.BLACK);
    });
});
