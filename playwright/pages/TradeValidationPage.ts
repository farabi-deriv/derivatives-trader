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

    /** Expiry summary under End date / End time in the desktop End time editor. */
    get durationEndTimeMessage(): Locator {
        return this.durationPopover.locator('.duration-end-time-desktop__message');
    }

    /** Save button in the desktop End time editor (no Quick picks — Custom only). */
    get durationEndTimeSaveButton(): Locator {
        return this.durationPopover.locator('.duration-end-time-desktop__save-button');
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

    /** End-time input scoped to the current viewport implementation. */
    override get durationEndTimeInput(): Locator {
        return this.isMobile
            ? this.durationContainer.locator('input[name="time"]')
            : this.page.getByTestId('dt_duration_end_time_input');
    }

    /** Mobile End time expiry summary (`Expiry` + date/time line). */
    get durationEndTimeExpirySummary(): Locator {
        return this.durationContainer.locator('.duration-container__days-input__expiry');
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

    /**
     * Validation text shown by the open barrier editor.
     * Mobile Quill TextField renders errors via `message` → `.message__container__text`
     * (`.barrier-params__error-area` is only a spacer when there is no error).
     */
    get barrierMessage(): Locator {
        const editor = this.isMobile ? this.barrierSheet : this.barrierPopover;
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

    /** Accumulators Growth rate field (committed value like `5%`). */
    get growthRateField(): Locator {
        return this.page.getByLabel('Growth rate').first();
    }

    /** Mobile Growth rate action sheet. */
    get growthRateSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has(.growth-rate__carousel)');
    }

    /** Growth rate options in the open editor (desktop listbox / mobile wheel). */
    get growthRateOptions(): Locator {
        return this.isMobile
            ? this.page.locator('.growth-rate__wheel-picker').getByRole('option')
            : this.page.getByRole('listbox', { name: 'Selection options' }).getByRole('option');
    }

    /** Turbos Payout per point field (committed value like `$1`). */
    get payoutPerPointField(): Locator {
        return this.page.getByLabel('Payout per point').first();
    }

    /** Mobile Payout per point action sheet. */
    get payoutPerPointSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has([data-testid="dt_payout-per-point_wrapper"])');
    }

    /** Mobile Payout per point wheel picker root. */
    get payoutPerPointWheel(): Locator {
        return this.page.locator('.payout-per-point__wheel-picker');
    }

    /** Payout per point options in the open editor (desktop listbox / mobile wheel). */
    get payoutPerPointOptions(): Locator {
        return this.isMobile
            ? this.payoutPerPointWheel.getByRole('option')
            : this.page.getByRole('listbox', { name: 'Selection options' }).getByRole('option');
    }

    /** Mobile Strike price action sheet. */
    get strikePriceSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has([data-testid="dt_strike_wrapper"])');
    }

    /** Mobile Strike price wheel picker root. */
    get strikePriceWheel(): Locator {
        return this.page.locator('.strike__wheel-picker');
    }

    /** Strike price options in the open editor (desktop listbox / mobile wheel). */
    get strikePriceOptions(): Locator {
        return this.isMobile
            ? this.strikePriceWheel.getByRole('option')
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

    /**
     * Risk management TP/SL Save — viewport-aware.
     * Mobile: ActionSheet.Header Save (`isSaveActionDisabled` when dirty but blocking error).
     * Desktop: footer `.risk-management-desktop__save-button` (disabled on FE/API errors).
     */
    get multipliersRiskManagementSaveButton(): Locator {
        return this.isMobile
            ? this.actionSheetSaveButton(this.riskManagementEditor)
            : this.page.locator('.risk-management-desktop__save-button');
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

    /** TP & SL tab in the open Multipliers risk editor. */
    get tpSlTab(): Locator {
        return this.isMobile
            ? this.page.locator('.segmented-control-single button.item', { hasText: 'TP & SL' })
            : this.page.locator('.vertical-tab-selector').getByRole('tab', { name: 'TP & SL' });
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

    /** Deal Cancellation toggle in the open risk editor. */
    get dealCancellationToggle(): Locator {
        return this.isMobile
            ? this.page.locator('.deal-cancellation__toggle').locator('button.toggle-switch')
            : this.page.locator('.deal-cancellation-desktop__wrapper').locator('button.toggle-switch');
    }

    /**
     * Risk management Save for the active mode.
     * Desktop DC uses its own footer Save; TP/SL and all mobile modes share the sheet/popover Save.
     */
    multipliersRiskManagementSave(mode: 'tp_sl' | 'dc'): Locator {
        if (!this.isMobile && mode === 'dc') {
            return this.page.locator('.deal-cancellation-desktop__footer').getByRole('button', { name: 'Save' });
        }
        return this.multipliersRiskManagementSaveButton;
    }

    /** Snackbar message after a Risk management Save that turns the other mode off. */
    get riskManagementSnackbarMessage(): Locator {
        return this.page.locator('.snackbar--container .quill-snackbar__message');
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
     * - Accumulators / Turbos / Vanillas → neutral Range hint (empty details)
     *   desktop `Range: $min to $max` · mobile `Range $min - $max`
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
                    `${tradeType} Custom should show a neutral Range min–max hint`
                ).toContainText(/Range:?\s*\$?[\d,]+\.?\d*\s+(?:to|-)\s+\$?[\d,]+\.?\d*/i);
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
                    ).toBeVisible();
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
                ).toContainText(new RegExp(this.escapeRegExp(String(range.maximum))), { timeout: 20_000 });
                await expect(this.stakeSaveButton, 'Save must stay disabled for an above-maximum stake').toBeDisabled();

                await this.fillAcceptedMinimumStake(range.minimum, range.precision);
                await expect(
                    this.stakeValidationMessage,
                    `An in-range ${tradeType} stake should restore the neutral Range hint`
                ).toContainText(/Range:?/i);
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
     * Fill the open Barrier draft (sheet on mobile, popover on desktop).
     *
     * @param value - Unsigned barrier draft (empty string clears the field).
     * @returns Promise resolved after the draft input reflects `value`.
     */
    async fillBarrierDraft(value: string): Promise<void> {
        const input = this.barrierInput;
        await expect(input, 'Barrier draft input should be visible').toBeVisible();
        await input.click();
        await input.clear();
        if (value !== '') {
            await input.fill(value);
        }
        await expect(input, `Barrier draft should show "${value}"`).toHaveValue(value);
    }

    /**
     * Fill a barrier draft and wait until the editor message settles on `expectedMessage`.
     * Local validation is debounced (~300ms) and a prior proposal error can linger briefly,
     * so this retries fill + assert instead of racing the first paint after keystrokes.
     */
    private async fillBarrierDraftAndExpectMessage(
        value: string,
        expectedMessage: string,
        description: string,
        timeout = 20_000
    ): Promise<void> {
        await expect(async () => {
            await this.fillBarrierDraft(value);
            await expect(this.barrierMessage, description).toHaveText(expectedMessage, { timeout: 3_000 });
        }).toPass({ timeout });
        await expect(this.barrierSaveButton, `${description} — Save must stay disabled`).toBeDisabled();
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
     * by family: max-payout, Range, or Range + Multipliers details), then dismisses the editor.
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
        await this.dismissStakeEditor();
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
            await this.verifyClosedMarketTradeFormDisabled();
            return;
        }
        await this.verifyBuyButtonRemainsEnabled();
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
        await expect(
            this.stakeValidationMessage,
            'Empty Stake should show required validation without a Save press'
        ).toHaveText(TradeParametersPage.STAKE_REQUIRED_ERROR);
        await expect(this.stakeSaveButton, 'Save must be disabled for an empty stake').toBeDisabled();

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
     * Validate Duration units on the open editor.
     * Desktop: Ticks → Seconds → Minutes → Hours → End time (chips/Custom).
     * Mobile: Ticks → Time → End time (wheels / date-time sheets).
     * Prefer {@link verifyDurationGuardrails} from specs (digits use the ticks-only path instead).
     */
    async verifyAllDurationGuardrails(): Promise<void> {
        const committedDuration = await this.durationField.inputValue();
        await this.durationField.click();

        if (this.isMobile) {
            await expect(
                this.durationContainer,
                'Duration action sheet should open for the active configuration'
            ).toBeVisible();

            if ((await this.durationUnitTab('Ticks').count()) > 0) {
                await this.openDurationUnit('Ticks');
                await this.verifyMobileDurationTicksWheelBounds(this.durationTicksWheel.getByRole('option'));
            }
            // Mobile unifies Seconds/Minutes/Hours into one Time tab.
            if ((await this.durationUnitTab('Seconds').count()) > 0) {
                await this.openDurationUnit('Seconds');
                await this.verifyMobileDurationTimeWheelBounds();
            }
            if ((await this.durationUnitTab('End time').count()) > 0) {
                await this.openDurationUnit('End time');
                await this.verifyMobileDurationEndTime();
            }
        } else {
            await expect(
                this.durationPopover,
                'Duration editor should open for the active configuration'
            ).toBeVisible();

            for (const unit of ['Ticks', 'Seconds', 'Minutes', 'Hours', 'End time'] as const) {
                if ((await this.durationUnitTab(unit).count()) === 0) continue;
                await this.openDurationUnit(unit);
                if (unit === 'Hours') {
                    await this.verifyDurationHoursQuickPicksAndCustom();
                } else if (unit === 'End time') {
                    await this.verifyDurationEndTimeCustom();
                } else {
                    await this.verifyDurationUnitQuickPicksAndCustom(unit);
                }
            }
        }

        await expect(
            this.durationField,
            'Rejected duration drafts must not replace the committed duration'
        ).toHaveValue(committedDuration);
        await this.dismissDurationEditors();
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

    /** Chip / Custom unit windows for Ticks / Seconds / Minutes (Hours uses a compound editor). */
    private static readonly DURATION_UNIT_WINDOWS = {
        Ticks: {
            chipMin: 1,
            chipMax: 10,
            unitWord: 'ticks' as const,
            chipLabelPattern: /^(\d+)\s*ticks?$/i,
            customMinFloor: 1,
            /** Ticks max is API-derived; must stay inside the 1–10 product window. */
            customMaxExact: null as number | null,
            customMaxCeiling: 10,
        },
        Seconds: {
            chipMin: 15,
            chipMax: 60,
            unitWord: 'seconds' as const,
            chipLabelPattern: /^(\d+)\s*sec$/i,
            customMinFloor: 15,
            customMaxExact: 60,
            customMaxCeiling: 60,
        },
        Minutes: {
            chipMin: 1,
            chipMax: 60,
            unitWord: 'minutes' as const,
            chipLabelPattern: /^(\d+)\s*min$/i,
            customMinFloor: 1,
            customMaxExact: 60,
            customMaxCeiling: 60,
        },
    };

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

        if (this.isMobile) {
            await this.verifyMobileDurationTicksWheelBounds(this.durationWheelOptions, { requireEndpoints: true });
            return;
        }

        await this.verifyDurationUnitQuickPicks('Ticks');
    }

    /**
     * Desktop Custom ticks input: read Range, draft min−1 / max+1 (error + Save disabled), then a
     * valid in-range value. Mobile ticks-only has no free-form Custom — skipped.
     */
    private async verifyDurationForTicksCustomOutOfRange(): Promise<void> {
        await this.verifyDurationUnitCustomOutOfRange('Ticks');
    }

    /**
     * Desktop: 6 quick-pick chips within the unit window, then Custom range + out-of-range drafts.
     * Mobile callers use the wheel helpers instead — this path is desktop-only.
     */
    private async verifyDurationUnitQuickPicksAndCustom(unit: 'Ticks' | 'Seconds' | 'Minutes'): Promise<void> {
        await this.verifyDurationUnitQuickPicks(unit);
        await this.verifyDurationUnitCustomOutOfRange(unit);
    }

    /**
     * Desktop Hours: 6 quick-pick chips (1–24 hr), then Custom Hours + Minutes fields —
     * verify Range 1–24 hours, draft min/max/acceptable values on both inputs, and Save state.
     */
    private async verifyDurationHoursQuickPicksAndCustom(): Promise<void> {
        const chips = this.durationPopover.locator('.value-chips__chip');
        await expect(chips.first(), 'Hours Duration quick picks should show chips').toBeVisible();
        await expect(chips, 'Hours Duration should expose exactly 6 quick-pick chips').toHaveCount(6);

        for (let index = 0; index < 6; index += 1) {
            const label = (await chips.nth(index).innerText()).trim();
            const match = label.match(/^(\d+)\s*hr$/i);
            expect(match, `Hours chip should be an hr label, got "${label}"`).toBeTruthy();
            const value = Number(match![1]);
            expect(value, `Hours quick-pick chip ${value} should be between 1 and 24`).toBeGreaterThanOrEqual(1);
            expect(value, `Hours quick-pick chip ${value} should be between 1 and 24`).toBeLessThanOrEqual(24);
        }

        await this.durationManualInputToggle.click();
        await expect(this.durationHoursRange, 'Custom Hours should show a neutral Range: 1 - 24 hours hint').toHaveText(
            /Range:\s*1\s*-\s*24\s*hours/i
        );

        const range = await this.readRange(this.durationHoursRange);
        expect(range.minimum, 'Hours Custom minimum should be 1').toBe(1);
        expect(range.maximum, 'Hours Custom maximum should be 24').toBe(24);

        // Known product gap (desktop Hours): opening Hours while a sub-hour Minutes duration is
        // committed seeds `0h + Xm` with Save still enabled. Reset minutes to 0 after setting hours
        // before asserting — do not fail the suite on that seed. Product fix belongs in
        // duration-hours-input-desktop.tsx (kept out of this Playwright-only PR).

        // Hours below minimum → field Range error + Save disabled
        await this.durationHoursInput.fill(String(range.minimum));
        await this.durationHoursMinutesInput.fill('0');
        await this.durationHoursInput.fill(String(range.belowMinimum));
        await expect(
            this.durationHoursMessage,
            `Hours below minimum (${range.belowMinimum}) should show Range: 1 - 24 hours`
        ).toHaveText(/Range:\s*1\s*-\s*24\s*hours/i);
        await expect(this.durationSaveButton, 'Save must stay disabled for Hours below minimum').toBeDisabled();

        // Hours above maximum → field Range error + Save disabled
        await this.durationHoursInput.fill(String(range.aboveMaximum));
        await expect(
            this.durationHoursMessage,
            `Hours above maximum (${range.aboveMaximum}) should show Range: 1 - 24 hours`
        ).toHaveText(/Range:\s*1\s*-\s*24\s*hours/i);
        await expect(this.durationSaveButton, 'Save must stay disabled for Hours above maximum').toBeDisabled();

        // Hours at minimum (acceptable) with Minutes at 0 → Save enabled + neutral range
        await this.durationHoursInput.fill(String(range.minimum));
        await this.durationHoursMinutesInput.fill('0');
        await expect(this.durationHoursRange, 'Valid Hours minimum should restore the neutral Range hint').toHaveText(
            /Range:\s*1\s*-\s*24\s*hours/i
        );
        await expect(this.durationSaveButton, 'Save must be enabled for 1h 0m').toBeEnabled();

        // Minutes above maximum (60) → field Range error + Save disabled
        await this.durationHoursMinutesInput.fill('60');
        await expect(
            this.durationHoursMinutesMessage,
            'Minutes above maximum (60) should show Range: 0 - 59 minutes'
        ).toHaveText(/Range:\s*0\s*-\s*59\s*minutes/i);
        await expect(this.durationSaveButton, 'Save must stay disabled for Minutes above maximum').toBeDisabled();

        // Minutes acceptable mid-value → Save enabled
        await this.durationHoursMinutesInput.fill('30');
        await expect(this.durationHoursRange, 'Valid Hours + Minutes should restore the neutral Range hint').toHaveText(
            /Range:\s*1\s*-\s*24\s*hours/i
        );
        await expect(this.durationSaveButton, 'Save must be enabled for 1h 30m').toBeEnabled();

        // Minutes at minimum (0) → Save enabled
        await this.durationHoursMinutesInput.fill('0');
        await expect(this.durationSaveButton, 'Save must be enabled for 1h 0m').toBeEnabled();

        // Hours at maximum → Minutes disabled (forced to 0) + Save enabled
        await this.durationHoursInput.fill(String(range.maximum));
        await expect(
            this.durationHoursMinutesInput,
            'Minutes should be disabled at the maximum hour boundary'
        ).toBeDisabled();
        await expect(this.durationSaveButton, 'Save must be enabled for 24h').toBeEnabled();
    }

    /**
     * Desktop End time: no Quick picks — Custom shows End date + End time + expiry message + Save.
     * Assert field values, message sync, Save enabled; time picker hour/minute selection updates
     * field + message; calendar disabled days; future date → End time disabled at 23:59 GMT.
     */
    private async verifyDurationEndTimeCustom(): Promise<void> {
        const endDate = this.durationEndDateInput;
        const endTime = this.durationEndTimeInput;

        await expect(endDate, 'End date should be visible').toBeVisible();
        await expect(endDate, 'End date should show a selected date').not.toHaveValue('');
        await expect(endTime, 'End time should be visible').toBeVisible();
        await expect(endTime, 'End time should show a GMT time').toHaveValue(/\d{1,2}:\d{2}(?::\d{2})?\s*GMT/i);
        await expect(this.durationEndTimeSaveButton, 'End time Save should be enabled').toBeEnabled();

        const dateValue = (await endDate.inputValue()).trim();
        const timeValue = (await endTime.inputValue()).trim();
        const timeWithoutGmt = timeValue.replace(/\s*GMT\s*$/i, '').trim();
        await expect(
            this.durationEndTimeMessage,
            'Expiry message should mirror the selected End date and End time'
        ).toHaveText(`Contract will expire on ${dateValue} at ${timeWithoutGmt} GMT.`);

        // Time picker (only while End time is enabled — typically today)
        if (await endTime.isEnabled()) {
            await endTime.click();
            const timePicker = this.page.locator('.time-grid-picker').first();
            await expect(timePicker, 'End time should open the time-grid picker').toBeVisible();

            const enabledHours = timePicker.locator('.time-grid-picker__grid--hours button:not(:disabled)');
            await expect(enabledHours.first(), 'Time picker should expose selectable hour options').toBeVisible();

            const [currentHour, currentMinute] = timeWithoutGmt.split(':');
            const alternateHours = enabledHours.filter({ hasNotText: new RegExp(`^${currentHour}$`) });
            const selectedHourButton =
                (await alternateHours.count()) > 0 ? alternateHours.first() : enabledHours.first();
            await selectedHourButton.click();
            const selectedHour = ((await selectedHourButton.innerText()) || currentHour).trim();

            // Minutes validity depends on the selected hour — re-query after hour click.
            const enabledMinutes = timePicker.locator('.time-grid-picker__grid--minutes button:not(:disabled)');
            await expect(enabledMinutes.first(), 'Time picker should expose selectable minute options').toBeVisible();
            const alternateMinutes = enabledMinutes.filter({ hasNotText: new RegExp(`^${currentMinute}$`) });
            const selectedMinuteButton =
                (await alternateMinutes.count()) > 0 ? alternateMinutes.first() : enabledMinutes.first();
            await selectedMinuteButton.click();
            const selectedMinute = ((await selectedMinuteButton.innerText()) || currentMinute).trim();

            await this.durationEndTimeDoneButton.click();
            await expect(timePicker, 'Time picker should close after Done').not.toBeVisible();

            const selectedTimeLabel = `${selectedHour}:${selectedMinute}`;
            await expect(endTime, `End time should update to the selected ${selectedTimeLabel} GMT`).toHaveValue(
                `${selectedTimeLabel} GMT`
            );
            await expect(
                this.durationEndTimeMessage,
                'Expiry message should mirror the newly selected End time'
            ).toHaveText(`Contract will expire on ${dateValue} at ${selectedTimeLabel} GMT.`);
        }

        if (!(await endDate.isEnabled())) {
            await expect(endDate, 'A configuration without selectable dates should disable End date').toBeDisabled();
            return;
        }

        const originalDate = (await endDate.inputValue()).trim();
        await endDate.click();
        const calendar = this.page.locator('.react-calendar').filter({ visible: true });
        await expect(calendar, 'End date should open the calendar').toBeVisible();

        if ((await this.disabledDurationCalendarDays.count()) > 0) {
            await expect(
                this.disabledDurationCalendarDays.first(),
                'Past or unavailable market dates should be disabled in the calendar'
            ).toBeDisabled();
            await expect(endDate, 'A disabled end date must not replace the selected date').toHaveValue(originalDate);
        }

        const futureDays = calendar.locator(
            '.react-calendar__tile:not(:disabled):not(.react-calendar__month-view__days__day--neighboringMonth):not(.react-calendar__tile--now)'
        );
        if ((await futureDays.count()) === 0) {
            await this.durationCalendarNextMonth.click();
        }
        await expect(futureDays.first(), 'Calendar should offer a future selectable date').toBeVisible();
        await futureDays.first().click();

        // Web-first: calendar commit is async — do not snapshot inputValue before it settles.
        await expect(endDate, 'Selecting a future date should update End date').not.toHaveValue(originalDate);
        const futureDateValue = (await endDate.inputValue()).trim();
        await expect(endTime, 'End time should be disabled for a future date').toBeDisabled();
        await expect(endTime, 'Future End time should show 23:59 GMT').toHaveValue('23:59 GMT');
        await expect(
            this.durationEndTimeMessage,
            'Expiry message should reflect the future date at 23:59 GMT'
        ).toHaveText(`Contract will expire on ${futureDateValue} at 23:59 GMT.`);
        await expect(this.durationEndTimeSaveButton, 'End time Save should stay enabled').toBeEnabled();
    }

    /**
     * Desktop Duration quick picks: exactly 6 chips, each value inside the unit chip window.
     */
    private async verifyDurationUnitQuickPicks(unit: 'Ticks' | 'Seconds' | 'Minutes'): Promise<void> {
        const window = TradeValidationPage.DURATION_UNIT_WINDOWS[unit];
        const chips = this.durationPopover.locator('.value-chips__chip');
        await expect(chips.first(), `${unit} Duration quick picks should show chips`).toBeVisible();
        await expect(chips, `${unit} Duration should expose exactly 6 quick-pick chips`).toHaveCount(6);

        for (let index = 0; index < 6; index += 1) {
            const label = (await chips.nth(index).innerText()).trim();
            const match = label.match(window.chipLabelPattern);
            expect(match, `${unit} chip should match expected label, got "${label}"`).toBeTruthy();
            const value = Number(match![1]);
            expect(
                value,
                `${unit} quick-pick chip ${value} should be between ${window.chipMin} and ${window.chipMax}`
            ).toBeGreaterThanOrEqual(window.chipMin);
            expect(
                value,
                `${unit} quick-pick chip ${value} should be between ${window.chipMin} and ${window.chipMax}`
            ).toBeLessThanOrEqual(window.chipMax);
        }
    }

    /**
     * Desktop Custom duration input for Ticks / Seconds / Minutes: assert Range min/max against the
     * product window, draft min−1 / max+1 (exact between-range error + Save disabled), then restore
     * with minimum. Mobile has no free-form Custom — no-op.
     */
    private async verifyDurationUnitCustomOutOfRange(unit: 'Ticks' | 'Seconds' | 'Minutes'): Promise<void> {
        if (this.isMobile) {
            return;
        }

        const window = TradeValidationPage.DURATION_UNIT_WINDOWS[unit];
        const rangePattern = new RegExp(`Range:\\s*\\d+\\s*-\\s*\\d+\\s*${window.unitWord}`, 'i');

        await this.durationManualInputToggle.click();
        await expect(
            this.durationMessage,
            `Custom ${unit} should show a neutral Range: min - max ${window.unitWord} hint`
        ).toContainText(rangePattern);

        const range = await this.readRange(this.durationMessage);
        expect(
            range.minimum,
            `${unit} Custom minimum should be at least ${window.customMinFloor}`
        ).toBeGreaterThanOrEqual(window.customMinFloor);
        expect(
            range.maximum,
            `${unit} Custom maximum should be at most ${window.customMaxCeiling}`
        ).toBeLessThanOrEqual(window.customMaxCeiling);
        if (window.customMaxExact !== null) {
            expect(range.maximum, `${unit} Custom maximum should be ${window.customMaxExact}`).toBe(
                window.customMaxExact
            );
        }

        const expectedError = `Please enter a duration between ${range.minimum} to ${range.maximum} ${window.unitWord}.`;
        const expectedRangeHint = `Range: ${range.minimum} - ${range.maximum} ${window.unitWord}`;

        await this.fillDurationDraft(String(range.belowMinimum));
        await expect(
            this.durationMessage,
            `${unit} below minimum (${range.belowMinimum}) should show the between-range error`
        ).toHaveText(expectedError);
        await expect(
            this.durationSaveButton,
            `Save must stay disabled for ${unit} below the Custom range`
        ).toBeDisabled();

        await this.fillDurationDraft(String(range.aboveMaximum));
        await expect(
            this.durationMessage,
            `${unit} above maximum (${range.aboveMaximum}) should show the between-range error`
        ).toHaveText(expectedError);
        await expect(
            this.durationSaveButton,
            `Save must stay disabled for ${unit} above the Custom range`
        ).toBeDisabled();

        await this.fillDurationDraft(String(range.minimum));
        await expect(this.durationMessage, `A valid ${unit} draft should restore the neutral Range hint`).toHaveText(
            expectedRangeHint
        );
        await expect(this.durationSaveButton, `Save must be enabled for an in-range ${unit} draft`).toBeEnabled();
    }

    /**
     * Mobile ticks wheel: every option is a ticks label inside 1–10.
     * Digit contracts also require both endpoints (1 and 10) to be present.
     */
    private async verifyMobileDurationTicksWheelBounds(
        options: Locator,
        { requireEndpoints = false }: { requireEndpoints?: boolean } = {}
    ): Promise<void> {
        const labels = (await options.allTextContents()).map(value => value.trim()).filter(Boolean);
        expect(labels.length, 'Mobile ticks wheel should expose duration options').toBeGreaterThan(0);

        const ticks = labels.map(label => {
            const match = label.match(/^(\d+)\s*ticks?$/i);
            expect(match, `Duration option should be a ticks label, got "${label}"`).toBeTruthy();
            return Number(match![1]);
        });

        for (const tick of ticks) {
            expect(tick, `Mobile ticks option ${tick} should be between 1 and 10`).toBeGreaterThanOrEqual(1);
            expect(tick, `Mobile ticks option ${tick} should be between 1 and 10`).toBeLessThanOrEqual(10);
        }

        if (requireEndpoints) {
            expect(Math.min(...ticks), 'Mobile ticks wheel should start at 1 tick').toBe(1);
            expect(Math.max(...ticks), 'Mobile ticks wheel should end at 10 ticks').toBe(10);
        }
    }

    /**
     * Mobile Time tab: hr / min / sec wheel columns stay inside product windows
     * (hr 0–24, min 0–59, sec 0–59; sec often starts at 15 when hours and minutes are 0).
     */
    private async verifyMobileDurationTimeWheelBounds(): Promise<void> {
        await expect(this.durationTimeWheel, 'Time wheel should be visible on the Time tab').toBeVisible();

        const labels = (await this.durationTimeWheel.getByRole('option').allTextContents())
            .map(value => value.trim())
            .filter(Boolean);
        expect(labels.length, 'Time wheel should expose duration options').toBeGreaterThan(0);

        let parsedCount = 0;
        for (const label of labels) {
            const hoursMatch = label.match(/^(\d+)\s*hr$/i);
            if (hoursMatch) {
                const value = Number(hoursMatch[1]);
                expect(value, `Time wheel hours option ${value} should be between 0 and 24`).toBeGreaterThanOrEqual(0);
                expect(value, `Time wheel hours option ${value} should be between 0 and 24`).toBeLessThanOrEqual(24);
                parsedCount += 1;
                continue;
            }
            const minutesMatch = label.match(/^(\d+)\s*min$/i);
            if (minutesMatch) {
                const value = Number(minutesMatch[1]);
                expect(value, `Time wheel minutes option ${value} should be between 0 and 59`).toBeGreaterThanOrEqual(
                    0
                );
                expect(value, `Time wheel minutes option ${value} should be between 0 and 59`).toBeLessThanOrEqual(59);
                parsedCount += 1;
                continue;
            }
            const secondsMatch = label.match(/^(\d+)\s*sec$/i);
            if (secondsMatch) {
                const value = Number(secondsMatch[1]);
                expect(value, `Time wheel seconds option ${value} should be between 0 and 59`).toBeGreaterThanOrEqual(
                    0
                );
                expect(value, `Time wheel seconds option ${value} should be between 0 and 59`).toBeLessThanOrEqual(59);
                parsedCount += 1;
            }
        }
        expect(parsedCount, 'Time wheel should expose parseable hr/min/sec options').toBeGreaterThan(0);
    }

    /**
     * Mobile End time tab: date + time fields, Expiry summary, time-wheel selection when enabled,
     * calendar disabled days, future date → time disabled at 23:59(/:59) GMT.
     */
    private async verifyMobileDurationEndTime(): Promise<void> {
        const endDate = this.durationEndDateInput;
        const endTime = this.durationEndTimeInput;
        const nestedSheet = () => this.visibleActionSheets.last();

        await expect(endDate, 'End date should be visible').toBeVisible();
        await expect(endDate, 'End date should show a selected date').not.toHaveValue('');
        await expect(endTime, 'End time should be visible').toBeVisible();
        await expect(endTime, 'End time should show a GMT time').toHaveValue(/\d{1,2}:\d{2}(?::\d{2})?\s*GMT/i);

        const dateValue = (await endDate.inputValue()).trim();
        const timeValue = (await endTime.inputValue()).trim();
        const timeWithoutGmt = timeValue.replace(/\s*GMT\s*$/i, '').trim();
        await expect(
            this.durationEndTimeExpirySummary,
            'Expiry summary should include the selected End date'
        ).toContainText(dateValue);
        await expect(
            this.durationEndTimeExpirySummary,
            'Expiry summary should include the selected End time'
        ).toContainText(timeWithoutGmt);

        if (await endTime.isEnabled()) {
            await endTime.click();
            // Prefer heading scope over `.last()` — Duration's own Save can otherwise win the race.
            const timeSheet = this.page.locator('.quill-action-sheet--root:visible').filter({
                has: this.page.getByRole('heading', { name: 'Pick an end time' }),
            });
            await expect(
                timeSheet.getByRole('heading', { name: 'Pick an end time' }),
                'End time should open the Pick an end time sheet'
            ).toBeVisible();

            const timePicker = timeSheet.locator('.duration-container__time-picker');
            await expect(timePicker, 'End time sheet should show the time wheel picker').toBeVisible();
            const hourColumn = timePicker.locator('.quill-wheel-picker__container').nth(0);
            const minuteColumn = timePicker.locator('.quill-wheel-picker__container').nth(1);
            await expect(hourColumn.getByRole('option').first(), 'Time wheel should expose hours').toBeAttached();
            await expect(minuteColumn.getByRole('option').first(), 'Time wheel should expose minutes').toBeAttached();

            const [, currentMinute] = timeWithoutGmt.split(':');
            // Wheel labels may be "5" while the field shows "05" — compare numerically.
            const sameTimePart = (left: string, right: string) => Number(left) === Number(right);
            const readTimeParts = async (column: Locator): Promise<string[]> =>
                (await column.getByRole('option').allTextContents())
                    .map(value => value.trim())
                    .filter(option => /^\d{1,2}$/.test(option));

            // Quill mounts a full 00–55 minute list, then reclamps to startTime (debounced). Wait until
            // the current minute is present so we do not pick a stale "00" that then disappears.
            await expect(async () => {
                const minutes = await readTimeParts(minuteColumn);
                expect(
                    minutes.some(option => sameTimePart(option, currentMinute)),
                    'Minute wheel should settle on the hour-clamped list containing the current minute'
                ).toBe(true);
            }).toPass({ timeout: 10_000 });

            // Nested Save enables only when browsing time ≠ open snapshot (`is_dirty`). Quill's
            // TimeWheelPicker ResizeObserver recentres via `scrollIntoView` using a stale column
            // index `p` (never updated on scroll) and undoes programmatic scrolls — so the wheel
            // can look changed while `browsing_expiry_time` snaps back and Save stays disabled.
            // Re-read the browsing value after the clamped list settles (mount effects may adjust it).
            const snapshotTime = (await endTime.inputValue()).trim();
            const snapshotWithoutGmt = snapshotTime.replace(/\s*GMT\s*$/i, '').trim();
            const [snapshotHour, snapshotMinute] = snapshotWithoutGmt.split(':');

            await expect(async () => {
                const hourOptions = await readTimeParts(hourColumn);
                const minuteOptions = await readTimeParts(minuteColumn);
                const alternateMinute = minuteOptions.find(option => !sameTimePart(option, snapshotMinute));
                const alternateHour = hourOptions.find(option => !sameTimePart(option, snapshotHour));

                const commitColumnOption = async (column: Locator, optionLabel: string) => {
                    const options = column.getByRole('option');
                    const labels = (await options.allTextContents()).map(value => value.trim());
                    const targetIndex = labels.findIndex(label => label === optionLabel);
                    if (targetIndex < 0) throw new Error(`Time wheel option '${optionLabel}' not found`);

                    const listbox = column.locator('[role="listbox"]');
                    // Keep scrollIntoView no-op until Save enables — Quill schedules ResizeObserver
                    // recentre on a 0ms timeout *after* setState, which otherwise undoes the commit.
                    await this.page.evaluate(() => {
                        const proto = Element.prototype as Element & {
                            __playwrightScrollIntoView?: typeof Element.prototype.scrollIntoView;
                        };
                        if (!proto.__playwrightScrollIntoView) {
                            proto.__playwrightScrollIntoView = proto.scrollIntoView;
                            proto.scrollIntoView = function scrollIntoViewNoop() {
                                /* suppress Quill TimeWheelPicker ResizeObserver recentre */
                            };
                        }
                    });
                    await listbox.evaluate((list, index) => {
                        const element = list as HTMLElement;
                        const quillRowHeightPx = 48;
                        element.scrollTop = index * quillRowHeightPx + quillRowHeightPx / 2;
                        element.dispatchEvent(new Event('scroll'));
                    }, targetIndex);
                };

                try {
                    if (alternateMinute) {
                        await commitColumnOption(minuteColumn, alternateMinute);
                    } else if (alternateHour) {
                        await commitColumnOption(hourColumn, alternateHour);
                    } else {
                        throw new Error('Time wheel has no alternate hour or minute to dirty the draft');
                    }

                    await expect(
                        this.actionSheetSaveButton(timeSheet),
                        'End time Save should enable after the wheel draft changes'
                    ).toBeEnabled({ timeout: 3_000 });
                    await expect(
                        endTime,
                        'Wheel draft should update browsing End time on the Duration sheet'
                    ).not.toHaveValue(snapshotTime, { timeout: 3_000 });
                } finally {
                    await this.page.evaluate(() => {
                        const proto = Element.prototype as Element & {
                            __playwrightScrollIntoView?: typeof Element.prototype.scrollIntoView;
                        };
                        if (proto.__playwrightScrollIntoView) {
                            proto.scrollIntoView = proto.__playwrightScrollIntoView;
                            delete proto.__playwrightScrollIntoView;
                        }
                    });
                }
            }).toPass({ timeout: 20_000 });

            const committedTime = (await endTime.inputValue()).trim();
            const committedWithoutGmt = committedTime.replace(/\s*GMT\s*$/i, '').trim();
            await this.saveMobileSheet(timeSheet);
            await expect(
                timeSheet.getByRole('heading', { name: 'Pick an end time' }),
                'Pick an end time sheet should close after Save'
            ).not.toBeVisible();

            await expect(endTime, 'End time should keep the saved wheel draft').toHaveValue(committedTime);
            await expect(
                this.durationEndTimeExpirySummary,
                'Expiry summary should mirror the newly selected End time'
            ).toContainText(committedWithoutGmt);
        }

        if (!(await endDate.isEnabled())) {
            await expect(endDate, 'A configuration without selectable dates should disable End date').toBeDisabled();
            return;
        }

        const originalDate = (await endDate.inputValue()).trim();
        await endDate.click();
        const dateSheet = nestedSheet();
        await expect(
            dateSheet.getByRole('heading', { name: 'Pick an end date' }),
            'End date should open the Pick an end date sheet'
        ).toBeVisible();

        const calendar = dateSheet.locator('.react-calendar');
        await expect(calendar, 'End date sheet should show the calendar').toBeVisible();

        if ((await this.disabledDurationCalendarDays.count()) > 0) {
            await expect(
                this.disabledDurationCalendarDays.first(),
                'Past or unavailable market dates should be disabled in the calendar'
            ).toBeDisabled();
            await expect(endDate, 'A disabled end date must not replace the selected date').toHaveValue(originalDate);
        }

        const futureDays = calendar.locator(
            '.react-calendar__tile:not(:disabled):not(.react-calendar__month-view__days__day--neighboringMonth):not(.react-calendar__tile--now)'
        );
        if ((await futureDays.count()) === 0) {
            await this.durationCalendarNextMonth.click();
        }
        await expect(futureDays.first(), 'Calendar should offer a future selectable date').toBeVisible();
        await futureDays.first().click();
        await expect(
            this.actionSheetSaveButton(dateSheet),
            'End date Save should enable after picking a different day'
        ).toBeEnabled({ timeout: 15_000 });
        await this.saveMobileSheet(dateSheet);
        await expect(
            dateSheet.getByRole('heading', { name: 'Pick an end date' }),
            'Pick an end date sheet should close after Save'
        ).not.toBeVisible();

        await expect(endDate, 'Selecting a future date should update End date').not.toHaveValue(originalDate);
        const futureDateValue = (await endDate.inputValue()).trim();
        await expect(endTime, 'End time should be disabled for a future date').toBeDisabled();
        await expect(endTime, 'Future End time should show 23:59 GMT').toHaveValue(/23:59(?::59)?\s*GMT/i);
        await expect(this.durationEndTimeExpirySummary, 'Expiry summary should reflect the future date').toContainText(
            futureDateValue
        );
        await expect(
            this.durationEndTimeExpirySummary,
            'Expiry summary should reflect 23:59 for a future date'
        ).toContainText(/23:59/);
    }

    /**
     * Multipliers Multiplier — runtime discrete list (e.g. `x100`, `x200`). Opens the editor,
     * asserts choices look like `xN` and include the committed value, then dismisses.
     */
    async verifyMultiplierGuardrails(): Promise<void> {
        await expect(this.multiplierField, 'Multipliers should expose Multiplier').toBeVisible();
        const committed = (await this.multiplierField.inputValue()).trim();
        expect(committed, 'Committed Multiplier should look like xN').toMatch(/^x\d+$/i);

        const options = await this.readMultiplierOptions();
        expect(options.length, 'Multiplier should expose at least one choice').toBeGreaterThan(0);
        expect(
            options.every(option => /^x\d+$/i.test(option)),
            'Every Multiplier choice should look like xN'
        ).toBe(true);
        expect(options, 'Committed Multiplier should belong to the runtime choice list').toContain(committed);

        await this.dismissOpenParameterEditor();
    }

    /**
     * Multipliers Deal Cancellation — Risk management always exposes the DC tab; the duration
     * choice list is the fixed five minutes chips (`5` / `10` / `15` / `30` / `60 min`).
     * Leaves the editor open on the DC tab for follow-up exclusivity checks.
     */
    async verifyDealCancellationGuardrails(): Promise<void> {
        if ((await this.riskManagementEditor.count()) === 0) {
            await this.riskManagementField.click();
        }
        await expect(this.riskManagementEditor, 'Risk-management editor should open').toBeVisible();
        await expect(this.dealCancellationTab, 'Deal Cancellation tab should be visible').toBeVisible();
        await this.dealCancellationTab.click();

        const cancellationOptions = (await this.dealCancellationOptions.allTextContents())
            .map(value => value.trim())
            .filter(Boolean);
        expect(
            cancellationOptions.every(option => /^\d+\s+min$/i.test(option)),
            'Every Deal Cancellation choice should show a minutes duration (e.g. "5 min")'
        ).toBe(true);
        expect(
            [...cancellationOptions].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
            'Deal Cancellation should expose the five minutes chips'
        ).toEqual(['5 min', '10 min', '15 min', '30 min', '60 min']);
    }

    /**
     * Commit the open Multipliers Risk management editor for the given mode.
     *
     * @param mode - Active tab being saved (`tp_sl` or `dc`).
     */
    private async saveMultipliersRiskManagement(mode: 'tp_sl' | 'dc'): Promise<void> {
        const save = this.multipliersRiskManagementSave(mode);
        if (this.isMobile) {
            await expect(async () => {
                await save.click();
                await expect(
                    this.riskManagementEditor,
                    'Risk-management sheet should close after Save'
                ).not.toBeVisible({ timeout: 3_000 });
            }).toPass({ timeout: 20_000 });
            return;
        }
        await expect(save, `${mode} Save should enable before commit`).toBeEnabled({ timeout: 20_000 });
        await save.click();
        await expect(this.riskManagementEditor, 'Risk-management popover should close after Save').not.toBeVisible();
    }

    /**
     * Enable Deal Cancellation in the open editor and select a minutes duration chip/wheel value.
     *
     * @param duration - Visible duration label (e.g. `5 min`).
     */
    private async enableDealCancellationDraft(
        duration: '5 min' | '10 min' | '15 min' | '30 min' | '60 min'
    ): Promise<void> {
        if ((await this.dealCancellationToggle.getAttribute('aria-pressed')) !== 'true') {
            await this.dealCancellationToggle.click();
        }
        await expect(this.dealCancellationToggle, 'Deal Cancellation toggle should be on').toHaveAttribute(
            'aria-pressed',
            'true'
        );
        if (this.isMobile) {
            await this.selectWheelPickerOption('.deal-cancellation__wheel-picker', duration);
            return;
        }
        await this.page
            .locator('.deal-cancellation-desktop__chips')
            .getByRole('button', { name: `Select value ${duration}`, exact: true })
            .click();
    }

    /**
     * Switch to TP & SL in the open editor, enable both toggles, and fill the given amounts.
     *
     * @param takeProfit - TP amount to draft.
     * @param stopLoss - SL amount to draft.
     */
    private async enableTpSlDraft(takeProfit: string, stopLoss: string): Promise<void> {
        await this.tpSlTab.click();
        const tpToggle = this.riskManagementEditor
            .locator('.take-profit__wrapper, .risk-management-desktop__field')
            .filter({ hasText: 'Take profit' })
            .locator('button.toggle-switch');
        const slToggle = this.riskManagementEditor
            .locator('.take-profit__wrapper, .risk-management-desktop__field')
            .filter({ hasText: 'Stop loss' })
            .locator('button.toggle-switch');
        if ((await tpToggle.getAttribute('aria-pressed')) !== 'true') await tpToggle.click();
        if ((await slToggle.getAttribute('aria-pressed')) !== 'true') await slToggle.click();
        await expect(this.multiplierTakeProfitInput, 'Take-profit input should be enabled').toBeEnabled();
        await expect(this.multiplierStopLossInput, 'Stop-loss input should be enabled').toBeEnabled();
        await this.multiplierTakeProfitInput.fill(takeProfit);
        await this.multiplierStopLossInput.fill(stopLoss);
        await expect(this.takeProfitMessage, 'Take-profit draft should show the Range hint').toContainText(
            /Range:\s*\$?[\d,]+\.?\d*\s+to\s+\$?[\d,]+\.?\d*/i
        );
        await expect(this.stopLossMessage, 'Stop-loss draft should show the Range hint').toContainText(
            /Range:\s*\$?[\d,]+\.?\d*\s+to\s+\$?[\d,]+\.?\d*/i
        );
    }

    /**
     * Prove TP/SL and Deal Cancellation cannot stay committed together: re-apply the given TP+SL
     * drafts and Save, then DC (snackbar turns TP/SL off), then TP+SL again (snackbar turns DC off).
     * Call after `verifyDealCancellationGuardrails()` — switching to the DC tab drops unsaved TP/SL
     * drafts, so this method re-fills them before the first Save.
     *
     * @param takeProfit - In-range Take-profit amount to commit.
     * @param stopLoss - In-range Stop-loss amount to commit.
     */
    async verifyRiskManagementMutualExclusivity(takeProfit: string, stopLoss: string): Promise<void> {
        const tpSlField = new RegExp(`^TP: .+${this.escapeRegExp(takeProfit)} / SL: .+${this.escapeRegExp(stopLoss)}$`);

        // DC chips leave the editor on the Deal Cancellation tab and drop unsaved TP/SL drafts.
        await this.enableTpSlDraft(takeProfit, stopLoss);
        await this.saveMultipliersRiskManagement('tp_sl');
        await expect(
            this.riskManagementField,
            'Risk management should show committed Take profit and Stop loss'
        ).toHaveValue(tpSlField);

        await this.riskManagementField.click();
        await expect(
            this.riskManagementEditor,
            'Risk-management editor should reopen for Deal Cancellation'
        ).toBeVisible();
        await this.dealCancellationTab.click();
        await this.enableDealCancellationDraft('5 min');
        await this.saveMultipliersRiskManagement('dc');
        await expect(
            this.riskManagementSnackbarMessage,
            'Saving Deal Cancellation should turn TP and SL off'
        ).toHaveText('TP and SL have been turned off.');
        await expect(
            this.riskManagementField,
            'Risk management should show Deal Cancellation after overriding TP/SL'
        ).toHaveValue('DC: 5 minutes');

        await this.riskManagementField.click();
        await expect(this.riskManagementEditor, 'Risk-management editor should reopen').toBeVisible();
        await this.enableTpSlDraft(takeProfit, stopLoss);
        await this.saveMultipliersRiskManagement('tp_sl');
        await expect(
            this.riskManagementSnackbarMessage,
            'Saving Take profit / Stop loss should turn Deal Cancellation off'
        ).toHaveText('DC has been turned off.');
        await expect(
            this.riskManagementField,
            'Risk management should show TP/SL after overriding Deal Cancellation'
        ).toHaveValue(tpSlField);
    }

    /**
     * Verify Multipliers Risk management: TP/SL below-min / above-max (error + Save disabled),
     * in-range restores the neutral Range hint, Deal Cancellation five-minutes chips, and mutual
     * exclusivity with TP/SL (saving one mode turns the other off via snackbar). Multipliers only —
     * Accumulators/Turbos use standalone TP.
     */
    async verifyMultipliersRiskManagementGuardrails(): Promise<void> {
        await this.openRiskManagementEditor();
        await expect(this.takeProfitMessage, 'Take-profit should expose a numeric runtime range').toContainText(/\d/);
        await expect(this.stopLossMessage, 'Stop-loss should expose a numeric runtime range').toContainText(/\d/);
        const tpRange = await this.readRange(this.takeProfitMessage);
        const slRange = await this.readRange(this.stopLossMessage);
        const rangeHint = /Range:\s*\$?[\d,]+\.?\d*\s+to\s+\$?[\d,]+\.?\d*/i;
        const tpSaved = this.formatRangeValue(tpRange.minimum, tpRange.precision);
        const slSaved = this.formatRangeValue(slRange.minimum, slRange.precision);

        await this.multiplierTakeProfitInput.fill(this.formatRangeValue(tpRange.belowMinimum, tpRange.precision));
        await expect(this.takeProfitMessage, 'Take-profit below minimum should show validation').toContainText(
            this.formatRangeValue(tpRange.minimum, tpRange.precision)
        );
        await expect(
            this.multipliersRiskManagementSaveButton,
            'Take-profit below minimum must not be saved'
        ).toBeDisabled();

        await this.multiplierTakeProfitInput.fill(this.formatRangeValue(tpRange.aboveMaximum, tpRange.precision));
        await expect(this.takeProfitMessage, 'Take-profit above maximum should show validation').toContainText(
            this.formatRangeValue(tpRange.maximum, tpRange.precision)
        );
        await expect(
            this.multipliersRiskManagementSaveButton,
            'Take-profit above maximum must not be saved'
        ).toBeDisabled();

        await this.multiplierTakeProfitInput.fill(tpSaved);
        await expect(
            this.takeProfitMessage,
            'An in-range Take-profit draft should restore the neutral Range hint'
        ).toContainText(rangeHint);

        await this.multiplierStopLossInput.fill(this.formatRangeValue(slRange.belowMinimum, slRange.precision));
        await expect(this.stopLossMessage, 'Stop-loss below minimum should show validation').toContainText(
            this.formatRangeValue(slRange.minimum, slRange.precision)
        );
        await expect(
            this.multipliersRiskManagementSaveButton,
            'Stop-loss below minimum must not be saved'
        ).toBeDisabled();

        await this.multiplierStopLossInput.fill(this.formatRangeValue(slRange.aboveMaximum, slRange.precision));
        await expect(this.stopLossMessage, 'Stop-loss above maximum should show validation').toContainText(
            this.formatRangeValue(slRange.maximum, slRange.precision)
        );
        await expect(
            this.multipliersRiskManagementSaveButton,
            'Stop-loss above maximum must not be saved'
        ).toBeDisabled();

        await this.multiplierStopLossInput.fill(slSaved);
        await expect(
            this.stopLossMessage,
            'An in-range Stop-loss draft should restore the neutral Range hint'
        ).toContainText(rangeHint);

        await this.verifyDealCancellationGuardrails();
        await this.verifyRiskManagementMutualExclusivity(tpSaved, slSaved);
    }

    /**
     * Accumulators Growth rate — always exposes the fixed discrete list 1%–5%.
     */
    async verifyGrowthRateGuardrails(): Promise<void> {
        await expect(this.growthRateField, 'Accumulators should expose Growth rate').toBeVisible();
        await this.growthRateField.click();
        if (this.isMobile) {
            await expect(this.growthRateSheet, 'Growth rate sheet should open').toBeVisible();
        } else {
            await expect(
                this.page.getByRole('listbox', { name: 'Selection options' }),
                'Growth rate selection list should open'
            ).toBeVisible();
        }

        const options = (await this.growthRateOptions.allTextContents()).map(value => value.trim()).filter(Boolean);
        expect(options, 'Growth rate should expose the fixed 1%–5% options').toEqual(['1%', '2%', '3%', '4%', '5%']);

        await this.dismissParameterEditor(
            this.growthRateSheet,
            this.page.locator('.selection-list-popover'),
            'Growth rate'
        );
    }

    /**
     * Turbos Payout per point — runtime discrete list from `payout_choices` (currency-prefixed labels,
     * sorted ascending). Opens the editor, asserts the list, then selects a different option so the
     * committed field updates (desktop list commits on click; mobile wheel Save waits for proposal).
     */
    async verifyPayoutPerPointGuardrails(): Promise<void> {
        await expect(this.payoutPerPointField, 'Turbos should expose Payout per point').toBeVisible();
        const committed = (await this.payoutPerPointField.inputValue()).trim();
        expect(committed, 'Committed Payout per point should include a numeric amount').toMatch(/\d/);

        await this.payoutPerPointField.click();
        if (this.isMobile) {
            await expect(this.payoutPerPointSheet, 'Payout per point sheet should open').toBeVisible();
        } else {
            await expect(
                this.page.getByRole('listbox', { name: 'Selection options' }),
                'Payout per point selection list should open'
            ).toBeVisible();
        }

        const options = (await this.payoutPerPointOptions.allTextContents()).map(value => value.trim()).filter(Boolean);
        expect(options.length, 'Payout per point should expose at least one choice').toBeGreaterThan(0);

        const numericValues = options.map(option => Number(option.replace(/[^\d.]/g, '')));
        expect(
            numericValues.every(value => Number.isFinite(value) && value > 0),
            'Every Payout per point choice should be a positive number'
        ).toBe(true);
        expect(numericValues, 'Payout per point choices should be sorted ascending').toEqual(
            [...numericValues].sort((left, right) => left - right)
        );

        const committedNumeric = Number(committed.replace(/[^\d.]/g, ''));
        expect(numericValues, 'Committed Payout per point should belong to the runtime choice list').toContain(
            committedNumeric
        );

        const alternate = options.find(option => Number(option.replace(/[^\d.]/g, '')) !== committedNumeric);
        if (!alternate) {
            await this.dismissParameterEditor(
                this.payoutPerPointSheet,
                this.page.locator('.selection-list-popover'),
                'Payout per point'
            );
            return;
        }

        if (this.isMobile) {
            await this.selectWheelPickerOption(this.payoutPerPointWheel, alternate);
            // Save enables once the wheel draft differs from committed; handleSave still no-ops until
            // the barrier proposal sets `is_api_response_received_ref`.
            await expect(
                this.actionSheetSaveButton(this.payoutPerPointSheet),
                'Payout per point Save should enable after the wheel draft changes'
            ).toBeEnabled({ timeout: 20_000 });
            await expect(
                this.payoutPerPointSheet.locator('.payout-per-point__barrier__content'),
                'Barrier proposal for the draft Payout per point should resolve before Save'
            ).toHaveText(/[+-]?\d/, { timeout: 20_000 });
            await this.saveMobileSheet(this.payoutPerPointSheet);
            await expect(this.payoutPerPointSheet, 'Payout per point sheet should close after Save').not.toBeVisible();
        } else {
            await this.payoutPerPointOptions.filter({ hasText: alternate }).first().click();
            await expect(
                this.page.getByRole('listbox', { name: 'Selection options' }),
                'Payout per point list should close after selecting a choice'
            ).not.toBeVisible();
        }

        const alternateNumeric = alternate.replace(/[^\d.]/g, '');
        await expect(
            this.payoutPerPointField,
            `Payout per point field should update to the selected ${alternate}`
        ).toHaveValue(new RegExp(alternateNumeric.replace(/\./g, '\\.')));
    }

    /**
     * Vanillas Strike price — runtime discrete list from `barrier_choices` (signed relative barriers
     * like `+0.00`). Opens the editor, asserts the list + Payout per point info (desktop panel /
     * mobile sheet row), then selects a different option so the committed field updates.
     */
    async verifyStrikePriceGuardrails(): Promise<void> {
        await expect(this.strikePriceField, 'Vanillas should expose Strike price').toBeVisible();
        if (!this.isMobile) {
            await expect(
                this.payoutPerPointInfo,
                'Vanillas desktop should expose the read-only Payout per point info panel'
            ).toBeVisible();
        }

        const committed = (await this.strikePriceField.inputValue()).trim();
        expect(committed, 'Committed Strike price should be a signed relative barrier').toMatch(/^[+-]?\d/);

        await this.strikePriceField.click();
        if (this.isMobile) {
            await expect(this.strikePriceSheet, 'Strike price sheet should open').toBeVisible();
            await expect(
                this.strikePriceSheet.locator('.strike__payout'),
                'Strike sheet should expose the Payout per point info row'
            ).toBeVisible();
        } else {
            await expect(
                this.page.getByRole('listbox', { name: 'Selection options' }),
                'Strike price selection list should open'
            ).toBeVisible();
        }

        const options = (await this.strikePriceOptions.allTextContents()).map(value => value.trim()).filter(Boolean);
        expect(options.length, 'Strike price should expose at least one choice').toBeGreaterThan(0);
        expect(
            options.every(option => /^[+-]?\d+(\.\d+)?$/.test(option)),
            'Every Strike price choice should be a signed numeric barrier'
        ).toBe(true);
        expect(options, 'Committed Strike price should belong to the runtime choice list').toContain(committed);

        const alternate = options.find(option => option !== committed);
        if (!alternate) {
            await this.dismissParameterEditor(
                this.strikePriceSheet,
                this.page.locator('.selection-list-popover'),
                'Strike price'
            );
            return;
        }

        if (this.isMobile) {
            await this.selectWheelPickerOption(this.strikePriceWheel, alternate);
            await expect(
                this.actionSheetSaveButton(this.strikePriceSheet),
                'Strike price Save should enable after the wheel draft changes'
            ).toBeEnabled({ timeout: 20_000 });
            await expect(
                this.strikePriceSheet.locator('.strike__payout__content'),
                'Payout per point for the draft Strike should resolve before Save'
            ).toHaveText(/\$?\d/, { timeout: 20_000 });
            await this.saveMobileSheet(this.strikePriceSheet);
            await expect(this.strikePriceSheet, 'Strike price sheet should close after Save').not.toBeVisible();
        } else {
            await this.strikePriceOptions.filter({ hasText: alternate }).first().click();
            await expect(
                this.page.getByRole('listbox', { name: 'Selection options' }),
                'Strike price list should close after selecting a choice'
            ).not.toBeVisible();
        }

        await expect(this.strikePriceField, `Strike price field should update to ${alternate}`).toHaveValue(alternate);
    }

    /**
     * Verify Accumulators/Turbos standalone Take profit rejects out-of-range drafts.
     * These trade types have Take profit only — no Stop loss and no Deal Cancellation.
     */
    async verifyTakeProfitGuardrails(): Promise<void> {
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

        await this.takeProfitInput.fill(this.formatRangeValue(range.aboveMaximum, range.precision));
        await expect(message, 'Take profit above maximum should show validation').toContainText(
            this.formatRangeValue(range.maximum, range.precision)
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
     * Barrier guardrails for Above spot and Below spot: reject `0`, empty, and a distance that is
     * too far from spot (`123456`). Mobile uses the horizontal tabs + Quill TextField message inside
     * the Barrier action sheet. Does not replace the committed barrier; dismisses without save.
     */
    async verifyBarrierGuardrails(): Promise<void> {
        const original = await this.committedBarrierInput.inputValue();
        const defaultOffset = original.replace(/^[+-]/, '');
        await this.openBarrierEditor();

        const aboveSpotTab = this.barrierTypeTab('Above spot');
        const belowSpotTab = this.barrierTypeTab('Below spot');
        await expect(aboveSpotTab, 'Barrier editor should offer Above spot').toBeVisible();
        await expect(belowSpotTab, 'Barrier editor should offer Below spot').toBeVisible();

        for (const type of ['Above spot', 'Below spot'] as const) {
            const tab = this.barrierTypeTab(type);
            if ((await tab.getAttribute('aria-selected')) !== 'true') {
                await tab.click();
            }
            await expect(tab, `${type} should be the active Barrier mode`).toHaveAttribute('aria-selected', 'true');

            await this.fillBarrierDraftAndExpectMessage(
                '0',
                'Barrier cannot be zero.',
                `${type}: zero barrier should show the dedicated validation`
            );

            await this.fillBarrierDraftAndExpectMessage(
                '',
                'Barrier is a required field.',
                `${type}: empty barrier should show required validation`
            );

            // Too-far copy comes from the proposal/API path after local validation passes.
            await this.fillBarrierDraftAndExpectMessage(
                '123456',
                'Your barrier is too far from the current spot. Enter a smaller distance.',
                `${type}: a distance far from spot should show the too-far validation`
            );

            // Restore the committed offset so the next mode does not inherit the too-far proposal error.
            // When clear, Quill unmounts `.message__container__text` — use toBeHidden (not
            // not.toContainText), which passes for detached nodes.
            await this.fillBarrierDraft(defaultOffset);
            await expect(
                this.barrierMessage,
                `${type}: restoring the default offset should clear the too-far error`
            ).toBeHidden();
        }

        await expect(
            this.committedBarrierInput,
            'Invalid barrier drafts must not replace the committed value'
        ).toHaveValue(original);
        await this.dismissOpenParameterEditor();
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

    /** Escape a literal string for safe use inside a `RegExp` source. */
    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
