import { expect } from '@playwright/test';
import { TradeDigitsPage } from './TradeDigitsPage';

/**
 * Page Object for the Over/Under digit contract type on the trade page (/).
 *
 * Thin subclass of {@link TradeDigitsPage} — all digit behaviour (selector, ticks duration,
 * settle-in-place verification chain) lives in the base; this class only names the two outcomes.
 *
 * Note on invalid digits (last-digit-prediction.tsx): Over cannot predict digit 9 and Under cannot
 * predict digit 0. Use a middle digit such as "5" which is valid for both outcomes.
 *
 * @example
 * ```typescript
 * test('VERIFY Buy "Over" Contract', async ({ tradeOverUnderPage }) => {
 *     await tradeOverUnderPage.buyOverAndVerify({
 *         market: 'Volatility 10 Index',
 *         durationValue: '10 ticks',
 *         stake: '10.00',
 *         currency: 'USD',
 *         digit: '5',
 *     });
 * });
 * ```
 */
export class TradeOverUnderPage extends TradeDigitsPage {
    /**
     * Full Over contract flow: buy Over → settle in place → verify the closed contract in the
     * Positions Closed tab, contract details, balance, and Reports (Trade table + Statement).
     *
     * @param accountType   - Account to trade on: 'real' or 'demo'
     * @param market        - Digits market symbol (e.g. 'Volatility 10 Index')
     * @param durationValue - Ticks chip label (e.g. '10 ticks')
     * @param stake         - Stake amount as a string (e.g. '10.00')
     * @param currency      - Currency code (e.g. 'USD')
     * @param digit         - Last-digit prediction "0"–"8" (9 is invalid for Over)
     */
    async buyOverAndVerify(params: {
        accountType: 'real' | 'demo';
        market: string;
        durationValue: string;
        stake: string;
        currency: string;
        digit: string;
    }): Promise<void> {
        await this.buyDigitContractAndVerify({
            tradeTypeLabel: 'Over/Under',
            prediction: 'Over',
            position: 'top',
            ...params,
        });
    }

    /**
     * Full Under contract flow: buy Under → settle in place → verify the closed contract in the
     * Positions Closed tab, contract details, balance, and Reports (Trade table + Statement).
     *
     * @param accountType   - Account to trade on: 'real' or 'demo'
     * @param market        - Digits market symbol (e.g. 'Volatility 10 Index')
     * @param durationValue - Ticks chip label (e.g. '10 ticks')
     * @param stake         - Stake amount as a string (e.g. '10.00')
     * @param currency      - Currency code (e.g. 'USD')
     * @param digit         - Last-digit prediction "1"–"9" (0 is invalid for Under)
     */
    async buyUnderAndVerify(params: {
        accountType: 'real' | 'demo';
        market: string;
        durationValue: string;
        stake: string;
        currency: string;
        digit: string;
    }): Promise<void> {
        await this.buyDigitContractAndVerify({
            tradeTypeLabel: 'Over/Under',
            prediction: 'Under',
            position: 'bottom',
            ...params,
        });
    }

    /**
     * Flow 21 (#1384) — switching Higher/Lower → Over/Under must not leave a stale price barrier
     * on the digit proposal. Seeds a relative barrier on Higher/Lower, switches to Over/Under,
     * picks a digit, and asserts Buy is enabled and prices (no "Barrier is not an integer…" toast).
     */
    async verifyProposalAfterHigherLowerToOverUnder(params: { market: string; digit: string }): Promise<void> {
        const { market, digit } = params;

        await this.selectMarketAndTradeType(market, 'Higher/Lower');
        await this.setBarrier('1.00', 'Above spot');

        await this.selectMarketAndTradeType(market, 'Over/Under');
        await expect(
            this.lastDigitPredictionParam,
            'Last digit prediction should be visible after switching to Over/Under'
        ).toBeVisible();
        await this.selectDigit(digit);

        await expect(
            this.page.getByText(/Barrier is not an integer in range of 0 to 9/i),
            'Stale Higher/Lower barrier must not fail the digit proposal (#1384)'
        ).toHaveCount(0);
        await expect(this.purchaseButton, 'Buy should be enabled after Higher/Lower → Over/Under (#1384)').toBeEnabled({
            timeout: 45_000,
        });
        await expect(
            this.purchaseButtonPayout,
            'Buy should show a priced payout after Higher/Lower → Over/Under (#1384)'
        ).toHaveText(/^\D*[\d,]+\.\d+$/, { timeout: 45_000 });
    }
}
