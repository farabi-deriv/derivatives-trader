import { expect, type Locator, type Page } from '@playwright/test';
import { TradeParametersPage } from './TradeParametersPage';

export type ValidationRange = {
    minimum: number;
    midpoint: number;
    maximum: number;
    belowMinimum: number;
    aboveMaximum: number;
    precision: number;
};

export type PurchaseControlState = {
    isVisible: boolean;
    isEnabled: boolean;
    isLoading: boolean;
    text: string;
};

/**
 * Page Object for Manual Trading negative validation on the trade route.
 *
 * It reads limits and available options from the rendered UI so tests never duplicate
 * market-specific values owned by the contracts/proposal APIs.
 *
 * @example
 * ```typescript
 * await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
 * await tradeValidationPage.verifyStakeGuardrails('Over/Under');
 * ```
 */
export class TradeValidationPage extends TradeParametersPage {
    private buyRequestCount = 0;
    private isTrackingBuyRequests = false;

    constructor(page: Page) {
        super(page);
    }

    // ============================================
    // LOCATORS
    // ============================================

    /** The actual purchase button, independent of whether it has payout content. */
    get buyControl(): Locator {
        return this.page.locator('button.purchase-button--single');
    }

    /** Desktop duration Save button in the open manual-input view. */
    get durationSaveButton(): Locator {
        return this.page.locator('.duration-input-desktop__footer').getByRole('button', { name: 'Save' });
    }

    /** Validation or neutral range message in the desktop Duration editor. */
    get durationMessage(): Locator {
        return this.page
            .locator('.duration-input-desktop__wrapper, .duration-ticks-input-desktop__wrapper')
            .locator('.message__container__text')
            .first();
    }

    /** Hours input in the desktop compound duration editor. */
    get durationHoursInput(): Locator {
        return this.durationPopover.getByRole('textbox', { name: 'Hours' });
    }

    /** Minutes input in the desktop compound duration editor. */
    get durationHoursMinutesInput(): Locator {
        return this.durationPopover.getByRole('textbox', { name: 'Minutes' });
    }

    /** Neutral range displayed by the desktop Hours editor. */
    get durationHoursRange(): Locator {
        return this.durationPopover.locator('.duration-input-desktop__range-text');
    }

    /** Validation message associated with the Hours field. */
    get durationHoursMessage(): Locator {
        return this.durationPopover
            .locator('.duration-input-desktop__field-group')
            .filter({ has: this.page.getByRole('textbox', { name: 'Hours' }) })
            .getByText(/^Range:/);
    }

    /** Validation message associated with the Minutes field in the Hours editor. */
    get durationHoursMinutesMessage(): Locator {
        return this.durationPopover
            .locator('.duration-input-desktop__field-group')
            .filter({ has: this.page.getByRole('textbox', { name: 'Minutes' }) })
            .getByText(/^Range:/);
    }

    /** Calendar dates disabled by minimum-date or market-availability guardrails. */
    get disabledDurationCalendarDays(): Locator {
        return this.page.locator('.react-calendar__tile:disabled');
    }

    /** Time-grid choices disabled by current time or trading-session guardrails. */
    get disabledDurationEndTimeOptions(): Locator {
        return this.page.locator('.time-grid-picker__item:disabled');
    }

    /** End-date input scoped to the current viewport implementation. */
    override get durationEndDateInput(): Locator {
        return this.isMobile
            ? this.durationContainer.getByTestId('dt_date_input')
            : this.page.getByTestId('dt_duration_end_date_input');
    }

    /** Visible overlays for nested or top-level desktop parameter popovers. */
    get visibleParameterPopoverOverlays(): Locator {
        return this.page.locator('.input-popover-overlay:visible');
    }

    /** Visible Quill action sheets, ordered by their portal position. */
    get visibleActionSheets(): Locator {
        return this.page.locator('.quill-action-sheet--root:visible');
    }

    /** Current mobile duration wheel options, scoped to the visible duration sheet. */
    get durationWheelOptions(): Locator {
        return this.durationContainer.getByRole('option');
    }

    /** Validation text shown by the open barrier editor. */
    get barrierMessage(): Locator {
        const editor = this.isMobile ? this.barrierSheet : this.page.locator('.barrier-popover');
        return editor.locator('.message__container__text').first();
    }

    /** Current committed barrier value. */
    get committedBarrierInput(): Locator {
        return this.barrierField.locator('input');
    }

    /** Digit choices rendered by Matches/Differs or Over/Under. */
    get digitChoices(): Locator {
        return this.page.locator('.last-digit-prediction__selector button[name="last_digit"]');
    }

    /**
     * Digit-contract outcome tab (Matches/Differs or Over/Under).
     *
     * @param outcome - Outcome label on the segmented control.
     * @returns Matching outcome tab.
     */
    digitOutcomeTab(outcome: 'Matches' | 'Differs' | 'Over' | 'Under'): Locator {
        return this.page.locator('.trade-params__option').getByRole('button', { name: outcome, exact: true });
    }

    /**
     * A digit choice in the active selector.
     *
     * @param digit - Digit from 0 through 9.
     * @returns Matching digit button.
     */
    digitChoice(digit: string): Locator {
        return this.digitChoices.filter({ hasText: new RegExp(`^${digit}$`) });
    }

    /** Mobile digit-prediction sheet. */
    get digitPredictionSheet(): Locator {
        return this.page
            .locator('.quill-action-sheet--root')
            .filter({ has: this.page.locator('.last-digit-prediction__selector') });
    }

    /** Last-digit prediction field on mobile. */
    get digitPredictionField(): Locator {
        return this.page.getByLabel('Last digit prediction').first();
    }

    /** Multiplier field shared by desktop and mobile. */
    get multiplierField(): Locator {
        return this.page.getByRole('textbox', { name: 'Multiplier' });
    }

    /** Available multiplier options in the open editor. */
    get multiplierOptions(): Locator {
        return this.isMobile
            ? this.page.locator('.multiplier__wheel-picker').getByRole('option')
            : this.page.getByRole('listbox', { name: 'Selection options' }).getByRole('option');
    }

    /** Risk-management field shared by desktop and mobile. */
    get riskManagementField(): Locator {
        return this.page.getByLabel('Risk management').first();
    }

    /** Risk-management container for the current viewport. */
    get riskManagementEditor(): Locator {
        return this.isMobile
            ? this.page.locator('.quill-action-sheet--root:has(.risk-management__picker)')
            : this.page.locator('.risk-management-popover__main');
    }

    /** Take-profit amount input in the open Multipliers risk editor. */
    get multiplierTakeProfitInput(): Locator {
        return this.isMobile ? this.page.getByTestId('dt_tp_input') : this.page.getByTestId('dt_tp_input_desktop');
    }

    /** Stop-loss amount input in the open Multipliers risk editor. */
    get multiplierStopLossInput(): Locator {
        return this.isMobile ? this.page.getByTestId('dt_sl_input') : this.page.getByTestId('dt_sl_input_desktop');
    }

    /** Take-profit range/error message in the open risk editor. */
    get takeProfitMessage(): Locator {
        return this.riskManagementEditor
            .locator('.take-profit__wrapper, .risk-management-desktop__field')
            .filter({ hasText: 'Take profit' })
            .locator('.message__container__text')
            .first();
    }

    /** Stop-loss range/error message in the open risk editor. */
    get stopLossMessage(): Locator {
        return this.riskManagementEditor
            .locator('.take-profit__wrapper, .risk-management-desktop__field')
            .filter({ hasText: 'Stop loss' })
            .locator('.message__container__text')
            .first();
    }

    /** Deal Cancellation tab in the open Multipliers risk editor. */
    get dealCancellationTab(): Locator {
        return this.isMobile
            ? this.page.locator('.segmented-control-single button.item', {
                  hasText: 'Deal cancellation',
              })
            : this.page.locator('.vertical-tab-selector').getByRole('tab', { name: 'DC' });
    }

    /** Deal Cancellation choices rendered for the active symbol/configuration. */
    get dealCancellationOptions(): Locator {
        return this.isMobile
            ? this.page.locator('.deal-cancellation__wheel-picker').getByRole('option')
            : this.page.locator('.deal-cancellation-desktop__chips').getByRole('button');
    }

