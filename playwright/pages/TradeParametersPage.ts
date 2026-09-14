import { Locator, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';
import { FeedPage } from './FeedPage';
import { TradeBasePage } from './TradeBasePage';
import { MarketSelectionPage } from './MarketSelectionPage';

/**
 * Page Object for trade parameters shared across all contract types on the trade page (/).
 *
 * Covers: contract type selector, stake input, duration input, purchase button, and the mobile
 * parameters container (bottom sheet + drag handle). Composes {@link MarketSelectionPage} (not
 * inherited — same pattern as `TradeRiseFallPage`'s `positionsPage`/`reportsPage` composition) for
 * the market-selection picker and tab-strip — `selectMarketAndTradeType()` below is the one method
 * that stays here despite reaching into the composed page, because it also asserts trade-parameter
 * locators owned by this class.
 * All locators are viewport-aware — desktop (≥ 1024px) and mobile (< 1024px) use
 * different testids or selectors as rendered by AppV2.
 *
 * @example
 * ```typescript
 * test('VERIFY trade parameters load', async ({ tradeParametersPage }) => {
 *     await tradeParametersPage.gotoTradePage();
 *     await tradeParametersPage.verifyDTraderLandingPage(testInfo.project.name.includes('mobile'));
 * });
 * ```
 */
export class TradeParametersPage extends TradeBasePage {
    readonly marketSelectionPage: MarketSelectionPage;

    constructor(page: import('@playwright/test').Page) {
        super(page);
        this.marketSelectionPage = new MarketSelectionPage(page);
    }

    // ============================================
    // LOCATORS
    // ============================================

    /**
     * Rise button in the Rise/Fall segmented control.
     * Default selected contract type on page load.
     */
    get riseButton(): Locator {
        return this.page.getByRole('button', { name: 'Rise', exact: true });
    }

    /**
     * Fall button in the Rise/Fall segmented control.
     */
    get fallButton(): Locator {
        return this.page.getByRole('button', { name: 'Fall', exact: true });
    }

    /**
     * Allow equals — viewport-aware.
     * Desktop: <p class="allow-equals__title">Allow equals</p>
     * Mobile: <label for="quill-input-N">Allow equals</label> inside minimized trade params
     */
    get allowEqualsText(): Locator {
        return this.isMobile
            ? this.page.locator('.trade-params__option--minimized label', { hasText: 'Allow equals' })
            : this.page.locator('.allow-equals__title');
    }

    /**
     * Allow equals toggle button (desktop only).
     * Source: allow-equals.tsx — <button class="toggle-switch" aria-pressed="false|true">
     * Scoped inside .allow-equals__wrapper to avoid matching other toggle switches.
     */
    get allowEqualsToggle(): Locator {
        return this.page.locator('.allow-equals__wrapper button.toggle-switch');
    }

    /**
     * Allow equals minimized text field (mobile only).
     * Tapping this toggles `is_equal` inline and shows a confirmation snackbar — there's no action
     * sheet, toggle, or Save step (see allowEqualsSnackbarMessage).
     * Source: allow-equals.tsx is_minimized branch — TextField with label "Allow equals"
     */
    get allowEqualsMobileField(): Locator {
        return this.page.locator('.trade-params__option--minimized', { hasText: 'Allow equals' });
    }

    /**
     * Confirmation snackbar message shown after tapping allowEqualsMobileField (mobile only).
     * Source: allow-equals.tsx toggleAllowEquals — addSnackbar() (@deriv-com/quill-ui). Auto-dismisses
     * after 4s by default (status="neutral") — wait for it to clear rather than clicking its close
     * button, which races the dismiss animation and can flake.
     */
    get allowEqualsSnackbarMessage(): Locator {
        return this.page.locator('.snackbar--container .quill-snackbar__message');
    }

    /**
     * Growth rate label — Accumulators only.
     * Desktop: <label>Growth rate</label> inside .trade-params__option
     * Mobile: <label>Growth rate</label> inside .trade-params__option--minimized
     */
    get growthRateLabel(): Locator {
        return this.page.locator('label', { hasText: 'Growth rate' }).first();
    }

    /**
     * Take profit label — Accumulators and Multipliers.
     * Desktop/Mobile: <label>Take profit</label> inside .trade-params__option
     */
    get takeProfitLabel(): Locator {
        return this.page.locator('label', { hasText: 'Take profit' }).first();
    }

    /**
     * "Multiplier" label — Multipliers only, stable across both viewports.
     * Desktop: TradeParameterPopover renders a readOnly TextField labelled "Multiplier".
     * Mobile: ActionSheet TextField labelled "Multiplier".
     * Source: multiplier-desktop.tsx / multiplier.tsx — i18n_default_text='Multiplier'
     */
    get multiplierLabel(): Locator {
        return this.page.locator('label', { hasText: 'Multiplier' }).first();
    }

    /**
     * Risk management label — Multipliers only, stable across both viewports.
     * Desktop: TradeParameterPopover labelled "Risk management".
     * Mobile: ActionSheet TextField labelled "Risk management".
     * Source: risk-management-desktop.tsx / risk-management.tsx — i18n_default_text='Risk management'
     */
    get riskManagementLabel(): Locator {
        return this.page.locator('label', { hasText: 'Risk management' }).first();
    }

    /**
     * Take profit field trigger (readOnly TextField, value "-" or "$20.00" — the amount is
     * symbol-prefixed via `getCurrencySymbol`).
     * Shared by trade types that use the standalone TakeProfit widget (Accumulators, Turbos).
     * Source: take-profit.tsx / take-profit-desktop.tsx — label "Take profit".
     */
    get takeProfitField(): Locator {
        return this.page.getByLabel('Take profit').first();
    }

    /**
     * Overlay covering the disabled take-profit input; clicking it flips the toggle on.
     * Rendered on both viewports only while TP is off, then unmounts. Source: dt_take_profit_overlay.
     */
    get takeProfitOverlay(): Locator {
        return this.page.getByTestId('dt_take_profit_overlay');
    }

    /**
     * Take profit on/off toggle — the authoritative state signal (`aria-pressed`), since the overlay
     * unmounts and the input's `disabled` flag both merely follow it.
     * Both viewports render quill's `ToggleSwitch`, which emits `<button class="toggle-switch">` and
     * drops any `data-testid` passed to it — so `dt_take_profit_toggle` (set in
     * take-profit-input-desktop.tsx) never reaches the DOM. Scope by container class instead:
     * mobile `.take-profit__content` (the sheet), desktop `.take-profit-input-desktop__header`.
     */
    get takeProfitToggle(): Locator {
        return this.isMobile
            ? this.takeProfitSheet.locator('.take-profit__content button.toggle-switch')
            : this.page.locator('.take-profit-input-desktop__header button.toggle-switch');
    }

    /**
     * Take profit amount input — viewport-aware.
     * Desktop: dt_take_profit_input (take-profit-input-desktop.tsx).
     * Mobile: dt_tp_input (take-profit-and-stop-loss-input.tsx).
     */
    get takeProfitInput(): Locator {
        return this.isMobile ? this.page.getByTestId('dt_tp_input') : this.page.getByTestId('dt_take_profit_input');
    }

    /**
     * Mobile take-profit action sheet (while open) — `take-profit.tsx` renders the shared
     * `TakeProfitAndStopLossInput`, so it is identified by that input's testid.
     */
    get takeProfitSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root').filter({ has: this.page.getByTestId('dt_tp_input') });
    }

    /**
     * Save in the take-profit popover/action-sheet — viewport-aware.
     * Mobile: ActionSheet.Header Save (`dt-actionsheet-header-save-action`); there is no footer button,
     * and it stays disabled until the draft is dirty and the proposal has validated it.
     * Desktop: footer `.take-profit-input-desktop__save-button`.
     */
    get takeProfitSaveButton(): Locator {
        return this.isMobile
            ? this.actionSheetSaveButton(this.takeProfitSheet)
            : this.page.locator('.take-profit-input-desktop__save-button');
    }

    /**
     * Accumulators stats panel — Accumulators only.
     * Source: accumulators-stats-v2.tsx
     */
    get accumulatorsStats(): Locator {
        return this.page.locator('.accumulators-stats-v2');
    }

    /**
     * Payout per point param — Turbos only.
     * Desktop: TradeParameterPopover labelled "Payout per point"; Mobile: readOnly TextField opening a
     * wheel-picker action sheet. Matched by label text on both viewports.
     * Source: PayoutPerPoint/payout-per-point(-desktop).tsx
     */
    get payoutPerPointParam(): Locator {
        return this.page.getByText('Payout per point').first();
    }

    /**
     * Barrier info panel — Turbos (read-only display of the barrier below the params row).
     * Source: BarrierInfo/barrier-info.tsx — `.barrier-info__container`.
     */
    get barrierInfoPanel(): Locator {
        return this.page.locator('.barrier-info__container');
    }

    /**
     * "Strike price" label — Vanillas only, stable across both viewports.
     * Desktop: TradeParameterPopover labelled "Strike price".
     * Mobile: ActionSheet TextField labelled "Strike price".
     * Source: strike-desktop.tsx / strike.tsx — i18n_default_text='Strike price'
     */
    get strikePriceLabel(): Locator {
        return this.page.locator('label', { hasText: 'Strike price' }).first();
    }

    /**
     * Strike price field (readOnly TextField showing the current barrier_1 value).
     * Source: strike-desktop.tsx TradeParameterPopover / strike.tsx TextField — label "Strike price".
     */
    get strikePriceField(): Locator {
        return this.page.getByLabel('Strike price').first();
    }

    /**
     * Payout per point info panel — Vanillas only (read-only; not the Turbos selectable param).
     * Source: PayoutPerPointInfo/payout-per-point-info.tsx — `.payout-per-point-info__container`.
     */
    get payoutPerPointInfo(): Locator {
        return this.page.locator('.payout-per-point-info__container');
    }

    /**
     * Network status indicator — confirms WebSocket connection is active.
     * Source: network-status.tsx data-testid='dt_network_status_element'
     */
    get networkStatus(): Locator {
        return this.page.getByTestId('dt_network_status_element');
    }

    /**
     * Fullscreen toggle — desktop only footer element.
     * Source: trade-params-footer.tsx data-testid='dt_fullscreen_toggle'
     */
    get fullscreenToggle(): Locator {
        return this.page.getByTestId('dt_fullscreen_toggle');
    }

    /**
     * Stake amount input — viewport-aware.
     * - Mobile (< 1024px): dt_input_with_steppers (stake-input.tsx)
     * - Desktop (≥ 1024px): dt_stake_input_desktop (stake-input-desktop.tsx)
     */
    get stakeInput(): Locator {
        return this.isMobile
            ? this.page.getByTestId('dt_input_with_steppers')
            : this.page.getByTestId('dt_stake_input_desktop');
    }

    /**
     * Last digit prediction param — Matches/Differs and Over/Under digit trade types.
     * Desktop: <CaptionText class="last-digit-prediction__title">Last digit prediction</CaptionText>
     * Mobile: <label> "Last digit prediction" on the minimized TextField
     * Source: last-digit-prediction.tsx — the label text is present on both viewports.
     */
    get lastDigitPredictionParam(): Locator {
        return this.page.getByText('Last digit prediction').first();
    }

    /**
     * Barrier label — Higher/Lower and Touch/No Touch trade types.
     * Desktop: <label>Barrier</label> inside .trade-params__option
     * Mobile: visible "Barrier" text in the bottom sheet
     * Source: barrier.tsx label={<Localize i18n_default_text='Barrier' />}
     */
    get barrierLabel(): Locator {
        return this.page.locator('label', { hasText: 'Barrier' }).first();
    }

    /**
     * Purchase success notification icon — appears after a successful buy.
     * Source: purchase-button.tsx addBanner callback injects StandaloneStopwatchRegularIcon
     * with className 'trade-notification--purchase'.
     */
    get purchaseNotification(): Locator {
        return this.page.locator('.trade-notification--purchase');
    }

    /**
     * Duration label — stable across both viewports.
     * Desktop: <label>Duration</label> inside .trade-params__option
     * Mobile: visible "Duration" text in the bottom sheet
     */
    get durationLabel(): Locator {
        return this.page.locator('label', { hasText: 'Duration' }).first();
    }

    /**
     * Duration field (clickable trigger) — opens the duration popover/action sheet.
     * Both viewports render a readOnly <input> associated with a <label>Duration</label>
     * via `for="quill-input-N"`. getByLabel resolves to that input on both viewports.
     * - Desktop: readOnly input inside TradeParameterPopover (trade-params__option)
     * - Mobile: readOnly input inside .trade-params__option--minimized
     */
    get durationField(): Locator {
        return this.page.getByLabel('Duration').first();
    }

    /**
     * Duration unit tab button — both desktop (vertical-tab-selector) and mobile (horizontal-tab-selector)
     * render unit tabs as `role="tab"` with the unit label as accessible name. Matched case-insensitively
     * (callers may pass 'End Time' or 'end time') but anchored to the full name, since `exact: false`
     * substring matching would let bare "Time" also match "End time".
     *
     * Desktop keeps separate Seconds/Minutes/Hours tabs, but mobile unifies them into one "Time"
     * tab holding a 3-column hr/min/sec wheel (duration-wheel-picker.tsx `DurationTimeWheel`) — so
     * on mobile, those three unit names all resolve to the "Time" tab instead.
     *
     * @param unit - Duration unit label (e.g. 'Ticks', 'Seconds', 'Minutes', 'Hours', 'End Time')
     */
    durationUnitTab(unit: string): Locator {
        const isTimeUnit = ['seconds', 'minutes', 'hours'].includes(unit.toLowerCase());
        const tabName = this.isMobile && isTimeUnit ? 'Time' : unit;
        const scope = this.isMobile ? this.durationContainer : this.durationPopover;
        return scope.getByRole('tab', { name: new RegExp(`^${tabName}$`, 'i') });
    }

    /**
     * Clicks a duration unit tab when the sidebar is rendered.
     * Tick-only trade types (Even/Odd, Matches/Differs, Over/Under) expose a single unit, so
     * duration-desktop.tsx omits the sidebar and shows Quick picks chips directly.
     */
    private async selectDurationUnitTabIfVisible(unit: string): Promise<void> {
        const unitTab = this.durationUnitTab(unit);
        if ((await unitTab.count()) === 0) {
            return;
        }
        await expect(unitTab, `Duration '${unit}' tab should be visible in the open picker`).toBeVisible();
        if ((await unitTab.getAttribute('aria-selected')) === 'true') {
            return;
        }
        await unitTab.click();
        await expect(unitTab, `Duration '${unit}' tab should be selected`).toHaveAttribute('aria-selected', 'true');
    }

    /**
     * Duration preset chip button — rendered by value-chips.tsx.
     * aria-label pattern: "Select value X ticks" / "Select value X sec" / "Select value X min"
     *
     * @param formattedValue - The formatted chip label as rendered (e.g. '5 ticks', '15 sec', '1 min')
     */
    durationChip(formattedValue: string): Locator {
        return this.page.getByRole('button', { name: `Select value ${formattedValue}`, exact: true });
    }

    /**
     * Backdrop overlay behind a `type="modal"` (the default) Quill ActionSheet — mobile only.
     * Dismisses without committing; trade-param sheets now commit via the header Save action instead.
     * Source: @deriv-com/quill-ui ActionSheet.Portal — data-testid="dt-actionsheet-overlay".
     */
    get actionSheetOverlay(): Locator {
        return this.page.getByTestId('dt-actionsheet-overlay');
    }

    /**
     * Mobile duration action sheet root (duration.tsx / container.tsx).
     * `:visible` excludes closed/transitioning portal copies still in the DOM.
     * Header Save commits the wheel selection; dismiss (X/overlay/drag) discards drafts.
     */
    get durationContainer(): Locator {
        return this.page.locator('.duration-container:visible').filter({
            has: this.page.getByRole('heading', { name: 'Duration' }),
        });
    }

    /** Desktop duration popover — vertical unit tabs and preset chips. */
    get durationPopover(): Locator {
        return this.page.locator('.duration-popover');
    }

    /**
     * Mobile duration Ticks tab wheel picker.
     * Source: duration/container.tsx — `data-testid="dt_duration_ticks_wheel"`.
     * Hidden (`duration-container__wheel--hidden`) until the Ticks tab is selected.
     */
    get durationTicksWheel(): Locator {
        return this.durationContainer.getByTestId('dt_duration_ticks_wheel');
    }

    /**
     * Mobile duration Time tab wheel picker (hr/min/sec columns).
     * Source: duration/container.tsx — `data-testid="dt_duration_time_wheel"`.
     */
    get durationTimeWheel(): Locator {
        return this.durationContainer.getByTestId('dt_duration_time_wheel');
    }

    /**
     * Keyboard icon toggle — switches the duration popover/action sheet to manual input mode.
     * - Desktop: inside `.duration-popover__header`
     * - Mobile: inside `.duration-container__tab-selector`
     */
    get durationManualInputToggle(): Locator {
        return this.isMobile
            ? this.page.locator('.duration-container__tab-selector .segmented-control-single .item:nth-child(2)')
            : this.page.locator('.duration-popover__header .segmented-control-single .item:nth-child(2)');
    }

    /** End date readonly input — opens the react-calendar date picker on click */
    get durationEndDateInput(): Locator {
        return this.page.getByTestId('dt_duration_end_date_input');
    }

    /** End time readonly input — opens a time picker on click */
    get durationEndTimeInput(): Locator {
        return this.page.getByTestId('dt_duration_end_time_input');
    }

    /** react-calendar date tile by full aria-label (e.g. '22 June 2026') */
    durationCalendarDay(ariaLabel: string): Locator {
        return this.page.locator('.react-calendar__month-view__days__day').filter({
            has: this.page.locator(`abbr[aria-label="${ariaLabel}"]`),
        });
    }

    /** react-calendar prev-month navigation arrow */
    get durationCalendarPrevMonth(): Locator {
        return this.page.locator('.react-calendar__navigation__prev-button');
    }

    /** react-calendar next-month navigation arrow */
    get durationCalendarNextMonth(): Locator {
        return this.page.locator('.react-calendar__navigation__next-button');
    }

    /**
     * Hour button in the end-time grid picker.
     * aria-label pattern: "Hour 06", "Hour 23"
     *
     * @param hour - Zero-padded hour string (e.g. '06', '14')
     */
    durationEndTimeHour(hour: string): Locator {
        return this.page.locator(`[aria-label="Hour ${hour}"]`);
    }

    /**
     * Minute button in the end-time grid picker.
     * aria-label pattern: "Minute 00", "Minute 45"
     *
     * @param minute - Zero-padded minute string (e.g. '00', '45')
     */
    durationEndTimeMinute(minute: string): Locator {
        return this.page.locator(`[aria-label="Minute ${minute}"]`);
    }

    /** "Done" button in the end-time grid picker footer — confirms the time selection */
    get durationEndTimeDoneButton(): Locator {
        return this.page.locator('.duration-end-time-desktop__time-picker-footer button');
    }

    /**
     * Stake field (clickable trigger) — opens the stake popover/action sheet.
     * TradeParameterPopover renders a readOnly <input> associated with <label>Stake</label>
     * via Quill's for/id pairing. getByLabel resolves directly to that input on both viewports.
     */
    get stakeField(): Locator {
        return this.page.getByLabel('Stake').first();
    }

    /**
     * Preset chip in the stake popover / mobile sheet.
     * aria-label is symbol-prefixed (`Select value $20`) via `formatValue` in stake-desktop.tsx /
     * stake-input.tsx — not `"Select value 20.00 USD"`. Whole-number amounts (`20.00`) match the
     * integer chip (`$20`); non-preset amounts (e.g. `10.50`) will not find a chip.
     *
     * Desktop: tapping a chip commits and closes the popover (`handleChipSelectAndClose`).
     * Mobile: tapping a chip only drafts; header Save still has to commit.
     *
     * `exact` is required — accessible-name matching is substring-based, so "Select value $10" would
     * also match the "$100" chip.
     */
    stakeChip(amount: string): Locator {
        const numeric = parseFloat(amount);
        const chipAmount = Number.isInteger(numeric) ? String(numeric) : amount;
        return this.page.getByRole('button', { name: `Select value $${chipAmount}`, exact: true });
    }

    /**
     * Barrier field trigger (read-only TextField that opens the popover/action-sheet).
     * Desktop: TradeParameterPopover renders a readOnly TextField labelled "Barrier".
     * Mobile: barrier.tsx renders the same TextField labelled "Barrier".
     * Source: barrier-desktop.tsx + barrier.tsx
     */
    get barrierField(): Locator {
        return this.page
            .locator('.trade-params__option')
            .filter({ has: this.page.locator('label', { hasText: 'Barrier' }) });
    }

    /**
     * Barrier type selector inside the popover/action-sheet.
     * Desktop: role="tab" buttons inside .barrier-popover__sidebar (VerticalTabSelector)
     * Mobile: role="tab" buttons inside the open barrier action sheet (HorizontalTabSelector)
     * Source: barrier-type-selector.tsx (desktop), barrier-input.tsx (mobile)
     */
    barrierTypeTab(type: 'Above spot' | 'Below spot' | 'Fixed barrier'): Locator {
        return this.isMobile
            ? this.barrierSheet.getByRole('tab', { name: type, exact: true })
            : this.page.locator('.barrier-popover__sidebar').getByRole('tab', { name: type });
    }

    /**
     * Barrier value input inside the popover/action-sheet.
     * Both viewports: input[name="barrier_1"]
     * Source: barrier-content-desktop.tsx + barrier-input.tsx
     */
    get barrierInput(): Locator {
        return this.page.locator('input[name="barrier_1"]');
    }

    /**
     * Mobile barrier action sheet (while open).
     */
    get barrierSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has(.barrier-params)');
    }

    /**
     * Save button inside the barrier popover/action-sheet.
     * Desktop: .barrier-content__save-button. Mobile: ActionSheet.Header Save.
     */
    get barrierSaveButton(): Locator {
        return this.isMobile
            ? this.actionSheetSaveButton(this.barrierSheet)
            : this.page.locator('.barrier-content__save-button');
    }

    /**
     * Desktop Stake popover "Custom" tab — second item in Quick picks / Custom.
     * Source: tab-selector.tsx inside `.stake-popover`. Switches from chips to `StakeInputDesktop`.
     * Mobile has chips and the text field on one sheet, so `setStake()` skips this.
     */
    get stakeManualInputToggle(): Locator {
        return this.page.locator('.stake-popover').getByRole('button', { name: 'Custom' });
    }

    /**
     * Desktop Stake popover root (`.stake-popover`). Chip select auto-closes it.
     */
    get stakePopover(): Locator {
        return this.page.locator('.stake-popover');
    }

    /**
     * Stake amount input inside the stake popover/action sheet.
     * - Desktop: dt_stake_input_desktop (stake-input-desktop.tsx) — visible only on the Custom tab.
     * - Mobile: dt_stake_input (stake-input.tsx) — always visible alongside the preset chips.
     */
    get stakePopoverInput(): Locator {
        return this.isMobile
            ? this.page.getByTestId('dt_stake_input')
            : this.page.getByTestId('dt_stake_input_desktop');
    }

    /**
     * Save button inside the stake popover/action sheet — commits a changed draft.
     * - Mobile: header Save (`dt-actionsheet-header-save-action`). Stays disabled while the draft
     *   equals the committed stake; use `stakeCloseButton` to dismiss a no-op reopen.
     * - Desktop: footer Save on the Custom tab only (`.stake-input-desktop__save-button`). Quick
     *   picks has no Save — chips commit and close the popover.
     */
    get stakeSaveButton(): Locator {
        return this.isMobile
            ? this.actionSheetSaveButton(this.stakeContainer)
            : this.stakePopover.locator('.stake-input-desktop__save-button');
    }

    /**
     * Mobile Stake sheet Close (X) — `dt-actionsheet-header-close-action`. Discards an unchanged
     * draft; does not require Save to be enabled.
     */
    get stakeCloseButton(): Locator {
        return this.actionSheetCloseButton(this.stakeContainer);
    }

    /**
     * Mobile Stake action sheet's root container (stake-mobile.tsx `<div className='stake-container'>`).
     * Present while the sheet is open; used both to scope its Save button and to confirm it dismisses
     * after closing.
     */
    get stakeContainer(): Locator {
        return this.page.locator('.stake-container');
    }

    /**
     * Stake label — stable across both viewports.
     * Desktop: <label>Stake</label> inside .trade-params__option
     * Mobile: visible "Stake" text in the bottom sheet
     */
    get stakeLabel(): Locator {
        return this.page.locator('label', { hasText: 'Stake' }).first();
    }

    /**
     * Inline validation / range message in the open Stake custom editor.
     * Shared by Manual Trading and Automate (Flow 15) stake negative checks.
     */
    get stakeValidationMessage(): Locator {
        const root = this.isMobile ? this.stakeContainer : this.stakePopover;
        return root.locator('.message__container__text').first();
    }

    /** Source: stake-input proposal validation — stake below market minimum. */
    static readonly STAKE_MIN_AMOUNT_ERROR = /Please enter a stake amount that(?:'s| is) at least [\d.]+/;

    /** Source: stake-input onSave — empty custom stake draft. */
    static readonly STAKE_REQUIRED_ERROR = 'Amount is a required field.';

    /** Source: stake-input onInputChange — trailing decimal/comma separator. */
    static readonly STAKE_INVALID_NUMBER_ERROR = 'Should be a valid number.';

    /** Source: error-message-mapper PayoutLimits — stake draft exceeds max payout. */
    static readonly STAKE_MAX_PAYOUT_ERROR = /Minimum stake of .+ and maximum payout of .+\. Current payout is .+\./;

    /**
     * Duration input — viewport-aware.
     * - Mobile (< 1024px): no testid; use the visible "Duration" label text
     * - Desktop (≥ 1024px): duration display text in the trade params form
     */
    get durationInput(): Locator {
        return this.isMobile
            ? this.page.getByText('Duration').first()
            : this.page.getByTestId('dt_duration_input_desktop');
    }

    /**
     * Purchase / buy button wrapper — same testid on both viewports.
     * Source: purchase-button-content.tsx data-testid='dt_purchase_button_wrapper'
     *
     * Note: this wrapper holds the button's payout content, which is NOT rendered for contract types
     * with no button content (Accumulators without an open contract, Multipliers, Turbos, Vanillas).
     * For those, use {@link singlePurchaseButton} instead.
     */
    get purchaseButton(): Locator {
        return this.page.getByTestId('dt_purchase_button_wrapper').first();
    }

    /**
     * Single purchase/action button — used by contract types that render one full-width button with no
     * payout content wrapper (e.g. Accumulators, Multipliers). While an accumulator is open this same
     * element becomes the "Close [amount]" button.
     * Source: purchase-button.tsx className 'purchase-button purchase-button--single'.
     */
    get singlePurchaseButton(): Locator {
        return this.page.locator('.purchase-button--single');
    }

    /**
     * Trade parameters container — mobile only (AppV2 bottom sheet). Fixed height with no
     * expand/collapse handle: every param is sized to fit the row.
     * Source: trade-parameters-container.tsx
     */
    get tradeParamsContainer(): Locator {
        return this.page.getByTestId('trade-params-container');
    }

    /**
     * Payout value on the purchase button — present only for trade types that have a payout (e.g. Rise/Fall).
     * The wrapper holds two direct `<span>` children: the basis label then the amount.
     * Source: purchase-button-content.tsx — `formatAmountWithSymbol` renders a plain string (no `dt_span`).
     * Text format: "$19.28"
     */
    get purchaseButtonPayout(): Locator {
        return this.purchaseButton.locator('> span').last();
    }

    /** Shown when `is_market_closed` — purchase is hidden and reopen countdown renders here. */
    get closedMarketMessage(): Locator {
        return this.page.locator('.closed-market-message--container');
    }

    get closedMarketReopenIntro(): Locator {
        return this.closedMarketMessage.getByText('This market will reopen at');
    }

    get closedMarketCountdown(): Locator {
        return this.page.locator('.market-countdown-timer-text');
    }

    /** Desktop grid / mobile minimized row of trade-parameter controls. */
    get tradeParamsOptionsWrapper(): Locator {
        return this.page.locator('.trade-params__options-wrapper').first();
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Enable the Allow Equals toggle. Desktop clicks the toggle button; mobile taps the minimized
     * field, which toggles inline (no action sheet/Save). Idempotent — no-ops if already enabled.
     *
     * Precondition: Allow Equals must be visible (Rise/Fall trade type selected,
     * duration unit compatible with callputequal, e.g. Minutes not Ticks).
     */
    async enableAllowEquals(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.allowEqualsMobileField,
                'Allow equals field should be visible before enabling (mobile)'
            ).toBeVisible();
            // .catch() — unlike toHaveValue(), inputValue() doesn't retry; a transient DOM miss (Quill's
            // minimized field can lazily (re)mount its <input>) would throw here instead of just falling
            // through to the toggle attempt, which the toHaveValue('Yes') assertion below still verifies.
            const currentValue = await this.allowEqualsMobileField
                .locator('input')
                .inputValue()
                .catch(() => '');
            if (currentValue !== 'Yes') {
                await this.allowEqualsMobileField.click();
                await expect(
                    this.allowEqualsSnackbarMessage,
                    'Snackbar should confirm allow equals was enabled'
                ).toHaveText('You will win a payout if the exit spot is equal to the entry spot.');
                await expect(
                    this.allowEqualsSnackbarMessage,
                    'Snackbar should disappear on its own after enabling'
                ).not.toBeVisible({ timeout: 6_000 });
            }
            await expect(
                this.allowEqualsMobileField.locator('input'),
                'Allow equals minimized field should show "Yes" after enabling'
            ).toHaveValue('Yes');
        } else {
            await expect(
                this.allowEqualsToggle,
                'Allow equals toggle should be visible before enabling (desktop)'
            ).toBeVisible();
            await expect(this.allowEqualsToggle, 'Allow equals toggle should be off before enabling').toHaveAttribute(
                'aria-pressed',
                'false'
            );
            await this.allowEqualsToggle.click();
            await expect(this.allowEqualsToggle, 'Allow equals toggle should be on after enabling').toHaveAttribute(
                'aria-pressed',
                'true'
            );
        }
    }

    /**
     * Select a (market, trade type) pair via the market-selection picker's search — reliably
     * reaches any market in one step regardless of which category it's grouped under. Search
     * results are grouped by trade type, so selecting the row under the matching group commits
     * both together.
     *
     * @param market - Visible market name as rendered (e.g. 'Volatility 100 Index')
     * @param tradeType - Visible trade-type label as rendered (e.g. 'Rise/Fall', 'Multipliers')
     * @param options.openInNewTab - Open via "Add market" (new tab) instead of replacing the
     *   active tab. Defaults to `false`.
     * @param options.mode - `'manual'` (default) asserts Buy button and manual-only UI;
     *   `'automate'` skips Buy and asserts the Run control instead.
     * @param options.verifyAllowEquals - Require Allow equals for configurations known to support it.
     * @param options.verifyParams - Run the complete trade-type parameter assertions. Defaults to true.
     *
     * @example
     * ```typescript
     * await tradeParametersPage.selectMarketAndTradeType('Volatility 100 Index', 'Multipliers');
     * await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators', {
     *     mode: 'automate',
     * });
     * ```
     */
    async selectMarketAndTradeType(
        market: string,
        tradeType: string,
        options: {
            openInNewTab?: boolean;
            mode?: 'manual' | 'automate';
            verifyAllowEquals?: boolean;
            verifyParams?: boolean;
        } = {}
    ): Promise<void> {
        const { openInNewTab = false, mode = 'manual', verifyAllowEquals = true, verifyParams = true } = options;

        const activeTabText = await this.activeMarketTab.textContent();
        const isAlreadySelected =
            activeTabText?.includes(market) === true && activeTabText?.includes(tradeType) === true;

        if (isAlreadySelected) {
            // Defensive: a stray picker overlay from a previous action may still be open even though
            // the market/trade-type tab already matches.
            await this.marketSelectionPage.closeMarketSelectionPicker();
        } else {
            if (openInNewTab) {
                await this.marketSelectionPage.addMarketButton.click();
            } else {
                // Clicking the already-active tab opens the picker in replace mode — skip when unchanged.
                await this.activeMarketTab.click();
            }
            await expect(
                this.marketSelectionPage.marketSelectionPanel,
                'Market-selection picker should be visible after opening'
            ).toBeVisible();

            if (this.isMobile) {
                await this.marketSelectionPage.marketSelectionSearchButton.click();
            }
            await this.marketSelectionPage.marketSearchInput.fill(market);
            // Vanillas (and other late-ordered types) sit below the fold in the grouped search list.
            // Wait for that trade-type group to land (per-type symbol fetches resolve independently),
            // then scroll it into the list's overflow container before clicking the row.
            const searchGroup = this.marketSelectionPage.marketSearchResultsGroup(tradeType);
            await expect(
                searchGroup,
                `Search results should include the '${tradeType}' group for '${market}'`
            ).toBeAttached();
            await searchGroup.evaluate(el => el.scrollIntoView({ block: 'center' }));
            await this.marketSelectionPage.marketSearchResultRow(market, tradeType).click();

            await expect(
                this.marketSelectionPage.marketSelectionPanel,
                'Market-selection picker should close after selecting a market'
            ).not.toBeAttached();
            await this.marketSelectionPage.closeMarketSelectionPicker();
            if (!this.isMobile) {
                await expect(
                    this.marketSelectionPage.marketSelectionOverlay,
                    'Market-selection overlay should be gone before continuing'
                ).toHaveCount(0);
            }
            await expect(
                this.activeMarketTab,
                `Active market tab should reflect trade type '${tradeType}' after selection`
            ).toContainText(tradeType);
            await expect(
                this.activeMarketTab,
                `Active market tab should reflect market '${market}' after selection`
            ).toContainText(market);
        }

        if (verifyParams) {
            await this.verifyParamsForTradeType(tradeType, mode, verifyAllowEquals);
        }
    }

    /**
     * Select duration by unit and formatted value.
     * Mobile: unit tab → wheel picker → Save. Desktop: preset chip or manual input.
     *
     * @param unit - 'Ticks' | 'Seconds' | 'Minutes' | 'Hours' | 'End Time'
     * @param formattedValue - e.g. '10 ticks', '5 min', '1 hr', '25 Jun 2026 14:30'
     */
    async selectDuration(unit: string, formattedValue: string): Promise<void> {
        const unitLower = unit.toLowerCase();

        if (unitLower === 'end time') {
            const currentDuration = (await this.durationField.inputValue()).trim();
            if (currentDuration === formattedValue) {
                return;
            }
            await this.durationField.click();
            if (this.isMobile) {
                await expect(this.durationContainer, 'Duration action sheet should open').toBeVisible();
            }
            await this.selectDurationUnitTabIfVisible(unit);

            const endTimeMatch = formattedValue.match(/^(\d{1,2}) (\w+ \d{4}) (\d{2}):(\d{2})$/);
            if (!endTimeMatch) {
                throw new Error(
                    `selectDuration: End time formattedValue must be "DD Mon YYYY HH:mm", got "${formattedValue}"`
                );
            }
            const [, day, monthYear, hour, minute] = endTimeMatch;
            const calendarAriaLabel = `${day} ${monthYear}`;

            await this.durationEndDateInput.click();
            await this.durationCalendarDay(calendarAriaLabel).click();

            await this.durationEndTimeInput.click();
            await this.durationEndTimeHour(hour).click();
            await this.durationEndTimeMinute(minute).click();
            await this.durationEndTimeDoneButton.click();
            return;
        }

        const isMobileTimeUnit = this.isMobile && ['seconds', 'minutes', 'hours'].includes(unitLower);
        const mobileTimeComponents = isMobileTimeUnit ? this.parseTimeComponents(unit, formattedValue) : undefined;

        // Normalize chip label to the value the duration field displays (mobile expands units; hours may use clock format).
        const isHoursFormat = /\bhr\b/.test(formattedValue) || /^\d+h(\s+\d+m)?$/.test(formattedValue);
        const displayValue =
            mobileTimeComponents && mobileTimeComponents.hours > 0
                ? [mobileTimeComponents.hours, mobileTimeComponents.minutes, mobileTimeComponents.seconds]
                      .map(value => String(value).padStart(2, '0'))
                      .join(':')
                : this.isMobile || isHoursFormat
                  ? this.expandDurationForDisplay(formattedValue)
                  : formattedValue;
        const displayRegex = new RegExp(`^${displayValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

        if (displayRegex.test((await this.durationField.inputValue()).trim())) {
            return;
        }

        await this.durationField.click();
        if (this.isMobile) {
            await expect(this.durationContainer, 'Duration action sheet should open').toBeVisible();
        }
        await this.selectDurationUnitTabIfVisible(unit);

        if (this.isMobile) {
            if (unitLower === 'ticks') {
                await expect(
                    this.durationTicksWheel,
                    'Ticks wheel should be visible after selecting the Ticks tab'
                ).toBeVisible();
                await this.selectWheelPickerOption(this.durationTicksWheel, formattedValue);
            } else {
                const { hours, minutes, seconds } = mobileTimeComponents!;
                await expect(
                    this.durationTimeWheel,
                    'Time wheel should be visible after selecting the Time tab'
                ).toBeVisible();
                const columnCount = await this.durationTimeWheel.locator('.quill-wheel-picker__container').count();
                if (columnCount === 3) {
                    await this.selectWheelPickerColumnOption(this.durationTimeWheel, 0, `${hours} hr`);
                    await this.selectWheelPickerColumnOption(this.durationTimeWheel, 1, `${minutes} min`);
                    await this.selectWheelPickerColumnOption(this.durationTimeWheel, 2, `${seconds} sec`);
                } else if (columnCount === 2) {
                    if (unitLower !== 'hours' && unitLower !== 'minutes') {
                        throw new Error(
                            `selectDuration: 2-column Time wheel encountered for unit '${unit}', but the ` +
                                `[hr, min] layout is only confirmed for the 'Hours' and 'Minutes' tabs. ` +
                                `Verify this trade type's actual column order (it may be [min, sec]) before mapping it here.`
                        );
                    }
                    await this.selectWheelPickerColumnOption(this.durationTimeWheel, 0, `${hours} hr`);
                    await this.selectWheelPickerColumnOption(this.durationTimeWheel, 1, `${minutes} min`);
                } else {
                    throw new Error(
                        `selectDuration: unexpected Time wheel column count ${columnCount} for durationTimeWheel`
                    );
                }
            }
            await expect(this.durationContainer, 'Duration sheet should be open on mobile').toBeVisible();
            await this.saveMobileSheet(this.durationContainer);
            await expect(this.durationContainer, 'Duration sheet should close after Save').not.toBeVisible();
        } else {
            const chip = this.durationChip(formattedValue);
            if (await chip.isVisible()) {
                await chip.click();
            } else {
                await this.durationManualInputToggle.click();
                if (unitLower === 'hours') {
                    const hoursMatch = formattedValue.match(/(\d+)h/);
                    const minutesMatch = formattedValue.match(/(\d+)m/);
                    const popover = this.page.locator('.duration-popover__content');
                    await popover.getByRole('textbox', { name: 'Hours' }).fill(hoursMatch ? hoursMatch[1] : '0');
                    await popover.getByRole('textbox', { name: 'Minutes' }).fill(minutesMatch ? minutesMatch[1] : '0');
                } else {
                    const testId =
                        unitLower === 'ticks' ? 'dt_duration_ticks_input_desktop' : 'dt_duration_input_desktop';
                    await this.page.getByTestId(testId).fill(formattedValue.replace(/[^\d.]/g, ''));
                }
                const durationSaveButton = this.page
                    .locator('.duration-input-desktop__footer')
                    .getByRole('button', { name: 'Save' });
                await expect(async () => {
                    await durationSaveButton.click({ timeout: 3_000 }).catch(() => {});
                    await expect(
                        this.durationField,
                        `Duration field should show '${displayValue}' after saving`
                    ).toHaveValue(displayRegex, { timeout: 3_000 });
                }).toPass({ timeout: 20_000 });
            }
        }

        await expect(this.durationField, `Duration field should show '${displayValue}' after selection`).toHaveValue(
            displayRegex
        );
    }

    /**
     * Quill ActionSheet.Header Save — `dt-actionsheet-header-save-action` (scoped to the open sheet).
     */
    protected actionSheetSaveButton(sheet: Locator): Locator {
        return sheet.getByTestId('dt-actionsheet-header-save-action');
    }

    /**
     * Quill ActionSheet.Header Close — `dt-actionsheet-header-close-action` (scoped to the open sheet).
     */
    protected actionSheetCloseButton(sheet: Locator): Locator {
        return sheet.getByTestId('dt-actionsheet-header-close-action');
    }

    /**
     * Tap header Save on an open mobile ActionSheet. Call only after the draft value has changed —
     * Save stays disabled while it matches the committed value (duration.tsx, strike.tsx, etc.).
     */
    protected async saveMobileSheet(sheet: Locator): Promise<void> {
        const saveButton = this.actionSheetSaveButton(sheet);
        await expect(saveButton, 'Action sheet Save should be enabled before committing').toBeEnabled();
        await saveButton.click();
    }

    /**
     * Parse a single-unit Seconds/Minutes/Hours `formattedValue` into hr/min/sec components for the
     * mobile unified Time wheel, defaulting any unmentioned component to 0. Hours also accepts the
     * compound custom format ('1h 30m') or bare hours-only ('2h'), matching desktop's manual-input
     * formats — the wheel can express these directly without needing a separate custom-entry path.
     */
    private parseTimeComponents(
        unit: string,
        formattedValue: string
    ): { hours: number; minutes: number; seconds: number } {
        const unitLower = unit.toLowerCase();
        if (unitLower === 'hours') {
            const compound = formattedValue.match(/^(\d+)h(?:\s+(\d+)m)?$/);
            if (compound) {
                return {
                    hours: parseInt(compound[1], 10),
                    minutes: compound[2] ? parseInt(compound[2], 10) : 0,
                    seconds: 0,
                };
            }
            const chip = formattedValue.match(/^(\d+)\s*hr$/);
            if (chip) return { hours: parseInt(chip[1], 10), minutes: 0, seconds: 0 };
            throw new Error(`selectDuration: unrecognized Hours value "${formattedValue}"`);
        }
        if (unitLower === 'minutes') {
            const match = formattedValue.match(/^(\d+)\s*min$/);
            if (!match) throw new Error(`selectDuration: unrecognized Minutes value "${formattedValue}"`);
            return { hours: 0, minutes: parseInt(match[1], 10), seconds: 0 };
        }
        const match = formattedValue.match(/^(\d+)\s*sec$/);
        if (!match) throw new Error(`selectDuration: unrecognized Seconds value "${formattedValue}"`);
        return { hours: 0, minutes: 0, seconds: parseInt(match[1], 10) };
    }

    /**
     * Expand abbreviated chip labels to the full display format used by the mobile duration input.
     * Desktop abbreviations: 'min', 'sec', 'hr', 'ticks'
     * Mobile display words:  'minutes', 'seconds', 'hours', 'ticks'
     */
    private expandDurationForDisplay(formattedValue: string): string {
        // Custom hours format '1h 30m' — app renders "1 hour 30 minutes"
        const customMatch = formattedValue.match(/^(\d+)h\s+(\d+)m$/);
        if (customMatch) {
            const h = parseInt(customMatch[1], 10);
            const m = parseInt(customMatch[2], 10);
            return `${h} ${h === 1 ? 'hour' : 'hours'} ${m} ${m === 1 ? 'minute' : 'minutes'}`;
        }
        // Chip format '1 hr' / '2 hr' — app renders "1 hour" / "2 hours"
        const hrMatch = formattedValue.match(/^(\d+) hr$/);
        if (hrMatch) {
            const n = parseInt(hrMatch[1], 10);
            return `${n} ${n === 1 ? 'hour' : 'hours'}`;
        }
        // Custom hours-only format '2h' — app renders "2 hours". `isHoursFormat` accepts bare "Xh"
        // (minutes group optional), so handle it here too, otherwise it would fall through unchanged.
        const hoursOnlyMatch = formattedValue.match(/^(\d+)h$/);
        if (hoursOnlyMatch) {
            const n = parseInt(hoursOnlyMatch[1], 10);
            return `${n} ${n === 1 ? 'hour' : 'hours'}`;
        }
        return formattedValue
            .replace(/\bmin\b/, 'minutes')
            .replace(/\bsec\b/, 'seconds')
            .replace(/\bhr\b/, 'hours');
    }

    /**
     * Set the stake amount.
     * Desktop Quick picks: a matching chip commits immediately and closes the popover.
     * Desktop Custom / mobile: type the amount and click Save. Mobile header Save stays disabled
     * until the draft differs from the committed value.
     *
     * @param amount - The stake amount as a string (e.g. '10.00')
     *
     * @example
     * ```typescript
     * await tradeParametersPage.setStake('10.00');
     * ```
     */
    async setStake(amount: string): Promise<void> {
        const expectedStake = parseFloat(amount);
        const currentStake = parseFloat((await this.stakeField.inputValue()).replace(/[^\d.]/g, ''));
        if (!Number.isNaN(currentStake) && currentStake === expectedStake) {
            return;
        }

        await this.stakeField.click();

        const chip = this.stakeChip(amount);
        if (await chip.isVisible()) {
            await chip.click();
            if (this.isMobile) {
                await expect(
                    this.stakeSaveButton,
                    'Stake save button should be enabled after selecting a preset'
                ).toBeEnabled({ timeout: 10_000 });
                await this.stakeSaveButton.click();
                await expect(this.stakeContainer, 'Stake action sheet should dismiss after saving').not.toBeVisible();
            } else {
                await expect(this.stakePopover, 'Stake popover should close after picking a chip').not.toBeVisible();
            }
        } else {
            if (!this.isMobile) {
                await this.stakeManualInputToggle.click();
                await expect(this.stakePopoverInput, 'Custom stake input should be visible').toBeVisible();
            }
            await expect(async () => {
                await this.stakePopoverInput.click();
                await this.stakePopoverInput.clear();
                await this.stakePopoverInput.pressSequentially(amount, { delay: 70 });
                await expect(this.stakePopoverInput, `Stake input should show '${amount}'`).toHaveValue(amount);
                await expect(
                    this.stakeSaveButton,
                    'Stake save button should be enabled — confirms proposal validated'
                ).toBeEnabled();
            }).toPass({ timeout: 20_000 });

            await this.stakeSaveButton.click();
            if (this.isMobile) {
                await expect(this.stakeContainer, 'Stake action sheet should dismiss after saving').not.toBeVisible();
            } else {
                await expect(
                    this.stakePopover,
                    'Stake popover should close after saving Custom stake'
                ).not.toBeVisible();
            }
        }

        // Compare numerically: Vanillas (and some other types) drop a trailing zero in the trigger
        // ("10.0 USD" after saving "10.00"). parseFloat still matches, and "25.00" cannot pass for "5.00".
        // Strip non-numerics first — the trigger is "10.0 USD" on desktop but "$10.0" on mobile, and
        // parseFloat('$10.0') is NaN.
        await expect
            .poll(async () => parseFloat((await this.stakeField.inputValue()).replace(/[^\d.]/g, '')), {
                message: `Stake field should show ${amount} after saving`,
                timeout: 10_000,
            })
            .toBe(expectedStake);
    }

    /**
     * Open the Stake custom input without committing a draft.
     * Desktop switches to the Custom tab; mobile uses the sheet field directly.
     */
    async openStakeCustomInput(): Promise<void> {
        await this.stakeField.click();
        if (!this.isMobile) {
            await this.stakeManualInputToggle.click();
        }
        await expect(this.stakePopoverInput, 'Stake custom input should be visible').toBeVisible();
    }

    /**
     * Replace the current Stake custom draft. Use sequential typing when exercising key filtering.
     *
     * @param value - Draft amount or invalid characters.
     * @param sequential - When true, types character-by-character.
     */
    async fillStakeCustomDraft(value: string, sequential = false): Promise<void> {
        await this.stakePopoverInput.clear();
        if (sequential) {
            await this.stakePopoverInput.pressSequentially(value);
        } else {
            await this.stakePopoverInput.fill(value);
        }
    }

    /**
     * Dismiss an open stake or parameter editor without committing.
     * Mobile: ActionSheet Close. Desktop: overlay click (same pattern as Automate Flow 15).
     *
     * @param sheet - Mobile action-sheet root.
     * @param popover - Desktop popover root.
     * @param label - Assertion label.
     */
    async dismissParameterEditor(sheet: Locator, popover: Locator, label = 'Editor'): Promise<void> {
        if (this.isMobile) {
            await this.actionSheetCloseButton(sheet).click();
            await expect(sheet, `${label} sheet should close after dismiss`).not.toBeVisible();
            return;
        }
        await this.page.locator('.input-popover-overlay').click();
        await expect(popover, `${label} popover should close after dismiss`).not.toBeVisible();
    }

    /** Dismiss the open Stake editor without committing its draft. */
    async dismissStakeEditor(): Promise<void> {
        await this.dismissParameterEditor(this.stakeContainer, this.stakePopover, 'Stake');
    }

    /**
     * Core scroll-and-confirm mechanics shared by single- and multi-column `WheelPicker` sheets:
     * scroll the listbox to the target option's snap position, then wait for the library to mark
     * it as the committed selection.
     *
     * Touch-drag/`mouse.wheel` are unreliable under Playwright's `hasTouch` emulation, so we set
     * `scrollTop` directly and wait for the picker's `scroll` listener to commit the selection before
     * returning — without this wait, a caller that clicks "Save" immediately after can commit the
     * previous value instead, with no chance to retry since Save closes the sheet in one shot.
     *
     * @param scope - Locator scoped to exactly one listbox (the whole wheel for a single-column
     *   picker, or one column's container for a multi-column picker).
     * @param value - Option label exactly as rendered (e.g. 'x200', '5%', '15 min')
     */
    private async commitWheelPickerOption(scope: Locator, value: string): Promise<void> {
        // Options load asynchronously (Skeleton → WheelPicker). Wait for the target option to render
        // before reading the option list, otherwise the labels array can be read empty/partial.
        await expect(
            scope.getByText(value, { exact: true }).first(),
            `Wheel picker option '${value}' should render (range list loaded)`
        ).toBeAttached({ timeout: 15_000 });

        const listbox = scope.locator('[role="listbox"]');
        const options = await scope.locator('[role="option"]').all();
        // `textContent()`, not `innerText()` — WebKit under Playwright automation doesn't reliably
        // compute `innerText` (layout/paint-dependent) for this scroll-snap wheel, returning "" for
        // every option even though they're rendered; `textContent` reads the DOM directly.
        const labels = await Promise.all(options.map(o => o.textContent()));
        const targetIndex = labels.findIndex(t => t?.trim() === value);
        if (targetIndex < 0) throw new Error(`Wheel picker option '${value}' not found`);

        // Snap formula: index*itemHeight + itemHeight/2 (half-item snap offset). Measured live rather
        // than hardcoded, so a future quill-ui item-height change can't silently snap to the wrong option.
        const itemHeight = await options[0].evaluate(el => el.getBoundingClientRect().height);
        await listbox.evaluate(
            (el, scrollTop) => {
                (el as HTMLElement).scrollTop = scrollTop;
            },
            targetIndex * itemHeight + itemHeight / 2
        );

        // Confirm the picker's own scroll handler has actually processed the new position before
        // returning. The library disables every option except the one currently committed as selected
        // (see the vendored WheelPicker: `disabled: optionValue !== selectedValue`), so polling the
        // `disabled` attribute directly (rather than Playwright's `toBeEnabled()`, which only recognizes
        // native form controls) is an implementation-accurate signal that the scroll event has landed.
        await expect(async () => {
            const isDisabled = await options[targetIndex].getAttribute('disabled');
            expect(
                isDisabled,
                `Wheel picker option '${value}' should become the committed selection after scrolling`
            ).toBeNull();
        }).toPass({ timeout: 5_000 });
    }

    /**
     * Select a value in a single-column quill-ui `WheelPicker` action sheet — shared by Growth rate,
     * Multiplier, Payout per point, Strike, and the Duration Ticks-only wheel.
     *
     * @param wheelSelector - CSS selector or locator of the wheel-picker wrapper (e.g. '.multiplier__wheel-picker')
     * @param value - Option label exactly as rendered (e.g. 'x200', '5%')
     */
    protected async selectWheelPickerOption(wheelSelector: string | Locator, value: string): Promise<void> {
        const wheel = typeof wheelSelector === 'string' ? this.page.locator(wheelSelector) : wheelSelector;
        await expect(wheel, 'Wheel picker should be visible').toBeVisible();
        await this.commitWheelPickerOption(wheel, value);
    }

    /**
     * Select a value in one column of a multi-column quill-ui `WheelPicker` — the mobile Duration
     * "Time" tab unifies Seconds/Minutes/Hours into one hr/min/sec wheel (duration-wheel-picker.tsx
     * `DurationTimeWheel`), rendered as sibling `.quill-wheel-picker__container` columns inside one
     * wrapper, each with its own listbox.
     *
     * @param wheelSelector - CSS selector or locator of the wheel-picker wrapper containing all columns
     * @param columnIndex - 0-based column index (e.g. 0 = hours, 1 = minutes, 2 = seconds)
     * @param value - Option label exactly as rendered (e.g. '1 hr', '15 min', '30 sec')
     */
    protected async selectWheelPickerColumnOption(
        wheelSelector: string | Locator,
        columnIndex: number,
        value: string
    ): Promise<void> {
        const wheel = typeof wheelSelector === 'string' ? this.page.locator(wheelSelector) : wheelSelector;
        const column = wheel.locator('.quill-wheel-picker__container').nth(columnIndex);
        await expect(column, `Wheel picker column ${columnIndex} should be visible`).toBeVisible();
        await this.commitWheelPickerOption(column, value);
    }

    /**
     * Enable Take profit and set its amount, for trade types using the standalone TakeProfit widget
     * (Accumulators, Turbos). Opens the Take profit field, toggles TP on via the overlay, fills the
     * amount, saves, and asserts the trigger field reflects it (e.g. "$20.00").
     *
     * While TP is off the amount input is `disabled` behind a full-cover overlay button
     * (`take-profit-and-stop-loss-input.tsx` / `take-profit-input-desktop.tsx`), and Save is gated on
     * the proposal validating the draft — mobile additionally keeps it disabled until the draft differs
     * from the committed value. Each of those states is therefore awaited through an assertion rather
     * than probed with a one-shot `isVisible()`, which raced the action sheet's mount and left TP off.
     *
     * @param amount - Take profit amount as a string (e.g. '20.00')
     */
    async setTakeProfit(amount: string): Promise<void> {
        await this.takeProfitField.click();
        if (this.isMobile) {
            await expect(this.takeProfitSheet, 'Take profit action sheet should open').toBeVisible();
        }

        // The overlay unmounts only once the toggle commits, so retry the tap until it reads as on.
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
        await expect(this.takeProfitInput, 'Take profit input should be editable once the toggle is on').toBeEnabled();

        await this.takeProfitInput.fill(amount);
        await expect(this.takeProfitInput, `Take profit input should show '${amount}'`).toHaveValue(amount);
        await expect(
            this.takeProfitSaveButton,
            'Take profit Save should enable once the proposal validates the drafted amount'
        ).toBeEnabled({ timeout: 15_000 });
        await this.takeProfitSaveButton.click();

        await expect(this.takeProfitField, `Take profit field should show '${amount}' after saving`).toHaveValue(
            new RegExp(amount.replace(/\./g, '\\.'))
        );
    }

    /**
     * Click the purchase / buy button to submit the trade, returning the payout it advertised.
     *
     * The returned value is asserted as-is by every downstream surface — the Reports open-positions
     * row and the open/closed contract details — so it must be the fully priced amount, never a
     * partial render. The amount slot stays visible while its Skeleton is in flight, and renders "-"
     * on a proposal error, so the priced format (`$19.28`) is asserted rather than mere visibility;
     * `toHaveText` retries until the proposal lands. The symbol is then stripped so the numeric string
     * matches how Reports and the contract card render it.
     *
     * @returns The payout as a bare number string, e.g. "19.28"
     *
     * @example
     * ```typescript
     * const payout = await tradeParametersPage.clickBuy();
     * ```
     */
    async clickBuy(): Promise<string> {
        await expect(this.purchaseButton, 'Purchase button should be enabled before buying').toBeEnabled();
        await expect(
            this.purchaseButtonPayout,
            'Buy button should show a priced payout (e.g. "$19.28") before clicking'
        ).toHaveText(/^\D*[\d,]+\.\d+$/);
        const payoutText = (await this.purchaseButtonPayout.innerText()).replace(/,/g, '').replace(/[^\d.]/g, '');
        await this.purchaseButton.click();
        return payoutText;
    }

    /**
     * Click Buy while logged out — opens the authorization `ServiceErrorSheet` instead of purchasing.
     * Does not require a priced payout (unlike {@link clickBuy}).
     */
    async clickBuyLoggedOut(): Promise<void> {
        await expect(this.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await expect(this.purchaseButton, 'Purchase button should be enabled when logged out').toBeEnabled({
            timeout: 30_000,
        });
        await this.purchaseButton.click();
    }

    // ============================================
    // LOCATORS — Buy error popups (authorization required; insufficient balance — Flow 17)
    // ============================================

    /** Desktop modal shell — source: quill-ui Modal in service-error-sheet.tsx */
    get serviceErrorDesktopModal(): Locator {
        return this.page.locator('.quill-modal__container');
    }

    /** Mobile action sheet root — source: service-error-sheet.tsx */
    get serviceErrorMobileSheet(): Locator {
        return this.page.locator('.service-error-sheet');
    }

    get authorizationRequiredTitle(): Locator {
        return this.page.getByText('Start trading with us', { exact: true });
    }

    get authorizationRequiredBody(): Locator {
        return this.page.getByText('Log in or create a free account to place a trade.', { exact: true });
    }

    get authorizationCreateFreeAccountButton(): Locator {
        return this.page.getByRole('button', { name: 'Create free account' });
    }

    get authorizationLoginButton(): Locator {
        return this.page.getByRole('button', { name: 'Login', exact: true });
    }

    get insufficientBalanceTitle(): Locator {
        return this.page.getByText('Insufficient balance', { exact: true });
    }

    get insufficientBalanceDepositButton(): Locator {
        return this.page.getByRole('button', { name: 'Deposit now' });
    }

    get insufficientBalanceBody(): Locator {
        return this.page.getByText(/Your account balance is insufficient to buy this contract/);
    }

    /** Desktop insufficient-balance popup X — source: quill-ui Modal `.quill-modal__close-icon` */
    get insufficientBalancePopupCloseButton(): Locator {
        return this.serviceErrorDesktopModal.locator('button.quill-modal__close-icon');
    }

    /**
     * Assert the authorization-required ServiceErrorSheet is open with expected copy and CTAs.
     * Desktop checks `.quill-modal__container`; mobile checks `.service-error-sheet`.
     */
    async verifyAuthorizationRequiredSheet(): Promise<void> {
        if (this.isMobile) {
            await expect(this.serviceErrorMobileSheet, 'Authorization sheet should be visible on mobile').toBeVisible();
        } else {
            await expect(
                this.serviceErrorDesktopModal,
                'Authorization modal container should be visible on desktop'
            ).toBeVisible();
        }

        await expect(this.authorizationRequiredTitle, 'Authorization sheet title should be visible').toBeVisible();
        await expect(this.authorizationRequiredBody, 'Authorization sheet body should be visible').toBeVisible();
        await expect(
            this.authorizationCreateFreeAccountButton,
            'Create free account button should be visible'
        ).toBeVisible();
        await expect(this.authorizationLoginButton, 'Login button should be visible').toBeVisible();
    }

    async clickAuthorizationLoginButton(): Promise<void> {
        await this.authorizationLoginButton.click();
    }

    async clickAuthorizationCreateFreeAccountButton(): Promise<void> {
        await this.authorizationCreateFreeAccountButton.click();
    }

    /**
     * Assert the insufficient-balance popup is open with title and real-account CTA.
     * Desktop checks `.quill-modal__container`; mobile checks `.service-error-sheet`.
     */
    async verifyInsufficientBalancePopup(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.serviceErrorMobileSheet,
                'Insufficient balance sheet should be visible on mobile'
            ).toBeVisible({ timeout: 30_000 });
        } else {
            await expect(
                this.serviceErrorDesktopModal,
                'Insufficient balance modal container should be visible on desktop'
            ).toBeVisible({ timeout: 30_000 });
        }

        await expect(this.insufficientBalanceTitle, 'Insufficient balance popup title should be visible').toBeVisible();
        await expect(
            this.insufficientBalanceBody,
            'Insufficient balance popup body should show the backend message'
        ).toBeVisible();
        await expect(
            this.insufficientBalanceDepositButton,
            'Deposit now button should be visible on real accounts'
        ).toBeVisible();
    }

    /** Dismiss the insufficient-balance popup without navigating away. */
    async clickInsufficientBalancePopupClose(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.serviceErrorMobileSheet,
                'Insufficient balance popup should be open on mobile'
            ).toBeVisible();
            await this.actionSheetOverlay.click();
            return;
        }

        await this.insufficientBalancePopupCloseButton.click();
    }

    /** Assert the insufficient-balance popup is no longer visible. */
    async verifyInsufficientBalancePopupDismissed(): Promise<void> {
        await expect(
            this.insufficientBalanceTitle,
            'Insufficient balance popup title should be hidden after dismiss'
        ).not.toBeVisible();
        if (this.isMobile) {
            await expect(
                this.serviceErrorMobileSheet,
                'Insufficient balance popup should be hidden on mobile after dismiss'
            ).not.toBeVisible();
            return;
        }

        await expect(
            this.serviceErrorDesktopModal,
            'Insufficient balance popup should be hidden on desktop after dismiss'
        ).not.toBeVisible();
    }

    async clickInsufficientBalanceDepositButton(): Promise<void> {
        await this.insufficientBalanceDepositButton.click();
    }

    /** Wait until Deposit now opens the home-app transfer page prefilled from DTrader. */
    async verifyNavigatedToDepositFromDTrader(): Promise<void> {
        const loginUrl = process.env.LOGIN_URL;
        if (!loginUrl) {
            throw new Error('LOGIN_URL not set in playwright/.env.staging');
        }
        const homeOrigin = new URL(loginUrl).origin;

        await expect(this.page, 'Browser should navigate to the deposit transfer page').toHaveURL(
            url =>
                url.origin === homeOrigin &&
                url.pathname.endsWith('/transfer') &&
                url.searchParams.get('from') === 'dtrader' &&
                url.searchParams.get('source') === 'options' &&
                url.searchParams.get('acc') === 'options' &&
                url.searchParams.get('curr') === 'USD',
            { timeout: 30_000 }
        );

        await expect(
            this.page.getByRole('heading', { name: 'Transfer', exact: true }),
            'Transfer page heading should be visible'
        ).toBeVisible();
        await expect(
            this.page.getByTestId('transfer-btn-close'),
            'Transfer close button should be visible'
        ).toBeVisible();
        await expect(
            this.page.getByTestId('transfer-btn-account-from'),
            'Transfer From account selector should be visible'
        ).toBeVisible();
        await expect(this.page.getByTestId('transfer-btn-account-from'), 'From account should be Wallet').toContainText(
            'Wallet'
        );
        await expect(
            this.page.getByTestId('transfer-btn-account-to'),
            'Transfer To account selector should be visible'
        ).toBeVisible();
        await expect(this.page.getByTestId('transfer-btn-account-to'), 'To account should be Options').toContainText(
            'Options'
        );
        await expect(
            this.page.getByTestId('transfer-btn-account-to'),
            'Options balance should show zero on the transfer page'
        ).toContainText('0.00 USD');
        await expect(
            this.page.getByTestId('transfer-input-amount'),
            'Transfer amount input should be visible'
        ).toBeVisible();
        await expect(
            this.page.getByTestId('transfer-btn-open-review'),
            'Transfer review button should be visible'
        ).toBeVisible();
    }

    /** Wait until the browser navigates to the Deriv login page after clicking Login. */
    async verifyNavigatedToLoginPage(): Promise<void> {
        const loginUrl = process.env.LOGIN_URL;
        if (!loginUrl) {
            throw new Error('LOGIN_URL not set in playwright/.env');
        }

        const loginPath = new URL(loginUrl).pathname;
        await expect(this.page, 'Browser should navigate to the Deriv login page').toHaveURL(
            url => url.pathname === loginPath || url.pathname.endsWith('/login')
        );
    }

    /** Wait until the browser navigates to the Deriv signup page after clicking Create free account. */
    async verifyNavigatedToSignupPage(): Promise<void> {
        const signupUrl = process.env.SIGNUP_URL;
        const signupPath = signupUrl ? new URL(signupUrl).pathname : '/signup';

        await expect(this.page, 'Browser should navigate to the Deriv signup page').toHaveURL(
            url => url.pathname === signupPath || url.pathname.endsWith('/signup')
        );
    }

    // ============================================
    // LOCATORS — Insufficient balance client gate (Flow 14)
    // ============================================

    /**
     * Buy button — the Quill `Button` element (not the inner payout wrapper).
     * Source: purchase-button.tsx — `className='purchase-button purchase-button--single'`.
     * Use for enabled/disabled/click assertions; use {@link purchaseButton} for payout content only.
     */
    get buyButton(): Locator {
        return this.page.locator('.purchase-button--single');
    }

    /** Matches `getInsufficientBalanceMessage` copy for a non-zero balance. */
    static formatInsufficientBalanceHint(balanceAmount: string, currency: string): string {
        const formatted = Number(balanceAmount.replace(/,/g, '')).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `You only have ${formatted} ${currency} left. Try a lower stake.`;
    }

    /** Parse `{ amount, currency }` from the header balance (e.g. `0.00 USD`). */
    async getBalanceHeader(): Promise<{ amount: string; currency: string }> {
        const text = (await this.balance.innerText()).replace(/,/g, '').trim();
        const match = text.match(/^([\d.]+)\s+([A-Z]+)$/);
        if (!match) {
            throw new Error(`Could not parse balance header "${text}"`);
        }
        return { amount: match[1], currency: match[2] };
    }

    async draftStakeInEditor(amount: string): Promise<void> {
        await this.stakeField.click();
        if (!this.isMobile) {
            await this.stakeManualInputToggle.click();
            await expect(this.stakePopoverInput, 'Custom stake input should be visible').toBeVisible();
        }
        await this.stakePopoverInput.click();
        await this.stakePopoverInput.clear();
        await this.stakePopoverInput.fill(amount);
    }

    /** Resolve `${symbol}|${contract_type}` for the active tab from sessionStorage. */
    private async getActiveTabMarketKey(): Promise<string> {
        const marketKey = await this.page.evaluate(() => {
            const sessionTrade = JSON.parse(sessionStorage.getItem('trade_store') ?? '{}') as {
                symbol?: string;
                contract_type?: string;
            };
            if (sessionTrade.symbol && sessionTrade.contract_type) {
                return `${sessionTrade.symbol}|${sessionTrade.contract_type}`;
            }

            const markets = JSON.parse(sessionStorage.getItem('open_markets_v2') ?? '[]') as Array<{
                symbol?: string;
                contract_type?: string;
            }>;
            const active = markets.at(-1);
            if (active?.symbol && active?.contract_type) {
                return `${active.symbol}|${active.contract_type}`;
            }

            return null;
        });

        if (!marketKey) {
            throw new Error('Could not resolve active tab market key from sessionStorage');
        }

        return marketKey;
    }

    /**
     * Commit a stake above balance on the trade page.
     * Save is disabled while the balance hint shows on both viewports, so seed the active tab's
     * `tab_trade_params_v2` amount and reload instead of saving through the stake editor.
     */
    private async commitUnaffordableStakeForGate(unaffordableStake: string): Promise<void> {
        const marketKey = await this.getActiveTabMarketKey();
        const storageKey = 'tab_trade_params_v2';
        await this.page.evaluate(
            ({ key, marketKey, amount }) => {
                const map = JSON.parse(sessionStorage.getItem(key) || '{}');
                map[marketKey] = { ...(map[marketKey] ?? {}), amount };
                sessionStorage.setItem(key, JSON.stringify(map));
            },
            { key: storageKey, marketKey, amount: unaffordableStake }
        );
        await this.page.reload();
        await this.page.waitForLoadState('domcontentloaded');
        await NavigationUtils.waitForDerivApiSettled(this.page);
        await expect(
            this.activeMarketTab,
            'Active market tab should be visible after reloading with seeded stake'
        ).toBeVisible();

        const expectedStake = parseFloat(unaffordableStake);
        await expect
            .poll(async () => parseFloat((await this.stakeField.inputValue()).replace(/[^\d.]/g, '')), {
                message: `Committed stake should restore as ${unaffordableStake} after reload`,
                timeout: 20_000,
            })
            .toBe(expectedStake);
    }

    /**
     * Search session-gated markets in the picker and select the first row tagged **CLOSED**.
     * Returns `null` when every candidate is open at runtime.
     */
    async selectClosedMarketFromPicker(): Promise<{ market: string; tradeType: string } | null> {
        const candidates = FeedPage.MARKETS.filter(market => market.status === 'session_gated').map(market =>
            this.isMobile && market.mobileLabel ? market.mobileLabel : market.label
        );
        return this.marketSelectionPage.selectFirstClosedMarket(candidates);
    }

    /**
     * Flow 12 — closed market: Buy hidden, reopen countdown visible, CLOSED tag still in picker.
     */
    async verifyClosedMarketTradeState(market: string, tradeType: string): Promise<void> {
        await expect(
            this.purchaseButton,
            'Purchase button should be hidden when the market is closed'
        ).not.toBeVisible();
        await expect(
            this.closedMarketReopenIntro,
            'Closed market should show the reopen intro while trading_times loads'
        ).toBeVisible({ timeout: 45_000 });
        await expect(this.closedMarketCountdown, 'Closed market countdown timer should render').toHaveText(
            /^\d{2}:\d{2}:\d{2}$/
        );
        await this.verifyClosedMarketTradeParamsDisabled();

        await this.activeMarketTab.click();
        await expect(this.marketSelectionPage.marketSelectionPanel, 'Market picker should reopen').toBeVisible();
        if (this.isMobile) {
            await this.marketSelectionPage.openMarketSearch();
        }
        await this.marketSelectionPage.marketSearchInput.fill(market);
        const row = await this.marketSelectionPage.waitForMarketSearchResultRow(market);
        await expect(
            this.marketSelectionPage.searchResultRowClosedTag(row),
            `[${market}] should still show CLOSED in the picker after selection`
        ).toBeVisible();
        await expect(
            this.marketSelectionPage.marketSearchResultRow(market, tradeType),
            `[${market}] row should remain under '${tradeType}'`
        ).toBeVisible();
        await this.marketSelectionPage.closeMarketSelectionPicker();
    }

    /** Every interactive control in the visible trade-params row is disabled when `is_market_closed`. */
    private async verifyClosedMarketTradeParamsDisabled(): Promise<void> {
        const wrapper = this.tradeParamsOptionsWrapper;
        await expect(wrapper, 'Trade parameter options should be visible').toBeVisible();
        await expect(
            wrapper.locator('button:enabled'),
            'All trade param buttons should be disabled when the market is closed'
        ).toHaveCount(0);
        await expect(
            wrapper.locator('input:enabled'),
            'All trade param inputs should be disabled when the market is closed'
        ).toHaveCount(0);
    }

    /**
     * Commit a stake above the header balance so the proposal charge exceeds the account balance.
     * Desktop saves via the stake editor; mobile seeds `tab_trade_params_v2` for the active tab and reloads.
     */
    async prepareCommittedUnaffordableStake(): Promise<{
        unaffordableStake: string;
        balance: number;
        balanceAmount: string;
        currency: string;
    }> {
        const { amount: balanceAmount, currency } = await this.getBalanceHeader();
        const balance = parseFloat(balanceAmount);
        const stakeAboveBalance = (balance + 1).toFixed(2);
        const unaffordableStake = balance <= 0 ? '10.00' : stakeAboveBalance;

        await this.commitUnaffordableStakeForGate(unaffordableStake);

        return { unaffordableStake, balance, balanceAmount, currency };
    }

    /**
     * Flow 17 — unaffordable stake: Buy stays enabled, payout quoted, no sheet until Buy is pressed.
     */
    async verifyInsufficientBalanceBuyReady(): Promise<void> {
        await expect(this.buyButton, 'Buy should stay enabled when the committed stake exceeds balance').toBeEnabled({
            timeout: 30_000,
        });
        await expect(this.purchaseButtonPayout, 'Payout should be quoted rather than withheld as "-"').toHaveText(
            /^\D*[\d,]+\.\d+$/
        );
        await expect(
            this.serviceErrorDesktopModal,
            'Insufficient balance should not open a desktop modal before Buy is clicked'
        ).not.toBeVisible();
        await expect(
            this.serviceErrorMobileSheet,
            'Insufficient balance should not open a mobile sheet before Buy is clicked'
        ).not.toBeVisible();
    }

    /**
     * Flow 17 — stake editor balance hint while drafting an unaffordable stake.
     */
    async verifyInsufficientBalanceStakeHint(
        unaffordableStake: string,
        balance: number,
        balanceAmount: string,
        currency: string
    ): Promise<void> {
        await this.draftStakeInEditor(unaffordableStake);
        const expectedHint =
            balance <= 0
                ? 'Balance is empty. Deposit funds to buy this contract.'
                : TradeParametersPage.formatInsufficientBalanceHint(balanceAmount, currency);
        await expect(this.stakeValidationMessage, 'Stake editor should show the balance hint').toHaveText(
            expectedHint,
            { timeout: 20_000 }
        );
        if (this.isMobile) {
            await expect(
                this.stakeSaveButton,
                'Stake Save should stay disabled while the draft exceeds balance'
            ).toBeDisabled();
        }
        await this.dismissStakeEditor();
    }

    /**
     * Flow 17 — zero-balance account: open stake Custom editor and assert the empty-balance hint.
     */
    async verifyEmptyBalanceStakeEditorHint(): Promise<void> {
        await this.stakeField.click();
        if (!this.isMobile) {
            await this.stakeManualInputToggle.click();
            await expect(this.stakePopoverInput, 'Custom stake input should be visible').toBeVisible();
        } else {
            await expect(this.stakeContainer, 'Stake action sheet should be visible').toBeVisible();
        }

        const editorRoot = this.isMobile ? this.stakeContainer : this.stakePopover;
        await expect(
            editorRoot.locator('.message__container__status--error'),
            'Stake editor should show an error state for empty balance'
        ).toBeVisible();
        await expect(this.stakeValidationMessage, 'Stake editor should show the empty-balance hint').toHaveText(
            'Balance is empty. Deposit funds to buy this contract.'
        );
        if (this.isMobile) {
            await expect(this.stakeSaveButton, 'Stake Save should stay disabled while balance is empty').toBeDisabled();
        }
        await this.dismissStakeEditor();
    }

    /**
     * Flow 17 — insufficient balance inform-don't-disable: enabled Buy, quoted payout, stake hint, no sheet yet.
     */
    async verifyInsufficientBalanceClientGate(): Promise<void> {
        const { unaffordableStake, balance, balanceAmount, currency } = await this.prepareCommittedUnaffordableStake();
        await this.verifyInsufficientBalanceBuyReady();
        await this.verifyInsufficientBalanceStakeHint(unaffordableStake, balance, balanceAmount, currency);
    }

    /**
     * Click Buy with a committed unaffordable stake — the server rejects with `InsufficientBalance`.
     */
    async clickBuyWithInsufficientBalance(): Promise<void> {
        await this.verifyInsufficientBalanceBuyReady();
        await this.buyButton.click();
    }

    /**
     * "Higher" option in the Higher/Lower segmented control.
     * Source: purchase-button.tsx segmented-control-single > button.item containing "Higher"
     * Scoped to .trade-params__option to avoid matching other buttons with the same label.
     */
    get higherOption(): Locator {
        return this.page.locator('.trade-params__option').getByRole('button', { name: 'Higher', exact: true });
    }

    /**
     * "Lower" option in the Higher/Lower segmented control.
     * Source: purchase-button.tsx segmented-control-single > button.item containing "Lower"
     * Scoped to .trade-params__option to avoid matching other buttons with the same label.
     */
    get lowerOption(): Locator {
        return this.page.locator('.trade-params__option').getByRole('button', { name: 'Lower', exact: true });
    }

    /**
     * Open the Barrier popover/action-sheet, optionally switch type, set the value, and save.
     *
     * The app snaps the typed offset to a market-valid value relative to the live spot, so the saved
     * value may differ from the input (especially on fast-ticking 1s indices, e.g. "5.11" → "+4.15").
     * Assert the sign/format the type implies, then return the accepted offset so callers can verify
     * the contract's barrier price against what the app actually used rather than the hardcoded input.
     * Skips opening the editor when the field already shows the target offset (and type, if given).
     *
     * @param value - Numeric string without sign prefix, e.g. '3.51'
     * @param type  - Barrier type to select before typing. Omit to keep the current type.
     * @returns The barrier offset the app accepted, unsigned (e.g. '4.15').
     */
    async setBarrier(value: string, type?: 'Above spot' | 'Below spot' | 'Fixed barrier'): Promise<string> {
        const fieldInput = this.barrierField.locator('input');
        const current = (await fieldInput.inputValue()).trim();
        const unsignedCurrent = current.replace(/^[+-]/, '');
        if (unsignedCurrent === value && this.isBarrierCommittedAs(current, type)) {
            return unsignedCurrent;
        }

        await this.barrierField.click();
        if (this.isMobile) {
            await expect(this.barrierSheet, 'Barrier action sheet should open').toBeVisible();
        }
        if (type) {
            const tab = this.barrierTypeTab(type);
            if (this.isMobile) {
                await expect(tab, `Barrier type tab "${type}" should be visible`).toBeVisible();
                if ((await tab.getAttribute('aria-selected')) !== 'true') {
                    await tab.click();
                }
            } else {
                await tab.click();
            }
            await expect(tab, `Barrier type "${type}" should be selected`).toHaveAttribute('aria-selected', 'true');
        }
        const input = this.isMobile ? this.barrierSheet.locator('input[name="barrier_1"]') : this.barrierInput;
        await input.clear();
        await input.fill(value);
        await expect(input, `Barrier input should contain "${value}" before saving`).toHaveValue(value);
        if (this.isMobile) {
            await expect(async () => {
                await expect(
                    this.barrierSaveButton,
                    'Barrier Save should enable after proposal validates the draft'
                ).toBeEnabled();
                await this.saveMobileSheet(this.barrierSheet);
            }).toPass({ timeout: 20_000 });
            await expect(this.barrierSheet, 'Barrier sheet should close after Save').not.toBeVisible();
        } else {
            await this.barrierSaveButton.click();
        }
        // The app snaps the barrier to the nearest market-valid offset, so the saved value can differ
        // from the input. Assert the sign/format the type implies, then return the accepted offset.
        const savedInput = this.barrierField.locator('input');
        // 'Above spot' → '+N', 'Below spot' → '-N', 'Fixed barrier' → 'N'. When type is omitted the current
        // widget mode is unknown, so accept an optional sign ('[+-]?') to match signed and unsigned values.
        const signPattern = type === 'Above spot' ? '\\+' : type === 'Below spot' ? '-' : type ? '' : '[+-]?';
        await expect(
            savedInput,
            `Barrier field should show a valid ${type ?? 'fixed'} offset after saving`
        ).toHaveValue(new RegExp(`^${signPattern}\\d+(\\.\\d+)?$`));
        const acceptedValue = (await savedInput.inputValue()).trim();
        return acceptedValue.replace(/^[+-]/, '');
    }

    /**
     * Whether the committed barrier field already reflects `value` and, when provided, `type`.
     * Save stays disabled while the draft matches the committed barrier — skip opening the sheet.
     */
    private isBarrierCommittedAs(current: string, type?: 'Above spot' | 'Below spot' | 'Fixed barrier'): boolean {
        if (!type) {
            return true;
        }
        if (type === 'Above spot') {
            return current.startsWith('+');
        }
        if (type === 'Below spot') {
            return current.startsWith('-');
        }
        return !/^[+-]/.test(current);
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Verify that the Allow Equals toggle is currently enabled (aria-pressed="true").
     * Desktop: checks the toggle in .allow-equals__wrapper.
     * Mobile: checks the minimized field value shows "Yes".
     */
    async verifyAllowEqualsEnabled(): Promise<void> {
        if (this.isMobile) {
            const field = this.page.locator('.trade-params__option--minimized', { hasText: 'Allow equals' });
            await expect(
                field.locator('input'),
                'Allow equals minimized field should show "Yes" when enabled'
            ).toHaveValue('Yes');
        } else {
            await expect(
                this.allowEqualsToggle,
                'Allow equals toggle should be on (aria-pressed="true")'
            ).toHaveAttribute('aria-pressed', 'true');
        }
    }

    /**
     * Verifies the visible params after selecting a trade type.
     * Add a case here for each new trade type as it is implemented.
     *
     * @param tradeType - The trade type that was just selected
     * @param mode - `'manual'` asserts Buy button; `'automate'` asserts Run instead
     * @param verifyAllowEquals - Require the configuration-dependent Allow equals control.
     */
    protected async verifyParamsForTradeType(
        tradeType: string,
        mode: 'manual' | 'automate' = 'manual',
        verifyAllowEquals = true
    ): Promise<void> {
        const isAutomate = mode === 'automate';

        switch (tradeType) {
            case 'Rise/Fall':
                await expect(this.riseButton, 'Rise button should be visible for Rise/Fall').toBeVisible();
                await expect(this.fallButton, 'Fall button should be visible for Rise/Fall').toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Rise/Fall').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Rise/Fall');
                if (!isAutomate && verifyAllowEquals) {
                    await expect(this.allowEqualsText, 'Allow equals should be visible for Rise/Fall').toBeVisible();
                }
                if (!isAutomate) {
                    await expect(this.purchaseButton, 'Buy button should be visible for Rise/Fall').toBeVisible();
                }
                break;
            case 'Accumulators':
                await expect(
                    this.growthRateLabel,
                    'Growth rate param should be visible for Accumulators'
                ).toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Accumulators');
                await expect(
                    this.takeProfitLabel,
                    'Take profit param should be visible for Accumulators'
                ).toBeVisible();
                if (!isAutomate) {
                    await expect(
                        this.accumulatorsStats,
                        'Accumulators stats panel should be visible for Accumulators'
                    ).toBeVisible();
                    await expect(
                        this.singlePurchaseButton,
                        'Buy button should be visible for Accumulators'
                    ).toBeVisible();
                } else if (!this.isMobile) {
                    await expect(
                        this.accumulatorsStats,
                        'Accumulators stats panel should be visible for Accumulators on desktop automate'
                    ).toBeVisible();
                }
                break;
            case 'Higher/Lower':
                await expect(this.barrierLabel, 'Barrier param should be visible for Higher/Lower').toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Higher/Lower').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Higher/Lower');
                if (!isAutomate) {
                    await expect(this.purchaseButton, 'Buy button should be visible for Higher/Lower').toBeVisible();
                }
                break;
            case 'Touch/No Touch':
                await expect(this.barrierLabel, 'Barrier param should be visible for Touch/No Touch').toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Touch/No Touch').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Touch/No Touch');
                if (!isAutomate) {
                    await expect(this.purchaseButton, 'Buy button should be visible for Touch/No Touch').toBeVisible();
                }
                break;
            case 'Matches/Differs':
                await expect(
                    this.lastDigitPredictionParam,
                    'Last digit prediction should be visible for Matches/Differs'
                ).toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Matches/Differs').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Matches/Differs');
                if (!isAutomate) {
                    await expect(this.purchaseButton, 'Buy button should be visible for Matches/Differs').toBeVisible();
                }
                break;
            case 'Over/Under':
                await expect(
                    this.lastDigitPredictionParam,
                    'Last digit prediction should be visible for Over/Under'
                ).toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Over/Under').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Over/Under');
                if (!isAutomate) {
                    await expect(this.purchaseButton, 'Buy button should be visible for Over/Under').toBeVisible();
                }
                break;
            case 'Even/Odd':
                // Even/Odd has no last-digit prediction selector — the outcome is even vs odd.
                await expect(
                    this.lastDigitPredictionParam,
                    'Last digit prediction should NOT be visible for Even/Odd'
                ).not.toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Even/Odd').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Even/Odd');
                if (!isAutomate) {
                    await expect(this.purchaseButton, 'Buy button should be visible for Even/Odd').toBeVisible();
                }
                break;
            case 'Turbos':
                await expect(this.durationLabel, 'Duration param should be visible for Turbos').toBeVisible();
                await expect(
                    this.payoutPerPointParam,
                    'Payout per point param should be visible for Turbos'
                ).toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Turbos');
                await expect(this.takeProfitLabel, 'Take profit param should be visible for Turbos').toBeVisible();
                if (!isAutomate) {
                    await expect(this.singlePurchaseButton, 'Buy button should be visible for Turbos').toBeVisible();
                }
                break;
            case 'Multipliers':
                await expect(this.multiplierLabel, 'Multiplier param should be visible for Multipliers').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Multipliers');
                await expect(
                    this.riskManagementLabel,
                    'Risk management param should be visible for Multipliers'
                ).toBeVisible();
                if (!isAutomate) {
                    await expect(
                        this.singlePurchaseButton,
                        'Buy button should be visible for Multipliers'
                    ).toBeVisible();
                }
                break;
            case 'Vanillas':
                await expect(this.strikePriceLabel, 'Strike price param should be visible for Vanillas').toBeVisible();
                await expect(this.durationLabel, 'Duration param should be visible for Vanillas').toBeVisible();
                await this.assertStakeParamVisible(isAutomate, 'Vanillas');
                // Payout per point info is a below-params row on desktop only — mobile drops it
                // (trade-parameters.tsx `{!isMobile && ...}`) and surfaces the value inside the
                // Strike action sheet instead. TradeVanillasPage.verifyPayoutPerPointInfo() covers both.
                if (!this.isMobile) {
                    await expect(
                        this.payoutPerPointInfo,
                        'Payout per point info panel should be visible for Vanillas on desktop'
                    ).toBeVisible();
                }
                if (!isAutomate) {
                    await expect(this.singlePurchaseButton, 'Buy button should be visible for Vanillas').toBeVisible();
                }
                break;
            default:
                throw new Error(
                    `verifyParamsForTradeType: no assertions defined for trade type '${tradeType}'. ` +
                        `Add a case to this switch before using selectMarketAndTradeType() with this type.`
                );
        }

        if (isAutomate) {
            await this.assertAutomateRunControl();
        }
    }

    /** Stake label — desktop automate tab reads "Initial stake"; mobile /automate keeps "Stake". */
    private async assertStakeParamVisible(isAutomate: boolean, tradeType: string): Promise<void> {
        const label = isAutomate && !this.isMobile ? this.page.getByLabel('Initial stake').first() : this.stakeLabel;
        await expect(label, `Stake param should be visible for ${tradeType}`).toBeVisible();
    }

    /** Run button replaces Buy in automation mode (AutomationActions). */
    private async assertAutomateRunControl(): Promise<void> {
        const runButton = this.page.getByRole('button', { name: 'Run', exact: true });
        await expect(runButton, 'Run button should be visible in automate mode').toBeVisible();
        await expect(runButton, 'Run button should be enabled in automate mode').toBeEnabled();
    }

    /**
     * Verify the landing page state before login — login button visible, trade form accessible.
     */
    async verifyDTraderLandingPageLoggedOut(): Promise<void> {
        await expect(this.loginButton, 'Login button should be visible when logged out').toBeVisible();
        await expect(this.accountInfo, 'Account info should not be visible when logged out').not.toBeVisible();
        await expect(
            this.marketSelectionPage.addMarketButton,
            '"Add market" button should be visible before login'
        ).toBeVisible();
        await expect(this.activeMarketTab, 'Rise/Fall should be the active market tab by default').toBeVisible();
        await expect(this.purchaseButton, 'Purchase button should be visible before login').toBeVisible();

        if (this.isMobile) {
            await expect(this.bottomNavHome, 'Bottom nav Home tab should be visible when logged out').toBeVisible();
            await expect(this.bottomNavTrade, 'Bottom nav Trade tab should be visible when logged out').toBeVisible();
            await expect(this.bottomNavMenu, 'Bottom nav Menu tab should be visible when logged out').toBeVisible();
            await expect(
                this.bottomNavPositions,
                'Bottom nav Positions tab should not be visible when logged out'
            ).not.toBeVisible();
        } else {
            await expect(this.sidebarHomeButton, 'Sidebar Home button should be visible when logged out').toBeVisible();
            await expect(this.sidebarHelpButton, 'Sidebar Help button should be visible when logged out').toBeVisible();
            await expect(
                this.sidebarLanguageButton,
                'Sidebar Language button should be visible when logged out'
            ).toBeVisible();
            await expect(
                this.sidebarThemeButton,
                'Sidebar Theme button should be visible when logged out'
            ).toBeVisible();
            await expect(
                this.sidebarPositionsButton,
                'Sidebar Positions button should not be visible when logged out'
            ).not.toBeVisible();
            await expect(
                this.sidebarReportsButton,
                'Sidebar Reports button should not be visible when logged out'
            ).not.toBeVisible();
            await expect(
                this.sidebarLogoutButton,
                'Sidebar Log out button should not be visible when logged out'
            ).not.toBeVisible();
        }
    }

    /**
     * Verify the core trade parameters are visible on the trade page.
     */
    async verifyDTraderLandingPage(): Promise<void> {
        await this.verifySuccessfulLogin();
        await expect(
            this.marketSelectionPage.addMarketButton,
            '"Add market" button should be visible on the trade form'
        ).toBeVisible();
        await expect(this.activeMarketTab, 'Active market tab should be visible on the trade form').toBeVisible();
        await expect(this.riseButton, 'Rise button should be visible as the default contract type').toBeVisible();
        await expect(this.fallButton, 'Fall button should be visible as the default contract type').toBeVisible();
        await expect(this.durationLabel, 'Duration field should be visible on the trade form').toBeVisible();
        await expect(this.stakeLabel, 'Stake field should be visible on the trade form').toBeVisible();
        await expect(
            this.allowEqualsText,
            'Allow equals should be visible for Rise/Fall on the trade form'
        ).toBeVisible();
        await expect(this.purchaseButton, 'Purchase button should be visible on the trade form').toBeVisible();

        if (this.isMobile) {
            await expect(
                this.tradeParamsContainer,
                'Trade params container (bottom sheet) should be visible on mobile'
            ).toBeVisible();
        } else {
            await expect(
                this.networkStatus,
                'Network status indicator should be visible on the desktop trade form'
            ).toBeVisible();
            await expect(
                this.fullscreenToggle,
                'Fullscreen toggle should be visible on the desktop trade form'
            ).toBeVisible();
        }
    }
}
