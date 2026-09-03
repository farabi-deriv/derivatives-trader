import { expect, type Locator, type Page } from '@playwright/test';
import { TradeParametersPage } from './TradeParametersPage';
import { PositionsPage } from './PositionsPage';
import { ReportsPage } from './ReportsPage';
import { ContractDetailsPage } from './ContractDetailsPage';

/**
 * Shared base Page Object for digit contract types on the trade page (/): Matches/Differs,
 * Over/Under, Even/Odd. Concrete subclasses (e.g. {@link TradeMatchesDiffersPage},
 * {@link TradeOverUnderPage}) expose thin, well-named buy methods that delegate here.
 *
 * Digit contracts differ from directional contracts (Rise/Fall, Touch/No Touch):
 *  - Duration is **Ticks only** — Minutes/Hours are not offered, and the duration popover has no
 *    unit-tab sidebar (just tick value chips), so {@link selectTicksDuration} is used, not `selectDuration()`.
 *  - The two outcomes are a **SegmentedControlSingleChoice** tab pair (e.g. Matches/Differs) whose
 *    selection collapses the purchase area to a single colored button (top = green, bottom = red).
 *  - There is no manual close: contracts expire automatically. The tick duration is too short to
 *    reliably inspect the contract while open, so the flow opens the open position's contract details
 *    right after purchase, captures its buy reference ID, then waits for the contract to **settle in
 *    place** and verifies the settled contract — Positions Closed tab, contract details, balance, and
 *    Reports (Trade table + Statement).
 *  - The digit audit grid has **no Entry spot/Barrier** — instead a **Target** row (e.g. "Equals 5",
 *    "Over 5", "Under 5") holding the last-digit prediction.
 */
export abstract class TradeDigitsPage extends TradeParametersPage {
    protected readonly positionsPage: PositionsPage;
    protected readonly reportsPage: ReportsPage;
    protected readonly contractDetailsPage: ContractDetailsPage;

    constructor(page: Page) {
        super(page);
        this.positionsPage = new PositionsPage(page);
        this.reportsPage = new ReportsPage(page);
        this.contractDetailsPage = new ContractDetailsPage(page);
    }

    // ============================================
    // LOCATORS
    // ============================================

    /**
     * Top outcome purchase button — green, class="quill__color--primary-purchase".
     * Source: purchase-button.tsx getButtonType() returns 'purchase' for the first tab (index 0).
     * Once a tab is selected the purchase area collapses to a single button.
     */
    get topPurchaseButton(): Locator {
        return this.page.locator('.quill__color--primary-purchase');
    }

    /**
     * Bottom outcome purchase button — red, class="quill__color--primary-sell".
     * Source: purchase-button.tsx getButtonType() returns 'sell' for the second tab (index 1).
     */
    get bottomPurchaseButton(): Locator {
        return this.page.locator('.quill__color--primary-sell');
    }

    /**
     * Outcome tab button in the digit trade-type tab selector (SegmentedControlSingleChoice).
     * Source: trade-type-tabs.tsx — rendered with class .trade-params__option, labels from getTradeTypeTabsList.
     *
     * @param label - Visible tab label (e.g. 'Matches', 'Differs', 'Over', 'Under')
     */
    predictionTab(label: string): Locator {
        return this.page.locator('.trade-params__option').getByRole('button', { name: label, exact: true });
    }

    /**
     * Last digit prediction field — mobile only.
     * Tapping this opens the action sheet holding the digit selector.
     * Source: last-digit-prediction.tsx render_as_field TextField label "Last digit prediction".
     */
    get digitPredictionField(): Locator {
        return this.page.getByLabel('Last digit prediction').first();
    }

    /**
     * Mobile Last digit prediction action sheet. Save/Close live in ActionSheet.Header.
     * Source: last-digit-prediction.tsx
     */
    get digitPredictionSheet(): Locator {
        return this.page
            .locator('.quill-action-sheet--root')
            .filter({ has: this.page.locator('.last-digit-prediction__selector') });
    }

    /**
     * Save button in the mobile Last digit prediction action sheet header.
     */
    get digitSheetSaveButton(): Locator {
        return this.actionSheetSaveButton(this.digitPredictionSheet);
    }