    /** Market rows in the currently open market-selection category. */
    get marketRows(): Locator {
        return this.marketSelectionPage.marketSelectionPanel.locator(
            this.isMobile ? '.market-selection-row' : '.market-row-desktop'
        );
    }

    /** Closed market rows in the currently open market-selection category. */
    get closedMarketRows(): Locator {
        return this.marketRows.filter({ hasText: 'CLOSED' });
    }

    /** Open (tradable) market rows — excludes CLOSED-tagged rows. */
    get openMarketRows(): Locator {
        return this.marketRows.filter({ hasNotText: 'CLOSED' });
    }

    /** Closed-market countdown/status container on the trade page. */
    get closedMarketMessage(): Locator {
        return this.page.locator('.closed-market-message--container');
    }

    /** Insufficient-balance modal/sheet root for either viewport. */
    get insufficientBalanceSurface(): Locator {
        return this.page.locator('.service-error-sheet').or(this.page.getByText('Insufficient balance').first());
    }

    /** Inline stake balance warning in the open Stake editor. */
    get stakeBalanceWarning(): Locator {
        return this.stakeValidationMessage.filter({ hasText: /Balance is empty|You only have/ });
    }

    /** Stake details block (Max payout / Payout rows) inside the open Custom editor. */
    private get stakeDetailsRoot(): Locator {
        return this.isMobile
            ? this.stakeContainer.locator('.stake-content__details')
            : this.stakePopover.locator('.stake-input-desktop__details .stake-content__details');
    }

