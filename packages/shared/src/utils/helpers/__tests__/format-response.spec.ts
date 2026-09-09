import * as FormatResponse from '../format-response';
import { formatPortfolioPosition } from '../format-response';
import { CONTRACT_TYPES } from '../../contract';

describe('format-response', () => {
    const portfolio_pos = {
        buy_price: '2500.5',
        contract_id: 1234,
        contract_type: CONTRACT_TYPES.ASIAN.UP,
        longcode: 'test \n test \n test',
        payout: '3500.1',
        underlying_symbol: 'R_25',
        shortcode: 'ASIANU_R_25_',
        transaction_id: 5678,
    };

    it('should return an object with values in object passed as argument to formatPortfolioPosition', () => {
        expect(formatPortfolioPosition(portfolio_pos)).toEqual({
            details: 'test <br /> test <br /> test',
            display_name: 'Volatility 25 Index',
            id: 1234,
            indicative: 0,
            payout: '3500.1',
            contract_update: undefined,
            purchase: '2500.5',
            reference: +5678,
            type: CONTRACT_TYPES.ASIAN.UP,
            contract_info: portfolio_pos,
        });
    });

    it('[DCR-013] no longer exports filterDisabledPositions', () => {
        expect(FormatResponse).not.toHaveProperty('filterDisabledPositions');
    });
});