    /**
     * A single digit button (0–9) inside the digit selector grid.
     * Source: digit.tsx — <button name='last_digit'> whose accessible name is the digit text.
     * Scoped to .last-digit-prediction__selector so it matches both the desktop inline grid and
     * the mobile action-sheet grid, and never the outcome purchase buttons.
     *
     * @param digit - Digit label "0"–"9"
     */
    digitButton(digit: string): Locator {
        return this.page
            .locator('.last-digit-prediction__selector')
            .locator('button[name="last_digit"]')
            .filter({ hasText: new RegExp(`^${digit}$`) });
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Select an outcome tab and verify the purchase button turns the expected color.
     *
     * @param label    - Tab label (e.g. 'Matches', 'Over')
     * @param position - 'top' (green purchase button) or 'bottom' (red purchase button)
     */
    async selectPredictionOption(label: string, position: 'top' | 'bottom'): Promise<void> {
        const button = position === 'top' ? this.topPurchaseButton : this.bottomPurchaseButton;
        const expectedColor = position === 'top' ? 'rgb(0, 195, 144)' : 'rgb(222, 0, 64)';
        await this.predictionTab(label).click();
        await expect(
            button,
            `Purchase button should be ${position === 'top' ? 'green' : 'red'} after selecting ${label}`
        ).toHaveCSS('background-color', expectedColor);
    }

    /**
     * Select a Ticks duration for a digit contract.
     *
     * Digit contracts support Ticks only, so there is no unit-tab sidebar (Ticks/Seconds/Minutes/
     * Hours) — the base `selectDuration()` cannot be reused because it always tries to click a unit
     * tab first. The picker itself also differs by viewport:
     * - Desktop: preset value chips (value-chips.tsx), matching `durationChip()`.
     * - Mobile: scroll-snap WheelPicker (`dt_duration_ticks_wheel`); commit via header Save
     *   (duration.tsx — dismiss no longer commits).
     *
     * @param value - Ticks value as rendered (e.g. '10 ticks', '1 tick')
     */
    async selectTicksDuration(value: string): Promise<void> {
        const displayRegex = new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
        if (displayRegex.test((await this.durationField.inputValue()).trim())) {
            return;
        }
        await this.durationField.click();
        if (this.isMobile) {
            await expect(this.durationContainer, 'Duration action sheet should open').toBeVisible();
            await this.selectWheelPickerOption(this.durationTicksWheel, value);
            await expect(this.durationContainer, 'Duration sheet should be open on mobile').toBeVisible();
            await this.saveMobileSheet(this.durationContainer);
            await expect(this.durationContainer, 'Duration sheet should close after Save').not.toBeVisible();
        } else {
            await this.durationChip(value).click();
        }
        await expect(this.durationField, `Duration field should show '${value}' after selection`).toHaveValue(
            new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`)
        );
    }

    /**
     * Select the last-digit prediction.
     * - Desktop: clicks the digit in the inline grid and asserts it becomes active.
     * - Mobile: opens the action sheet, clicks the digit, taps Save, and asserts the field value.
     *   Save stays disabled when the draft matches the committed digit (last-digit-prediction.tsx),
     *   so skip opening the sheet when the field already shows the target digit.
     *
     * @param digit - Digit label "0"–"9"
     */
    async selectDigit(digit: string): Promise<void> {
        if (this.isMobile) {
            if ((await this.digitPredictionField.inputValue()).trim() === digit) {
                return;
            }
            await this.digitPredictionField.click();
            await this.digitButton(digit).click();
            await this.saveMobileSheet(this.digitPredictionSheet);
            await expect(
                this.digitPredictionField,
                `Last digit prediction field should show "${digit}" after saving`
            ).toHaveValue(digit);
        } else {
            await this.digitButton(digit).click();
            await expect(this.digitButton(digit), `Digit "${digit}" should be active after selection`).toHaveClass(
                /active/
            );
        }
    }

    /**
     * Full digit contract flow, shared by all digit trade types: configure → buy → open the open
     * position's details and capture its buy reference ID → wait for the tick contract to settle in
     * place → verify the settled contract in the Positions Closed tab, contract details, balance, and
     * Reports (Trade table + Statement).
     *
     * @param accountType    - Account to trade on: 'real' or 'demo'
     * @param tradeTypeLabel - Trade type chip label (e.g. 'Matches/Differs', 'Over/Under', 'Even/Odd')
     * @param prediction     - Outcome tab label + contract type name (e.g. 'Matches', 'Over', 'Even')
     * @param position       - 'top' (green) or 'bottom' (red) purchase button for this outcome
     * @param market         - Digits market symbol (e.g. 'Volatility 10 Index')
     * @param durationValue  - Ticks chip label (e.g. '10 ticks')
     * @param stake          - Stake amount as a string (e.g. '10.00')
     * @param currency       - Currency code (e.g. 'USD')
     * @param digit          - Last-digit prediction "0"–"9". Omit for Even/Odd, which has no digit
     *                         selector; the audit Target row then reads the outcome (e.g. "Even").
     */
    protected async buyDigitContractAndVerify({
        accountType,
        tradeTypeLabel,
        prediction,
        position,
        market,
        durationValue,
        stake,
        currency,
        digit,
    }: {
        accountType: 'real' | 'demo';
        tradeTypeLabel: string;
        prediction: string;
        position: 'top' | 'bottom';
        market: string;
        durationValue: string;
        stake: string;
        currency: string;
        digit?: string;
    }): Promise<void> {
        // 0. Trade on the account type requested by the test — the account created in beforeAll is real by default.
        await this.switchToAccountType(accountType);

        // 1. Configure and buy. Even/Odd has no last-digit selector, so `digit` is omitted there.
        await this.selectMarketAndTradeType(market, tradeTypeLabel);
        if (digit !== undefined) {
            await expect(
                this.lastDigitPredictionParam,
                `Last digit prediction should be visible for ${tradeTypeLabel}`
            ).toBeVisible();
        }
        await this.selectPredictionOption(prediction, position);
        await this.selectTicksDuration(durationValue);
        await this.setStake(stake);
        if (digit !== undefined) {
            await this.selectDigit(digit);
        }
        // Audit "Target" text: the digit for digit-prediction types, else the outcome (Even/Odd).
        const targetText = digit ?? prediction;
        const balanceBefore = await this.getBalance();
        const buyDate = this.getCurrentDate();
        const payout = await this.clickBuy();

        // 2. Verify balance deducted after purchase, then capture the clean post-deduction balance.
        await this.verifyBalanceAfterContractPurchase(balanceBefore, stake);
        const balanceAfterBuy = await this.getBalance();

        // 3. Open the CURRENT open position's contract details (newest open contract) and capture its
        // buy reference ID while open — this pins the exact contract so later checks never read a stale
        // (previous) contract on this shared account. Then let the tick contract settle in place.
        if (this.isMobile) {
            await this.goToPositions();
        }
        await this.positionsPage.openFirstContract();
        const buyId = await this.contractDetailsPage.getBuyReferenceId();
        await this.contractDetailsPage.waitForContractSettled();
        await this.contractDetailsPage.closeContractDetails();

        // 4. In the Closed tab, THIS contract is now the newest closed one → verify it and read the
        // signed profit/loss (the closed card exposes the sign; the details card does not).
        await this.goToPositions();
        await this.positionsPage.clickClosedTab();
        const profitLoss = await this.positionsPage.verifyClosedPositionsTab(market, prediction, currency, stake);

        // 5. Reopen this contract's details and verify the settled digit contract. Passing the captured
        // buyId makes the reference-ID assertion confirm it is the same contract; returns the sell ID.
        await this.positionsPage.openFirstContract();
        const sellId = await this.contractDetailsPage.verifyClosedDigitContractDetailsPage(
            market,
            prediction,
            currency,
            stake,
            payout,
            buyId,
            durationValue,
            buyDate,
            profitLoss,
            targetText
        );
        await this.contractDetailsPage.closeContractDetails();

        // 6. Verify final balance reflects the contract settlement.
        const balanceAfterClose = await this.getBalance();
        await this.verifyBalanceAfterContractClose(balanceAfterBuy, stake, profitLoss, balanceAfterClose);

        // 7. Verify the settled contract in Reports — Trade table and Statement.
        await this.goToReports();
        await this.reportsPage.verifyClosedContractInReports(
            buyId,
            sellId,
            currency,
            stake,
            buyDate,
            profitLoss,
            balanceAfterClose,
            balanceAfterBuy
        );
        await this.reportsPage.closeReports();
    }
}