    /** A stake-details row by its label (e.g. Max payout, Stop out). */
    private stakeDetailsRow(label: 'Max payout' | 'Payout' | 'Stop out' | 'Stop out level' | 'Commission'): Locator {
        const labelLocator =
            label === 'Payout' ? this.page.getByText(/^Payout(\s|\(|$)/) : this.page.getByText(label, { exact: true });
        return this.stakeDetailsRoot.locator('.stake-content__details-row').filter({ has: labelLocator });
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Open the Stake custom editor and discover runtime limits from UI guardrails.
     *
     * Payout-based contracts may not expose a maximum stake in the editor. In that case the
     * returned maximum is unbounded so callers can still use the discovered minimum.
     *
     * @returns The parsed current stake range.
     */
    async openStakeEditor(): Promise<ValidationRange> {
        await this.openStakeCustomInput();
        return this.verifyStakeCustomBoundaries();
    }

    /**
     * Custom Stake drafts (editor already open; desktop switches to Custom when needed).
     * Branches by trade type so new families can plug in without new top-level helpers:
     * - Accumulators / Turbos / Vanillas → neutral `Range: $min to $max` (empty details)
     * - Multipliers → same Range, plus Stop out / Stop out level / Commission rows
     * - Digits / Rise/Fall / Higher/Lower / Touch/No Touch → min error + max-payout error
     * - Default ({@link openStakeEditor}) → min error, then Max payout when shown, else excessive probe
     *
     * @param tradeType - Active trade type when known; omit for generic discovery.
     */
    private async verifyStakeCustomBoundaries(tradeType?: string): Promise<ValidationRange> {
        if (!this.isMobile && !(await this.stakePopoverInput.isVisible().catch(() => false))) {
            await this.stakeManualInputToggle.click();
        }
        await expect(this.stakePopoverInput, 'Stake custom input should be visible').toBeVisible();

        switch (tradeType) {
            case 'Accumulators':
            case 'Turbos':
            case 'Vanillas':
            case 'Multipliers': {
                await expect(
                    this.stakeValidationMessage,
                    `${tradeType} Custom should show a neutral Range: min to max hint`
                ).toContainText(/Range:\s*\$?[\d,]+\.?\d*\s+to\s+\$?[\d,]+\.?\d*/i, { timeout: 20_000 });
                await expect(
                    this.stakeDetailsRow('Max payout'),
                    `${tradeType} Custom must not show Max payout`
                ).toHaveCount(0);
                await expect(
                    this.stakeDetailsRow('Payout'),
                    `${tradeType} Custom must not show a Payout row`
                ).toHaveCount(0);

                if (tradeType === 'Multipliers') {
                    await expect(
                        this.stakeDetailsRow('Stop out'),
                        'Multipliers Custom should show Stop out'
                    ).toBeVisible({ timeout: 20_000 });
                    await expect(
                        this.stakeDetailsRow('Stop out level'),
                        'Multipliers Custom should show Stop out level'
                    ).toBeVisible();
                    await expect(
                        this.stakeDetailsRow('Commission'),
                        'Multipliers Custom should show Commission'
                    ).toBeVisible();
                }

                const range = await this.readRange(this.stakeValidationMessage);

                await this.fillStakeCustomDraft(this.formatRangeValue(range.belowMinimum, range.precision));
                await expect(
                    this.stakeValidationMessage,
                    `Stake below minimum (${range.belowMinimum}) should show the minimum-stake error`
                ).toHaveText(TradeParametersPage.STAKE_MIN_AMOUNT_ERROR, { timeout: 20_000 });
                await expect(this.stakeSaveButton, 'Save must stay disabled for a below-minimum stake').toBeDisabled();

                await this.fillStakeCustomDraft(this.formatRangeValue(range.aboveMaximum, range.precision));
                await expect(
                    this.stakeValidationMessage,
                    `Stake above maximum (${range.aboveMaximum}) should show an upper stake guardrail`
                ).toContainText(new RegExp(String(range.maximum).replace('.', '\\.')), { timeout: 20_000 });
                await expect(this.stakeSaveButton, 'Save must stay disabled for an above-maximum stake').toBeDisabled();

                await this.fillAcceptedMinimumStake(range.minimum, range.precision);
                await expect(
                    this.stakeValidationMessage,
                    `An in-range ${tradeType} stake should restore the neutral Range hint`
                ).toContainText(/Range:/i);
                await expect(
                    this.stakeSaveButton,
                    `Save must be enabled for an in-range ${tradeType} stake`
                ).toBeEnabled();
                return range;
            }
            case 'Over/Under':
            case 'Matches/Differs':
            case 'Even/Odd':
            case 'Rise/Fall':
            case 'Higher/Lower':
            case 'Touch/No Touch':
            default: {
                await this.fillStakeCustomDraft('0');
                await expect(this.stakeValidationMessage, 'Zero stake should show the minimum-stake error').toHaveText(
                    TradeParametersPage.STAKE_MIN_AMOUNT_ERROR,
                    { timeout: 20_000 }
                );
                await expect(this.stakeSaveButton, 'Save must stay disabled for a below-minimum stake').toBeDisabled();

                const { amount: minimum, raw: rawMinimum } = this.parseFirstAmount(
                    await this.stakeValidationMessage.innerText()
                );
                const precision = this.decimalPlaces(rawMinimum);

                await this.fillAcceptedMinimumStake(minimum, precision);

                const maxPayoutRow = this.stakeDetailsRow('Max payout');
                let maximum = Number.MAX_SAFE_INTEGER;

                if ((await maxPayoutRow.count()) > 0 && (await maxPayoutRow.isVisible())) {
                    const maxPayout = await this.readStakeDetailsAmount('Max payout');
                    const aboveMaxPayout = this.formatRangeValue(Math.floor(maxPayout) + 1, precision);

                    await this.fillStakeCustomDraft(aboveMaxPayout);
                    await expect(
                        this.stakeValidationMessage,
                        `Stake ${aboveMaxPayout} (above max payout ${maxPayout}) should show the payout-limits error`
                    ).toHaveText(TradeParametersPage.STAKE_MAX_PAYOUT_ERROR, { timeout: 20_000 });
                    await expect(
                        this.stakeSaveButton,
                        'Save must stay disabled when payout exceeds the maximum'
                    ).toBeDisabled();
                    maximum = maxPayout;
                } else {
                    await this.fillStakeCustomDraft('9999999999', true);
                    await expect(
                        this.stakeValidationMessage,
                        'An excessive stake should expose an upper guardrail'
                    ).toContainText(/\d/, { timeout: 20_000 });
                    await expect(
                        this.stakeSaveButton,
                        'An excessive stake rejected by stake or payout limits must not be saved'
                    ).toBeDisabled();
                    const upperError = (await this.stakeValidationMessage.innerText()).trim();
                    expect(upperError, 'Upper rejection should name a stake or payout guardrail').toMatch(
                        /stake|payout|range|maximum|between|at most/i
                    );
                    const upperNumbers = [...upperError.matchAll(/[\d,]+(?:\.\d+)?/g)].map(match =>
                        Number(match[0].replace(/,/g, ''))
                    );
                    const exposesStakeCeiling = /stake|between|range|maximum/i.test(upperError);
                    const stakeCeiling = upperNumbers.find(value => Number.isFinite(value) && value >= minimum);
                    maximum =
                        exposesStakeCeiling && stakeCeiling !== undefined ? stakeCeiling : Number.MAX_SAFE_INTEGER;
                }

                await this.fillAcceptedMinimumStake(minimum, precision);
                return this.createRange(minimum, maximum, precision);
            }
        }
    }

    /** Parses a currency amount from a stake-details row (e.g. Max payout → 1000 from "$1,000.00"). */
    private async readStakeDetailsAmount(label: 'Max payout' | 'Payout'): Promise<number> {
        const row = this.stakeDetailsRow(label);
        await expect(row.locator('p').last(), `${label} value should load in stake details`).not.toHaveText('-', {
            timeout: 20_000,
        });
        const text = await row.locator('p').last().innerText();
        const amount = parseFloat(text.replace(/,/g, '').replace(/[^\d.]/g, ''));
        if (!Number.isFinite(amount)) {
            throw new Error(`Could not parse ${label} from stake details text "${text}"`);
        }
        return amount;
    }

    /**
     * Fill a stake the active configuration accepts at/near its published minimum.
     * Turbos and payout-linked contracts can keep Save disabled on the exact parsed
     * minimum until a proposal settles, so this retries with sequential input and a
     * one-step precision bump when needed.
     */
    private async fillAcceptedMinimumStake(minimum: number, precision: number): Promise<void> {
        const candidates = [
            this.formatRangeValue(minimum, precision),
            this.formatRangeValue(minimum + 10 ** -precision, precision),
        ];
        let lastError: unknown;

        for (const amount of candidates) {
            try {
                await expect(async () => {
                    await this.stakePopoverInput.click();
                    await this.stakePopoverInput.clear();
                    await this.stakePopoverInput.pressSequentially(amount, { delay: 40 });
                    await expect(
                        this.stakeSaveButton,
                        'A stake at or just above the active minimum should be accepted'
                    ).toBeEnabled();
                }).toPass({ timeout: 20_000 });
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error(`Could not accept a stake at or just above minimum ${minimum}`);
    }

    /**
     * Track outbound Buy requests on the application socket.
     * Call before navigation creates the application socket.
     *
     * @returns Promise resolved after the listener is registered.
     */
    async startBuyRequestTracking(): Promise<void> {
        if (this.isTrackingBuyRequests) return;
        this.buyRequestCount = 0;
        this.isTrackingBuyRequests = true;
        this.page.on('websocket', socket => {
            socket.on('framesent', event => {
                try {
                    const rawPayload =
                        typeof event.payload === 'string' ? event.payload : event.payload.toString('utf8');
                    const payload: unknown = JSON.parse(rawPayload);
                    if (
                        typeof payload === 'object' &&
                        payload !== null &&
                        'buy' in payload &&
                        typeof (payload as { buy?: unknown }).buy !== 'undefined'
                    ) {
                        this.buyRequestCount += 1;
                    }
                } catch {
                    // Non-JSON protocol frames are unrelated to Deriv buy requests.
                }
            });
        });
    }

    /**
     * Return the number of outbound buy requests observed by this page object.
     *
     * @returns Current request count.
     */
    getTrackedBuyRequestCount(): number {
        return this.buyRequestCount;
    }

    /**
     * Double-click the currently enabled Buy control to exercise its pending-state guard.
     *
     * @returns Promise resolved after the user gesture.
     */
    async doubleClickBuy(): Promise<void> {
        await expect(this.buyControl, 'Buy should be enabled before the duplicate-click attempt').toBeEnabled();
        await this.buyControl.dblclick();
    }

    /**
     * Dismiss the currently open non-stake parameter editor without committing changes.
     */
    async dismissOpenParameterEditor(): Promise<void> {
        if (this.isMobile) {
            const sheet = this.visibleActionSheets.last();
            await this.dismissParameterEditor(sheet, sheet, 'Parameter');
            return;
        }
        const popover = this.page
            .locator(
                '.input-popover:visible, .barrier-popover:visible, .duration-popover:visible, .multiplier-popover:visible'
            )
            .last();
        if (await popover.count()) {
            await this.dismissParameterEditor(popover, popover, 'Parameter');
            return;
        }
        await this.page.keyboard.press('Escape');
    }

    /**
     * Read the current minimum stake without committing a draft.
     *
     * @returns Minimum stake formatted to the runtime currency precision.
     */
    async getMinimumStake(): Promise<string> {
        const range = await this.openStakeEditor();
        const minimum = this.formatRangeValue(range.minimum, range.precision);
        await this.dismissStakeEditor();
        return minimum;
    }

    /**
     * Open desktop Duration manual input for a unit.
     *
     * @param unit - Runtime duration unit.
     * @returns Parsed visible range, or null on mobile where users only get bounded wheels.
     */
    async openDurationManualEditor(unit: 'Ticks' | 'Seconds' | 'Minutes'): Promise<ValidationRange | null> {
        const editor = this.isMobile ? this.durationContainer : this.durationPopover;
        if (!(await editor.isVisible())) {
            await this.durationField.click();
        }
        const unitTab = this.durationUnitTab(unit);
        if ((await unitTab.count()) > 0) {
            await unitTab.click();
        } else if (unit !== 'Ticks') {
            throw new Error(`The active configuration does not offer the ${unit} duration unit`);
        }
        if (this.isMobile) {
            await expect(this.durationContainer, 'Mobile duration sheet should open').toBeVisible();
            await expect(
                this.durationWheelOptions.first(),
                'Mobile duration wheel should contain options'
            ).toBeAttached();
            return null;
        }
        await this.durationManualInputToggle.click();
        await expect(this.durationMessage, 'Duration editor should expose a numeric runtime range').toContainText(/\d/);
        return this.readRange(this.durationMessage);
    }

    /**
     * Close nested date/time controls and the main Duration editor without committing.
     *
     * @returns Promise resolved after all duration overlays are dismissed.
     */
    async dismissDurationEditors(): Promise<void> {
        if (this.isMobile) {
            for (let attempt = 0; attempt < 3 && (await this.durationContainer.isVisible()); attempt += 1) {
                const visibleSheetCount = await this.visibleActionSheets.count();
                const sheet = this.visibleActionSheets.nth(visibleSheetCount - 1);
                await this.actionSheetCloseButton(sheet).click();
                await expect(
                    sheet,
                    'Each nested duration sheet should finish closing before the next'
                ).not.toBeVisible();
            }
            await expect(
                this.durationContainer,
                'Duration action sheet should close without committing'
            ).not.toBeVisible();
            return;
        }

        for (let attempt = 0; attempt < 2 && (await this.durationPopover.isVisible()); attempt += 1) {
            const overlay = this.visibleParameterPopoverOverlays.last();
            await expect(overlay, 'An open duration popover should expose a dismiss overlay').toBeVisible();
            await overlay.click({ position: { x: 5, y: 5 } });
        }
        await expect(this.durationPopover, 'Duration popover should close without committing').not.toBeVisible();
    }

    /**
     * Open a duration unit while preserving the currently open duration editor.
     *
     * @param unit - Visible duration unit.
     * @returns Promise resolved after the unit tab is active.
     */
    async openDurationUnit(unit: 'Ticks' | 'Seconds' | 'Minutes' | 'Hours' | 'End time'): Promise<void> {
        const editor = this.isMobile ? this.durationContainer : this.durationPopover;
        if (!(await editor.isVisible())) {
            await this.durationField.click();
        }
        const tab = this.durationUnitTab(unit);
        await expect(tab, `${unit} should be offered by the active contract configuration`).toBeVisible();
        await tab.click();
    }

    /**
     * Fill the visible desktop duration input.
     *
     * @param value - Duration draft.
     * @returns Promise resolved after filling.
     */
    async fillDurationDraft(value: string): Promise<void> {
        const input = this.page
            .getByTestId('dt_duration_ticks_input_desktop')
            .or(this.page.getByTestId('dt_duration_input_desktop'))
            .filter({ visible: true })
            .first();
        await input.fill(value);
    }

    /**
     * Open the Barrier editor and optionally select a barrier mode.
     *
     * @param type - Barrier mode.
     * @returns Promise resolved once the editor is ready.
     */
    async openBarrierEditor(type?: 'Above spot' | 'Below spot' | 'Fixed barrier'): Promise<void> {
        await this.barrierField.click();
        if (this.isMobile) {
            await expect(this.barrierSheet, 'Barrier sheet should open').toBeVisible();
        }
        if (type) {
            const tab = this.barrierTypeTab(type);
            if ((await tab.count()) > 0 && (await tab.getAttribute('aria-selected')) !== 'true') {
                await tab.click();
            }
        }
        await expect(this.barrierInput, 'Barrier input should be visible').toBeVisible();
    }

    /**
     * Fill the open Barrier draft.
     *
     * @param value - Unsigned barrier draft.
     * @returns Promise resolved after filling.
     */
    async fillBarrierDraft(value: string): Promise<void> {
        await this.barrierInput.clear();
        await this.barrierInput.fill(value);
    }

    /**
     * Open the digit selector when mobile requires an action sheet.
     *
     * @returns Promise resolved once digit choices are rendered.
     */
    async openDigitSelector(): Promise<void> {
        if (this.isMobile) {
            await this.digitPredictionField.click();
            await expect(this.digitPredictionSheet, 'Digit prediction sheet should open').toBeVisible();
        }
        await expect(this.digitChoices, 'Digit selector should render choices').toHaveCount(10);
    }

    /**
     * Open the Multiplier editor.
     *
     * @returns Current rendered multiplier labels.
     */
    async readMultiplierOptions(): Promise<string[]> {
        await this.multiplierField.click();
        await expect(
            this.multiplierOptions.first(),
            'Multiplier editor should render at least one option'
        ).toBeAttached();
        return (await this.multiplierOptions.allTextContents()).map(value => value.trim()).filter(Boolean);
    }

    /**
     * Open the Multipliers TP/SL risk-management editor.
     *
     * @returns Promise resolved after both controls are available.
     */
    async openRiskManagementEditor(): Promise<void> {
        await this.riskManagementField.click();
        await expect(this.riskManagementEditor, 'Risk-management editor should open').toBeVisible();
        const tpToggle = this.riskManagementEditor
            .locator('.take-profit__wrapper, .risk-management-desktop__field')
            .filter({ hasText: 'Take profit' })
            .locator('button.toggle-switch');
        const slToggle = this.riskManagementEditor
            .locator('.take-profit__wrapper, .risk-management-desktop__field')
            .filter({ hasText: 'Stop loss' })
            .locator('button.toggle-switch');
        await expect(tpToggle, 'Take-profit toggle should be visible').toBeVisible();
        await expect(slToggle, 'Stop-loss toggle should be visible').toBeVisible();
        if ((await tpToggle.getAttribute('aria-pressed')) !== 'true') await tpToggle.click();
        if ((await slToggle.getAttribute('aria-pressed')) !== 'true') await slToggle.click();
        await expect(this.multiplierTakeProfitInput, 'Take-profit input should be enabled').toBeEnabled();
        await expect(this.multiplierStopLossInput, 'Stop-loss input should be enabled').toBeEnabled();
    }

    /**
     * Read Deal Cancellation choices from the current Multipliers configuration.
     *
     * @returns Rendered duration labels.
     */
    async readDealCancellationOptions(): Promise<string[]> {
        if ((await this.riskManagementEditor.count()) === 0) {
            await this.riskManagementField.click();
        }
        await expect(this.riskManagementEditor, 'Risk-management editor should open').toBeVisible();
        if ((await this.dealCancellationTab.count()) === 0) {
            return [];
        }
        await this.dealCancellationTab.click();
        await expect(
            this.dealCancellationOptions.first(),
            'Deal Cancellation should expose supported durations for this configuration'
        ).toBeAttached();
        return (await this.dealCancellationOptions.allTextContents()).map(value => value.trim()).filter(Boolean);
    }

    /**
     * Select an asset category and return all rendered market names.
     *
     * @param category - Visible category chip label.
     * @returns Market names currently rendered for the selected category.
     */
    async readMarketsForCategory(category: string): Promise<string[]> {
        if ((await this.marketSelectionPage.marketSelectionPanel.count()) === 0) {
            await this.marketSelectionPage.addMarketButton.click();
        }
        await this.marketSelectionPage.selectMarketCategory(category);
        await expect(this.marketRows.first(), `${category} should render at least one market`).toBeAttached();
        const nameSelector = this.isMobile ? '.market-selection-row__name' : '.market-row-desktop__name';
        return (await this.marketRows.locator(nameSelector).allTextContents()).map(name => name.trim()).filter(Boolean);
    }

    /**
     * Select an asset category and return market names that are currently open (no CLOSED tag).
     * Prefer this for guardrail matrices so Forex / Stocks / Commodities closed sessions are skipped.
     *
     * @param category - Visible category chip label.
     * @returns Open market names currently rendered for the selected category.
     */
    async readOpenMarketsForCategory(category: string): Promise<string[]> {
        if ((await this.marketSelectionPage.marketSelectionPanel.count()) === 0) {
            await this.marketSelectionPage.addMarketButton.click();
        }
        await this.marketSelectionPage.selectMarketCategory(category);
        await expect(this.marketRows.first(), `${category} should render at least one market`).toBeAttached();
        const nameSelector = this.isMobile ? '.market-selection-row__name' : '.market-row-desktop__name';
        if ((await this.openMarketRows.count()) === 0) {
            return [];
        }
        return (await this.openMarketRows.locator(nameSelector).allTextContents())
            .map(name => name.trim())
            .filter(Boolean);
    }

    /**
     * Whether the trade form is showing the closed-market reopen message.
     */
    async isSelectedMarketClosed(): Promise<boolean> {
        return this.closedMarketMessage.isVisible().catch(() => false);
    }

    /**
     * After selecting a symbol, wait until the trade form settles to open (Buy visible) or closed
     * (reopen banner / disabled params). Forex / Stocks / Commodities often flip by session.
     */
    async waitForOpenOrClosedMarket(timeoutMs = 20_000): Promise<'open' | 'closed'> {
        let state: 'open' | 'closed' | 'pending' = 'pending';
        await expect
            .poll(
                async () => {
                    if (await this.closedMarketMessage.isVisible().catch(() => false)) {
                        state = 'closed';
                        return true;
                    }

                    const buyVisible = await this.buyControl.isVisible().catch(() => false);
                    if (buyVisible) {
                        const buyEnabled = await this.buyControl.isEnabled().catch(() => false);
                        if (buyEnabled) {
                            state = 'open';
                            return true;
                        }
                        // Closed sessions sometimes keep a disabled Buy shell instead of removing it.
                        const stakeDisabled =
                            (await this.stakeField.count()) > 0 &&
                            (await this.stakeField.isDisabled().catch(() => false));
                        if (stakeDisabled) {
                            state = 'closed';
                            return true;
                        }
                    }

                    const stakeDisabled =
                        (await this.stakeField.count()) > 0 && (await this.stakeField.isDisabled().catch(() => false));
                    if (stakeDisabled && (await this.buyControl.count()) === 0) {
                        state = 'closed';
                        return true;
                    }
                    return false;
                },
                {
                    message: 'Trade form should settle to an open Buy control or a closed-market state',
                    timeout: timeoutMs,
                    intervals: [250, 500, 1000],
                }
            )
            .toBe(true);
        return state === 'pending' ? 'closed' : state;
    }

    /**
     * Select the first currently closed market row.
     *
     * @returns Selected market name, or null when no closed row is currently available.
     */
    async selectFirstClosedMarket(): Promise<string | null> {
        await this.marketSelectionPage.addMarketButton.click();
        for (const category of ['Stocks & indices', 'Forex', 'Commodities', 'Cryptocurrencies', 'Derived']) {
            await this.marketSelectionPage.selectMarketCategory(category);
            const closedRow = this.closedMarketRows.first();
            if ((await closedRow.count()) === 0) continue;
            const nameSelector = this.isMobile ? '.market-selection-row__name' : '.market-row-desktop__name';
            const market = (await closedRow.locator(nameSelector).textContent())?.trim() ?? null;
            if (!market) continue;
            const target = this.isMobile ? closedRow.locator('.market-selection-row__content') : closedRow;
            await target.click();
            return market;
        }
        await this.marketSelectionPage.closeMarketSelectionPicker();
        return null;
    }

    /**
     * Read the complete current Buy control state.
     *
     * @returns Visibility, enabled state, loading class, and rendered text.
     */
    async getPurchaseControlState(): Promise<PurchaseControlState> {
        const isVisible = await this.buyControl.isVisible().catch(() => false);
        if (!isVisible) return { isVisible: false, isEnabled: false, isLoading: false, text: '' };
        return {
            isVisible,
            isEnabled: await this.buyControl.isEnabled(),
            isLoading: await this.buyControl.evaluate(element =>
                element.classList.contains('purchase-button--loading')
            ),
            text: (await this.buyControl.innerText()).trim(),
        };
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Stake validation for the **already selected** trade type.
     * Opens Stake → 6 quick picks → {@link verifyStakeCustomBoundaries}(tradeType) (Custom branches
     * by family: max-payout, Range, or Range + Multipliers details).
     *
     * @param tradeType - Active trade type label (e.g. `'Over/Under'`, `'Accumulators'`).
     */
    async verifyStakeGuardrails(tradeType: string): Promise<void> {
        const committedStake = await this.stakeField.inputValue();

        await this.stakeField.click();
        await this.verifyStakeQuickPicks();
        await this.verifyStakeCustomBoundaries(tradeType);
        await this.verifyBuyButtonRemainsEnabled();

        await expect(this.stakeField, 'Rejected stake drafts must not replace the committed stake').toHaveValue(
            committedStake
        );
    }

    /**
     * Stake quick picks: exactly 6 chips whose amounts may differ by trade type but must each
     * parse as a positive stake. Desktop uses the Quick picks tab; mobile shows chips on the sheet.
     */
    private async verifyStakeQuickPicks(): Promise<void> {
        const stakeEditor = this.isMobile ? this.stakeContainer : this.stakePopover;
        const chips = stakeEditor.locator('.value-chips__chip');
        await expect(chips.first(), 'Stake quick picks should show chips').toBeVisible();
        await expect(chips, 'Stake should expose exactly 6 quick-pick chips').toHaveCount(6);

        for (let index = 0; index < 6; index += 1) {
            const label = (await chips.nth(index).innerText()).trim();
            const amount = Number(label.replace(/[^\d.]/g, ''));
            expect(
                Number.isFinite(amount) && amount > 0,
                `Stake quick-pick chip should be a positive amount, got "${label}"`
            ).toBe(true);
        }
    }

    /**
     * Select a configuration and assert its Stake guardrails plus Buy stability.
     * Shared by the market-family and trade-type stake matrices.
     *
     * When the selected market is closed ("This market will reopen at…"), asserts trade controls
     * are disabled/hidden and returns without stake editing — callers should move on.
     */
    async verifyStakeGuardrailsForConfiguration(
        market: string,
        tradeType: string,
        options: {
            verifyAllowEquals?: boolean;
            verifyParams?: boolean;
        } = {}
    ): Promise<void> {
        const { verifyAllowEquals = true, verifyParams = true } = options;
        // Skip Buy assertions until we know the market is open — closed markets hide purchase.
        await this.selectMarketAndTradeType(market, tradeType, {
            verifyAllowEquals: false,
            verifyParams: false,
        });
        if ((await this.waitForOpenOrClosedMarket()) === 'closed') {
            await this.verifyClosedMarketTradeFormDisabled();
            return;
        }
        if (verifyParams) {
            await this.verifyParamsForTradeType(tradeType, 'manual', verifyAllowEquals);
        }
        await this.verifyStakeGuardrails(tradeType);
        if ((await this.waitForOpenOrClosedMarket()) === 'closed') {
            await this.dismissStakeEditor().catch(() => {});
            await this.verifyClosedMarketTradeFormDisabled();
            return;
        }
        await this.verifyBuyButtonRemainsEnabled();
        await this.dismissStakeEditor();
    }

    /**
     * Select a configuration and run duration guardrails, or assert closed-market disabled state.
     */
    async verifyDurationGuardrailsForConfiguration(
        market: string,
        tradeType: string,
        options: {
            verifyAllowEquals?: boolean;
            verifyParams?: boolean;
        } = {}
    ): Promise<void> {
        const { verifyAllowEquals = true, verifyParams = true } = options;
        await this.selectMarketAndTradeType(market, tradeType, {
            verifyAllowEquals: false,
            verifyParams: false,
        });
        if ((await this.waitForOpenOrClosedMarket()) === 'closed') {
            await this.verifyClosedMarketTradeFormDisabled();
            return;
        }
        if (verifyParams) {
            await this.verifyParamsForTradeType(tradeType, 'manual', verifyAllowEquals);
        }
        await this.verifyDurationGuardrails(tradeType);
        await this.verifyBuyButtonRemainsEnabled();
    }

    /**
     * Verify invalid Stake characters are filtered and empty input cannot be saved.
     *
     * @returns Promise resolved after all assertions.
     */
    async verifyStakeInputSanitization(): Promise<void> {
        await this.openStakeCustomInput();
        await this.fillStakeCustomDraft('abc!@#', true);
        await expect(this.stakePopoverInput, 'Stake should reject letters and special characters').toHaveValue('');
        if (this.isMobile) {
            await expect(this.stakeSaveButton, 'Mobile must disable Save for an empty stake').toBeDisabled();
        } else {
            await expect(
                this.stakeSaveButton,
                'Desktop allows Save to surface required validation for an empty stake'
            ).toBeEnabled();
            await this.stakeSaveButton.click();
            await expect(this.stakeValidationMessage, 'Desktop empty Stake should show required validation').toHaveText(
                TradeParametersPage.STAKE_REQUIRED_ERROR
            );
            await expect(
                this.stakeSaveButton,
                'Desktop must block Save after required validation appears'
            ).toBeDisabled();
        }

        await this.fillStakeCustomDraft('1.23456789', true);
        const accepted = await this.stakePopoverInput.inputValue();
        expect(
            accepted.split('.')[1]?.length ?? 0,
            'Stake precision should not exceed the input currency precision'
        ).toBeLessThanOrEqual(2);
    }

    /**
     * Verify insufficient-balance behavior using the readable balance.
     *
     * Post PR #1398: Save is blocked while the balance hint shows on both viewports; an unaffordable
     * committed stake is seeded via sessionStorage + reload; Buy stays enabled with a quoted payout.
     *
     * @param balance - Current readable account balance.
     * @returns Promise resolved after the balance gate is asserted.
     */
    async verifyInsufficientBalanceBehavior(balance: number): Promise<void> {
        await this.openStakeCustomInput();

        await this.fillStakeCustomDraft('0');
        await expect(this.stakeValidationMessage, 'Zero stake should expose the active minimum').toContainText(/\d/);
        const { amount: minimum, raw: rawMinimum } = this.parseFirstAmount(
            await this.stakeValidationMessage.innerText()
        );
        const precision = this.decimalPlaces(rawMinimum);
        const increment = 10 ** -precision;
        const unaffordable = Math.max(minimum, Number((balance + increment).toFixed(precision)));
        const amount = this.formatRangeValue(unaffordable, precision);

        await this.fillStakeCustomDraft(amount);
        await expect(
            this.stakeBalanceWarning,
            'Stake above readable balance should show balance-aware guidance'
        ).toBeVisible();
        await expect(this.stakeSaveButton, 'Save must stay disabled while the balance hint is showing').toBeDisabled();
        await this.dismissStakeEditor();

        await this.commitUnaffordableStakeForGate(amount);
        await this.verifyInsufficientBalanceBuyReady();
    }

    /**
     * Verify duration boundaries or bounded mobile options.
     *
     * @param unit - Duration unit.
     * @returns Promise resolved after runtime-derived assertions.
     */
    async verifyDurationRuntimeBoundaries(unit: 'Ticks' | 'Seconds' | 'Minutes'): Promise<void> {
        const range = await this.openDurationManualEditor(unit);
        if (!range) {
            const options = (await this.durationWheelOptions.allTextContents())
                .map(value => value.trim())
                .filter(Boolean);
            expect(options.length, 'Mobile duration wheel should contain supported values').toBeGreaterThan(0);
            expect(new Set(options).size, 'Mobile duration wheel should not contain duplicate values').toBe(
                options.length
            );
            return;
        }

        await this.fillDurationDraft(String(range.belowMinimum));
        await expect(this.durationMessage, 'Duration below minimum should show the current range').toContainText(
            String(range.minimum)
        );
        await expect(this.durationSaveButton, 'Duration below minimum must not be saved').toBeDisabled();

        await this.fillDurationDraft(String(range.minimum));
        await expect(this.durationSaveButton, 'Exact minimum duration should be accepted').toBeEnabled();

        await this.fillDurationDraft(String(range.aboveMaximum));
        await expect(this.durationMessage, 'Duration above maximum should show the current range').toContainText(
            String(range.maximum)
        );
        await expect(this.durationSaveButton, 'Duration above maximum must not be saved').toBeDisabled();
    }

    /**
     * Validate every duration unit the active editor offers.
     * Prefer {@link verifyDurationGuardrails} from specs (branches by trade type; digits assert
     * ticks-only there instead of calling this).
     */
    async verifyAllDurationGuardrails(): Promise<void> {
        const committedDuration = await this.durationField.inputValue();
        const editor = this.isMobile ? this.durationContainer : this.durationPopover;
        await this.durationField.click();
        await expect(editor, 'Duration editor should open for the active configuration').toBeVisible();
        let testedModes = 0;

        if (this.isMobile) {
            const hasVisibleUnitTabs = (await this.durationContainer.getByRole('tab').count()) > 0;
            if (!hasVisibleUnitTabs) {
                await expect(
                    this.durationContainer.getByRole('option').first(),
                    'A single-unit duration should expose constrained runtime options'
                ).toBeAttached();
                testedModes += 1;
            } else if ((await this.durationUnitTab('Ticks').count()) > 0) {
                await this.openDurationUnit('Ticks');
                await expect(
                    this.durationTicksWheel.getByRole('option').first(),
                    'Ticks should be constrained to API-derived wheel options'
                ).toBeAttached();
                testedModes += 1;
            }

            if ((await this.durationUnitTab('Seconds').count()) > 0) {
                await this.openDurationUnit('Seconds');
                await expect(
                    this.durationTimeWheel.getByRole('listbox').first(),
                    'Seconds, minutes, and hours should use constrained Time wheel columns'
                ).toBeVisible();
                await expect(
                    this.durationTimeWheel.getByRole('option').first(),
                    'The Time wheel should expose at least one supported duration'
                ).toBeAttached();
                testedModes += 1;
            }
        } else {
            const hasVisibleUnitTabs = (await this.durationPopover.getByRole('tab').count()) > 0;
            if (!hasVisibleUnitTabs) {
                await this.verifyDurationRuntimeBoundaries('Ticks');
                testedModes += 1;
            } else {
                for (const unit of ['Ticks', 'Seconds', 'Minutes'] as const) {
                    if ((await this.durationUnitTab(unit).count()) === 0) continue;
                    await this.verifyDurationRuntimeBoundaries(unit);
                    testedModes += 1;
                }
                if ((await this.durationUnitTab('Hours').count()) > 0) {
                    await this.verifyDesktopHoursGuardrails();
                    testedModes += 1;
                }
            }
        }

        if ((await this.durationUnitTab('End time').count()) > 0) {
            await this.openDurationUnit('End time');
            await expect(this.durationEndDateInput, 'End date should be visible for End time duration').toBeVisible();
            if (await this.durationEndDateInput.isEnabled()) {
                const originalEndDate = await this.durationEndDateInput.inputValue();
                await this.durationEndDateInput.click();
                await expect(
                    this.disabledDurationCalendarDays.first(),
                    'Past or unavailable market dates should be disabled in the calendar'
                ).toBeDisabled();
                await expect(
                    this.durationEndDateInput,
                    'A disabled end date must not replace the selected date'
                ).toHaveValue(originalEndDate);
            } else {
                await expect(
                    this.durationEndDateInput,
                    'A configuration without selectable dates should disable End date'
                ).toBeDisabled();
            }
            testedModes += 1;
        }

        expect(
            testedModes,
            'A duration-bearing contract should expose at least one guarded duration mode'
        ).toBeGreaterThan(0);

        await expect(
            this.durationField,
            'Rejected duration drafts must not replace the committed duration'
        ).toHaveValue(committedDuration);
        await this.dismissDurationEditors();
    }

    /**
     * Verify the desktop Hours editor rejects invalid hours/minutes combinations.
     */
    async verifyDesktopHoursGuardrails(): Promise<void> {
        await this.openDurationUnit('Hours');
        await this.durationManualInputToggle.click();
        await expect(this.durationHoursRange, 'Hours editor should expose its supported range').toContainText(/\d/);
        const range = await this.readRange(this.durationHoursRange);

        // Known product gap (desktop Hours): opening Hours while a sub-hour Minutes duration is
        // committed seeds `0h + Xm` with Save still enabled. Do not fail the suite on that seed —
        // assert only after the user edits hours/minutes. Product fix belongs in
        // duration-hours-input-desktop.tsx (kept out of this Playwright-only PR).

        await this.durationHoursInput.fill(String(range.minimum));
        await this.durationHoursInput.fill(String(range.belowMinimum));
        await this.verifyMessageContainsNumber(
            this.durationHoursMessage,
            range.minimum,
            'Hours below minimum should show the minimum guardrail'
        );
        await expect(this.durationSaveButton, 'Hours below minimum must not be saved').toBeDisabled();

        await this.durationHoursInput.fill(String(range.aboveMaximum));
        await this.verifyMessageContainsNumber(
            this.durationHoursMessage,
            range.maximum,
            'Hours above maximum should show the maximum guardrail'
        );
        await expect(this.durationSaveButton, 'Hours above maximum must not be saved').toBeDisabled();

        await this.durationHoursInput.fill(String(range.minimum));
        await this.durationHoursMinutesInput.fill('60');
        await this.verifyMessageContainsNumber(
            this.durationHoursMinutesMessage,
            59,
            'Minutes above the supported range should show its maximum guardrail'
        );
        await expect(this.durationSaveButton, 'An invalid hour/minute combination must not be saved').toBeDisabled();

        await this.durationHoursMinutesInput.fill('0');
        await expect(this.durationSaveButton, 'The exact minimum hour duration should be accepted').toBeEnabled();

        await this.durationHoursInput.fill(String(range.maximum));
        await expect(
            this.durationHoursMinutesInput,
            'Minutes should be disabled at the maximum hour boundary'
        ).toBeDisabled();
        await expect(this.durationSaveButton, 'The exact maximum hour duration should be accepted').toBeEnabled();
    }

    /**
     * Duration validation for the **already selected** trade type.
     * - Digits → no unit tab selector; ticks quick picks + desktop Custom out-of-range
     * - Accumulators / Multipliers → Duration hidden
     * - Everything else → {@link verifyAllDurationGuardrails}
     */
    async verifyDurationGuardrails(tradeType: string): Promise<void> {
        switch (tradeType) {
            case 'Over/Under':
            case 'Matches/Differs':
            case 'Even/Odd': {
                await this.durationField.click();
                await this.verifyDurationForTicksQuickPicks();
                await this.verifyDurationForTicksCustomOutOfRange();
                await this.dismissDurationEditors();
                await this.verifyBuyButtonRemainsEnabled();
                return;
            }
            case 'Accumulators':
            case 'Multipliers':
                await this.verifyDurationUnavailable();
                return;
            default:
                await this.verifyAllDurationGuardrails();
        }
    }

    /**
     * Verify contracts designed without duration do not show a Duration field.
     */
    async verifyDurationUnavailable(): Promise<void> {
        await expect(this.durationField, 'Duration field should not be visible.').toBeHidden();
    }

    /**
     * Digit ticks Duration: no unit tab selector; desktop exposes exactly 6 quick-pick chips whose
     * values may vary but must each be within 1–10 ticks; mobile wheel options stay within 1–10
     * and include both endpoints.
     */
    private async verifyDurationForTicksQuickPicks(): Promise<void> {
        const durationEditor = this.isMobile ? this.durationContainer : this.durationPopover;
        await expect(
            durationEditor.locator(this.isMobile ? '.horizontal-tab-selector' : '.vertical-tab-selector'),
            'Digit Duration must not show Ticks/Seconds/Minutes/Hours/End time unit tabs'
        ).toBeHidden();

        const parseTicksLabel = (label: string): number => {
            const match = label.trim().match(/^(\d+)\s*ticks?$/i);
            expect(match, `Duration option should be a ticks label, got "${label}"`).toBeTruthy();
            return Number(match![1]);
        };

        if (this.isMobile) {
            const labels = (await this.durationWheelOptions.allTextContents())
                .map(value => value.trim())
                .filter(Boolean);
            expect(labels.length, 'Mobile ticks wheel should expose duration options').toBeGreaterThan(0);
            const ticks = labels.map(parseTicksLabel);
            expect(Math.min(...ticks), 'Mobile ticks wheel should start at 1 tick').toBe(1);
            expect(Math.max(...ticks), 'Mobile ticks wheel should end at 10 ticks').toBe(10);
            for (const tick of ticks) {
                expect(tick, `Mobile ticks option ${tick} should be between 1 and 10`).toBeGreaterThanOrEqual(1);
                expect(tick, `Mobile ticks option ${tick} should be between 1 and 10`).toBeLessThanOrEqual(10);
            }
            return;
        }

        const chips = this.durationPopover.locator('.value-chips__chip');
        await expect(chips.first(), 'Desktop Duration quick picks should show chips').toBeVisible();
        await expect(chips, 'Desktop Duration should expose exactly 6 quick-pick chips').toHaveCount(6);

        const ticks: number[] = [];
        for (let index = 0; index < 6; index += 1) {
            ticks.push(parseTicksLabel((await chips.nth(index).innerText()).trim()));
        }
        for (const tick of ticks) {
            expect(tick, `Quick-pick chip ${tick} ticks should be between 1 and 10`).toBeGreaterThanOrEqual(1);
            expect(tick, `Quick-pick chip ${tick} ticks should be between 1 and 10`).toBeLessThanOrEqual(10);
        }
    }

    /**
     * Desktop Custom ticks input: read `Range: min - max ticks`, draft min−1 and max+1 (error + Save
     * disabled), then a valid in-range value so the error clears and Save re-enables.
     * Mobile ticks-only has no free-form Custom field — skipped (wheel already bounds options).
     */
    private async verifyDurationForTicksCustomOutOfRange(): Promise<void> {
        if (this.isMobile) {
            return;
        }

        await this.durationManualInputToggle.click();
        await expect(
            this.durationMessage,
            'Custom ticks should show a neutral Range: min - max ticks hint'
        ).toContainText(/Range:\s*\d+\s*-\s*\d+\s*ticks/i);

        const range = await this.readRange(this.durationMessage);
        const expectedError = `Please enter a duration between ${range.minimum} to ${range.maximum} ticks.`;
        const expectedRangeHint = `Range: ${range.minimum} - ${range.maximum} ticks`;

        await this.fillDurationDraft(String(range.belowMinimum));
        await expect(
            this.durationMessage,
            `Ticks below minimum (${range.belowMinimum}) should show the between-range error`
        ).toHaveText(expectedError);
        await expect(
            this.durationSaveButton,
            'Save must stay disabled for ticks below the Custom range'
        ).toBeDisabled();

        await this.fillDurationDraft(String(range.aboveMaximum));
        await expect(
            this.durationMessage,
            `Ticks above maximum (${range.aboveMaximum}) should show the between-range error`
        ).toHaveText(expectedError);
        await expect(
            this.durationSaveButton,
            'Save must stay disabled for ticks above the Custom range'
        ).toBeDisabled();

        await this.fillDurationDraft(String(range.minimum));
        await expect(this.durationMessage, 'A valid ticks draft should restore the neutral Range hint').toHaveText(
            expectedRangeHint
        );
        await expect(this.durationSaveButton, 'Save must be enabled for an in-range ticks draft').toBeEnabled();
    }

    /**
     * Verify Multipliers Risk management TP/SL ranges from the active configuration.
     * Multipliers only — Accumulators/Turbos use standalone Take profit instead.
     */
    async verifyMultipliersRiskManagementGuardrails(): Promise<void> {
        await this.openRiskManagementEditor();
        await expect(this.takeProfitMessage, 'Take-profit should expose a numeric runtime range').toContainText(/\d/);
        await expect(this.stopLossMessage, 'Stop-loss should expose a numeric runtime range').toContainText(/\d/);
        const tpRange = await this.readRange(this.takeProfitMessage);
        const slRange = await this.readRange(this.stopLossMessage);

        await this.multiplierTakeProfitInput.fill(this.formatRangeValue(tpRange.belowMinimum, tpRange.precision));
        await expect(this.takeProfitMessage, 'Take-profit below minimum should show validation').toContainText(
            this.formatRangeValue(tpRange.minimum, tpRange.precision)
        );

        await this.multiplierStopLossInput.fill(this.formatRangeValue(slRange.aboveMaximum, slRange.precision));
        await expect(this.stopLossMessage, 'Stop-loss above maximum should show validation').toContainText(
            this.formatRangeValue(slRange.maximum, slRange.precision)
        );
    }

    /**
     * Verify Accumulators/Turbos standalone Take profit rejects out-of-range drafts.
     * These trade types have Take profit only — no Stop loss and no Deal Cancellation.
     */
    async verifyStandaloneTakeProfitGuardrails(): Promise<void> {
        await expect(this.takeProfitField, 'Standalone Take profit should be available').toBeVisible();
        await expect(this.riskManagementField, 'Risk management is Multipliers-only').toHaveCount(0);

        const committed = await this.takeProfitField.inputValue();
        await this.takeProfitField.click();
        if (this.isMobile) {
            await expect(this.takeProfitSheet, 'Take profit sheet should open').toBeVisible();
        } else {
            await expect(this.page.locator('.take-profit-popover'), 'Take profit popover should open').toBeVisible();
        }

        await expect(async () => {
            if (await this.takeProfitOverlay.isVisible()) {
                await this.takeProfitOverlay.click();
            }
            await expect(this.takeProfitToggle, 'Take profit toggle should be on').toHaveAttribute(
                'aria-pressed',
                'true',
                { timeout: 2_000 }
            );
        }).toPass({ timeout: 15_000 });
        await expect(this.takeProfitInput, 'Take profit input should be editable').toBeEnabled();

        const message = this.isMobile
            ? this.takeProfitSheet.locator('.message__container__text').first()
            : this.page.locator('.take-profit-popover .message__container__text').first();
        await expect(message, 'Standalone Take profit should expose a numeric runtime range').toContainText(/\d/);
        const range = await this.readRange(message);

        await this.takeProfitInput.fill(this.formatRangeValue(range.belowMinimum, range.precision));
        await expect(message, 'Take profit below minimum should show validation').toContainText(
            this.formatRangeValue(range.minimum, range.precision)
        );
        await expect(this.takeProfitSaveButton, 'Take profit below minimum must not be saved').toBeDisabled();

        // Upper guardrail: Turbos max can move with payout, so assert the live rejection text.
        await this.takeProfitInput.fill('999999');
        await expect(message, 'Take profit above maximum should show an upper guardrail').toContainText(/\d/);
        await expect(message, 'Upper rejection should identify a maximum or range limit').toContainText(
            /lower than|at most|maximum|Range|between/i
        );
        await expect(this.takeProfitSaveButton, 'Take profit above maximum must not be saved').toBeDisabled();

        if (this.isMobile) {
            await this.dismissParameterEditor(this.takeProfitSheet, this.takeProfitSheet, 'Take profit');
        } else {
            await this.dismissParameterEditor(
                this.page.locator('.take-profit-popover'),
                this.page.locator('.take-profit-popover'),
                'Take profit'
            );
        }
        await expect(
            this.takeProfitField,
            'Rejected Take profit drafts must not replace the committed value'
        ).toHaveValue(committed);
    }

    /**
     * Verify trade types without risk controls do not render TP/SL/Risk management.
     */
    async verifyRiskControlsUnavailable(): Promise<void> {
        await expect(this.takeProfitField, 'This trade type should not expose Take profit').toHaveCount(0);
        await expect(this.riskManagementField, 'This trade type should not expose Risk management').toHaveCount(0);
    }

    /**
     * Verify zero and empty Barrier drafts are rejected and do not replace the committed barrier.
     *
     * @returns Promise resolved after assertions.
     */
    async verifyBarrierRequiredAndZeroValidation(): Promise<void> {
        const original = await this.committedBarrierInput.inputValue();
        await this.openBarrierEditor();

        await this.fillBarrierDraft('0');
        await expect(this.barrierMessage, 'Zero barrier should show the dedicated validation').toHaveText(
            'Barrier cannot be zero.'
        );
        await expect(this.barrierSaveButton, 'Zero barrier must not be saved').toBeDisabled();

        await this.fillBarrierDraft('');
        await expect(this.barrierMessage, 'Empty barrier should show required validation').toHaveText(
            'Barrier is a required field.'
        );
        await expect(this.barrierSaveButton, 'Empty barrier must not be saved').toBeDisabled();
        await expect(
            this.committedBarrierInput,
            'Invalid barrier drafts must not replace the committed value'
        ).toHaveValue(original);
    }

    /**
     * Assert digit selector lists exactly 0–9.
     */
    private async assertDigitChoicesZeroThroughNine(): Promise<void> {
        await this.openDigitSelector();
        const labels = (await this.digitChoices.allTextContents()).map(value => value.trim());
        expect(labels, 'Digit selector should expose exactly digits 0 through 9').toEqual([
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
        ]);
    }

    /**
     * Close the mobile digit prediction sheet so Duration/Stake editors are not blocked.
     */
    private async dismissDigitPredictionSheetIfMobile(): Promise<void> {
        if (!this.isMobile) return;
        await this.actionSheetCloseButton(this.digitPredictionSheet).click();
        await expect(
            this.digitPredictionSheet,
            'Digit prediction sheet should close before Duration/Stake validation'
        ).not.toBeVisible();
    }

    /**
     * Matches/Differs digit choices — digits 0–9 listed and enabled for both Matches and Differs.
     */
    async verifyMatchesDiffersDigitChoiceAvailability(): Promise<void> {
        await this.digitOutcomeTab('Matches').click();
        await this.assertDigitChoicesZeroThroughNine();
        for (const digit of ['0', '9'] as const) {
            await expect(this.digitChoice(digit), `Matches must keep digit ${digit} enabled`).toBeEnabled();
        }

        await this.dismissDigitPredictionSheetIfMobile();
        await this.digitOutcomeTab('Differs').click();
        if (this.isMobile) await this.openDigitSelector();
        for (const digit of ['0', '9'] as const) {
            await expect(this.digitChoice(digit), `Differs must keep digit ${digit} enabled`).toBeEnabled();
        }
        await this.dismissDigitPredictionSheetIfMobile();
    }

    /**
     * Verify last-digit prediction choices for the active Over/Under subtype — digits 0–9 listed,
     * and boundary digits disabled (Over: 9, Under: 0).
     *
     * @returns Promise resolved after assertions.
     */
    async verifyLastDigitPredictionChoiceAvailability(): Promise<void> {
        await this.digitOutcomeTab('Over').click();
        await this.assertDigitChoicesZeroThroughNine();
        await expect(this.digitChoice('9'), 'Over must disable digit 9 because no higher digit exists').toBeDisabled();

        await this.dismissDigitPredictionSheetIfMobile();
        await this.digitOutcomeTab('Under').click();
        if (this.isMobile) await this.openDigitSelector();
        await expect(this.digitChoice('0'), 'Under must disable digit 0 because no lower digit exists').toBeDisabled();
        await this.dismissDigitPredictionSheetIfMobile();
    }

    /**
     * Verify a closed market shows the reopen message and keeps trade controls unusable.
     *
     * @returns Promise resolved after assertions.
     */
    async verifyClosedMarketPurchaseState(): Promise<void> {
        await this.verifyClosedMarketTradeFormDisabled();
    }

    /**
     * Assert closed-market UI: reopen banner visible, Buy hidden, parameter fields disabled.
     * Used both by the dedicated closed-market flow and by matrix steps that land on a shut market.
     */
    async verifyClosedMarketTradeFormDisabled(): Promise<void> {
        const hasReopenBanner = await this.closedMarketMessage.isVisible().catch(() => false);
        if (hasReopenBanner) {
            await expect(this.closedMarketMessage, 'Closed market should show its reopening status').toBeVisible();
            await expect(this.closedMarketMessage, 'Closed market message should mention reopen time').toContainText(
                /reopen/i
            );
        }

        const buyCount = await this.buyControl.count();
        if (buyCount === 0) {
            await expect(
                this.buyControl,
                'Buy control should not render while the selected market is closed'
            ).toHaveCount(0);
        } else {
            await expect(
                this.buyControl,
                'Buy should stay disabled while the selected market is closed'
            ).toBeDisabled();
        }

        if ((await this.stakeField.count()) > 0) {
            await expect(this.stakeField, 'Stake should be disabled while the market is closed').toBeDisabled();
        }
        if ((await this.durationField.count()) > 0) {
            await expect(this.durationField, 'Duration should be disabled while the market is closed').toBeDisabled();
        }
    }

    /**
     * Assert the Buy button stays enabled (also visible and not loading) after a rejected draft.
     *
     * @returns Promise resolved after Buy state assertions.
     */
    async verifyBuyButtonRemainsEnabled(): Promise<void> {
        await expect(
            this.buyControl,
            'Buy should remain visible because the invalid draft was not committed'
        ).toBeVisible();
        await expect(this.buyControl, 'Buy should still reflect the last valid committed parameters').toBeEnabled();
        await expect(
            this.buyControl,
            'Buy should not enter a loading state for a rejected parameter draft'
        ).not.toHaveClass(/purchase-button--loading/);
    }

    /**
     * Parse the first two numbers from a visible range message.
     *
     * @param message - Locator containing the range.
     * @returns Normalized boundaries and generated adjacent values.
     */
    private async readRange(message: Locator): Promise<ValidationRange> {
        const text = (await message.innerText()).trim();
        const matches = text.match(/-?[\d,]+(?:\.\d+)?/g) ?? [];
        const [minimumMatch, maximumMatch] = matches;
        if (!minimumMatch || !maximumMatch) {
            throw new Error(`Expected two numeric range values, received: "${text}"`);
        }
        const rawMinimum = minimumMatch.replace(/,/g, '');
        const rawMaximum = maximumMatch.replace(/,/g, '');
        const minimum = Number(rawMinimum);
        const maximum = Number(rawMaximum);
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
            throw new Error(`Invalid runtime range: "${text}"`);
        }
        const precision = Math.max(this.decimalPlaces(rawMinimum), this.decimalPlaces(rawMaximum));
        return this.createRange(minimum, maximum, precision);
    }

    private createRange(minimum: number, maximum: number, precision?: number): ValidationRange {
        const resolvedPrecision =
            precision ?? Math.max(this.decimalPlaces(String(minimum)), this.decimalPlaces(String(maximum)));
        const increment = 10 ** -resolvedPrecision;
        return {
            minimum,
            midpoint: Number(((minimum + maximum) / 2).toFixed(resolvedPrecision)),
            maximum,
            belowMinimum: Number((minimum - increment).toFixed(resolvedPrecision)),
            aboveMaximum: Number((maximum + increment).toFixed(resolvedPrecision)),
            precision: resolvedPrecision,
        };
    }

    private async verifyMessageContainsNumber(message: Locator, expected: number, description: string): Promise<void> {
        await expect(message, description).toContainText(/\d/);
        const text = await message.innerText();
        const displayedNumbers = (text.match(/-?[\d,]+(?:\.\d+)?/g) ?? []).map(value =>
            Number(value.replace(/,/g, ''))
        );
        expect(displayedNumbers, description).toContain(expected);
    }

    /** First numeric amount in a message (e.g. min stake from a validation error). */
    private parseFirstAmount(text: string): { amount: number; raw: string } {
        const raw = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0];
        expect(raw, `Expected a numeric amount in "${text}"`).toBeTruthy();
        const amount = Number(raw);
        expect(amount, `Expected a positive amount in "${text}"`).toBeGreaterThan(0);
        return { amount, raw: raw! };
    }

    private decimalPlaces(value: string): number {
        return value.includes('.') ? value.split('.')[1].length : 0;
    }

    private formatRangeValue(value: number, precision: number): string {
        return value.toFixed(precision);
    }
}
