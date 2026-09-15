import { expect, type Locator } from '@playwright/test';
import { TradeParametersPage } from './TradeParametersPage';
import { PositionsPage } from './PositionsPage';
import { ReportsPage } from './ReportsPage';
import { ContractDetailsPage } from './ContractDetailsPage';

/**
 * Page Object for the Multipliers contract type on the trade page (/).
 *
 * Extends TradeParametersPage (→ TradeBasePage) and adds:
 *  - Multiplier parameter locators (desktop: SelectionListPopover, mobile: WheelPicker)
 *  - Risk management label locator
 *  - Up / Down purchase buttons
 *  - buyUpAndVerify / buyDownAndVerify — full 7-step verification chain
 *  - buyUpAndVerifyWithDC / buyDownAndVerifyWithDC — Deal Cancellation buy → cancel chain
 *
 * @example
 * ```typescript
 * test.beforeEach(async ({ page, loginPage, tradeMultipliersPage }) => {
 *     await TradeBasePage.seedLocalStorageOnOrigin(page);
 *     await loginPage.login(accountEmail, accountPassword);
 * });
 * ```
 */
export class TradeMultipliersPage extends TradeParametersPage {
    private readonly positionsPage: PositionsPage;
    private readonly reportsPage: ReportsPage;
    private readonly contractDetailsPage: ContractDetailsPage;

    constructor(page: import('@playwright/test').Page) {
        super(page);
        this.positionsPage = new PositionsPage(page);
        this.reportsPage = new ReportsPage(page);
        this.contractDetailsPage = new ContractDetailsPage(page);
    }

    // ============================================
    // LOCATORS
    // ============================================

    /**
     * Multiplier field trigger (read-only TextField that opens the popover/action-sheet).
     * Desktop: TradeParameterPopover renders a readOnly TextField labelled "Multiplier".
     * Mobile: multiplier.tsx renders a readOnly TextField labelled "Multiplier".
     * Source: multiplier-desktop.tsx + multiplier.tsx
     */
    get multiplierField(): Locator {
        return this.page.getByRole('textbox', { name: 'Multiplier' });
    }

    /**
     * Buy button — single button shared by both Up and Down directions.
     * Direction is set via the segmented control before clicking this.
     * Source: purchase-button.tsx — className='purchase-button purchase-button--single'
     * The Multipliers buy button always renders in single-button mode.
     */
    get buyButton(): Locator {
        return this.page.locator('.purchase-button--single');
    }

    /**
     * Total cost shown on the Buy button while Deal Cancellation is active.
     * Includes stake + commission + DC fee (purchase-button-content.tsx).
     * The wrapper holds two direct `<span>` children: the "Total cost" label then the amount,
     * rendered symbol-prefixed ("$24.93") by `formatAmountWithSymbol` — no `dt_span`.
     */
    get multipliersTotalCost(): Locator {
        return this.purchaseButton.locator('> span').last();
    }

    /**
     * Direction segment button inside the segmented control.
     * Source: segmented-control-single — two <button class="item"> elements: "Up" and "Down".
     *
     * @param direction - "Up" or "Down"
     */
    directionButton(direction: 'Up' | 'Down'): Locator {
        return this.page.locator('.segmented-control-single button.item', { hasText: direction });
    }

    /**
     * Stop out value (the loss amount) — viewport-aware.
     * - Desktop: always visible on the landing page, `.multipliers-information__row`; the amount is
     *   a symbol-prefixed plain string ("$19.86") via `formatAmountWithSymbol`, so it is the row's
     *   last text node rather than a Money `dt_span`.
     * - Mobile: no landing-page equivalent — only rendered inside the Stake action sheet's details
     *   rows (stake-details.tsx) while it's open; value is the row's last text node.
     * The label is matched exactly so this row is not confused with the "Stop out level" row.
     */
    get stopOutValue(): Locator {
        return this.isMobile
            ? this.page
                  .locator('.stake-content__details-row')
                  .filter({ has: this.page.getByText('Stop out', { exact: true }) })
                  .locator('p')
                  .last()
            : this.page
                  .locator('.multipliers-information__row')
                  .filter({ has: this.page.getByText('Stop out', { exact: true }) })
                  .locator('p')
                  .last();
    }

    /**
     * Stop out level value (the stop-out price) — viewport-aware.
     * - Desktop: always visible on the landing page, `.multipliers-information__row` (plain text,
     *   not <Money>, so no `dt_span` — the value is the row's last text node).
     * - Mobile: only rendered inside the Stake action sheet's details rows while it's open.
     * The label is matched exactly so this row is not confused with the "Stop out" row.
     */
    get stopOutLevelValue(): Locator {
        return this.isMobile
            ? this.page
                  .locator('.stake-content__details-row')
                  .filter({ has: this.page.getByText('Stop out level', { exact: true }) })
                  .locator('p')
                  .last()
            : this.page
                  .locator('.multipliers-information__row')
                  .filter({ has: this.page.getByText('Stop out level', { exact: true }) })
                  .locator('p')
                  .last();
    }

    /**
     * Risk management field (read-only TextField that opens the risk management panel).
     * Desktop: TradeParameterPopover; Mobile: ActionSheet.
     * Source: risk-management.tsx + risk-management-desktop.tsx
     */
    get riskManagementField(): Locator {
        return this.page.getByLabel('Risk management').first();
    }

    /**
     * "TP & SL" tab in the desktop risk management popover sidebar.
     * Source: risk-management-desktop.tsx — vertical-tab-selector first tab.
     */
    get tpSlTabDesktop(): Locator {
        return this.page.locator('.vertical-tab-selector').getByRole('tab', { name: 'TP & SL' });
    }

    /**
     * "DC" tab in the desktop risk management popover sidebar.
     * Source: risk-management-desktop.tsx — vertical-tab-selector second tab.
     */
    get dcTabDesktop(): Locator {
        return this.page.locator('.vertical-tab-selector').getByRole('tab', { name: 'DC' });
    }

    /**
     * Take profit toggle switch in the desktop risk management popover.
     * Scoped to the .risk-management-desktop__field containing the "Take profit" label.
     */
    get tpToggleDesktop(): Locator {
        return this.page
            .locator('.risk-management-desktop__field', { has: this.page.locator('p', { hasText: 'Take profit' }) })
            .locator('button.toggle-switch');
    }

    /**
     * Take profit input (the Quill Textfield wrapper) in the desktop risk management popover.
     * Scoped to the .risk-management-desktop__field containing the "Take profit" label.
     */
    get tpInputDesktop(): Locator {
        return this.page
            .locator('.risk-management-desktop__field', { has: this.page.locator('p', { hasText: 'Take profit' }) })
            .getByRole('textbox', { name: 'Amount' });
    }

    /**
     * Take profit toggle switch in the mobile risk management ActionSheet.
     * Source: take-profit-and-stop-loss-input.tsx — button.toggle-switch inside the TP wrapper.
     * Scoped via the .take-profit__wrapper containing "Take profit" text.
     */
    get tpToggleMobile(): Locator {
        return this.page
            .locator('.take-profit__wrapper', { has: this.page.locator('p', { hasText: 'Take profit' }) })
            .locator('button.toggle-switch');
    }

    /**
     * Take profit input in the mobile risk management ActionSheet.
     * Source: take-profit-and-stop-loss-input.tsx — data-testid="dt_tp_input" is on the <input> itself.
     */
    get tpInputMobile(): Locator {
        return this.page.getByTestId('dt_tp_input');
    }

    /**
     * "Range" hint below the TP input — only visible after the proposal API responds.
     * Used as a readiness signal before clicking Save on mobile.
     */
    get tpAcceptableRangeHint(): Locator {
        return this.page
            .locator('.take-profit__wrapper', { has: this.page.locator('p', { hasText: 'Take profit' }) })
            .locator('.message__container__text', { hasText: 'Range' });
    }

    /**
     * "Range" hint below the SL input — only visible after the proposal API responds.
     * Used as a readiness signal before clicking Save on mobile.
     */
    get slAcceptableRangeHint(): Locator {
        return this.page
            .locator('.take-profit__wrapper', { has: this.page.locator('p', { hasText: 'Stop loss' }) })
            .locator('.message__container__text', { hasText: 'Range' });
    }

    /**
     * Stop loss toggle switch in the desktop risk management popover.
     * Scoped to the .risk-management-desktop__field containing the "Stop loss" label.
     */
    get slToggleDesktop(): Locator {
        return this.page
            .locator('.risk-management-desktop__field', { has: this.page.locator('p', { hasText: 'Stop loss' }) })
            .locator('button.toggle-switch');
    }

    /**
     * Stop loss input (the Quill Textfield wrapper) in the desktop risk management popover.
     * Scoped to the .risk-management-desktop__field containing the "Stop loss" label.
     */
    get slInputDesktop(): Locator {
        return this.page
            .locator('.risk-management-desktop__field', { has: this.page.locator('p', { hasText: 'Stop loss' }) })
            .getByRole('textbox', { name: 'Amount' });
    }

    /**
     * Stop loss toggle in the mobile risk management ActionSheet.
     * Source: take-profit-and-stop-loss-input.tsx — button.toggle-switch inside the SL wrapper.
     * Scoped via the .take-profit__wrapper containing "Stop loss" text.
     */
    get slToggleMobile(): Locator {
        return this.page
            .locator('.take-profit__wrapper', { has: this.page.locator('p', { hasText: 'Stop loss' }) })
            .locator('button.toggle-switch');
    }

    /**
     * Stop loss input in the mobile risk management ActionSheet.
     * Source: take-profit-and-stop-loss-input.tsx — data-testid="dt_sl_input"
     */
    get slInputMobile(): Locator {
        return this.page.getByTestId('dt_sl_input');
    }

    /**
     * "TP & SL" tab in the mobile segmented control.
     * Source: risk-management-picker.tsx — segmented-control-single first button.item.
     */
    get tpSlTabMobile(): Locator {
        return this.page.locator('.risk-management__picker .segmented-control-single button.item', {
            hasText: 'TP & SL',
        });
    }

    /**
     * "Deal cancellation" tab in the mobile segmented control.
     * Source: risk-management-picker.tsx — segmented-control-single second button.item.
     */
    get dcTabMobile(): Locator {
        return this.page.locator('.risk-management__picker .segmented-control-single button.item', {
            hasText: 'Deal cancellation',
        });
    }

    /**
     * Deal cancellation toggle in the mobile ActionSheet.
     * Source: deal-cancellation.tsx — button.toggle-switch inside .deal-cancellation__toggle.
     */
    get dcToggleMobile(): Locator {
        return this.page.locator('.deal-cancellation__toggle').locator('button.toggle-switch');
    }

    /**
     * Deal cancellation toggle in the desktop popover.
     * Source: deal-cancellation-desktop.tsx — button.toggle-switch inside .deal-cancellation-desktop__wrapper.
     * Uses aria-pressed (not aria-checked) — same as TP/SL toggles.
     */
    get dcToggleDesktop(): Locator {
        return this.page.locator('.deal-cancellation-desktop__wrapper').locator('button.toggle-switch');
    }

    /**
     * A DC duration chip in the desktop popover.
     * Valid values: '5 min', '10 min', '15 min', '30 min', '60 min'.
     * Source: deal-cancellation-desktop.tsx — value-chips__chip with aria-label="Select value <n> min"
     *
     * @param duration - Duration label as shown on the chip (e.g. '60 min')
     */
    dcChipDesktop(duration: '5 min' | '10 min' | '15 min' | '30 min' | '60 min'): Locator {
        return this.page
            .locator('.deal-cancellation-desktop__chips')
            .getByRole('button', { name: `Select value ${duration}`, exact: true });
    }

    /**
     * A DC duration option in the mobile ActionSheet WheelPicker.
     * Valid values: '5 min', '10 min', '15 min', '30 min', '60 min'.
     * Source: deal-cancellation.tsx — quill-wheel-picker items with role="option".
     *
     * @param duration - Duration label as shown in the wheel (e.g. '60 min')
     */
    dcChipMobile(duration: '5 min' | '10 min' | '15 min' | '30 min' | '60 min'): Locator {
        return this.page
            .locator('.deal-cancellation__wheel-picker')
            .getByRole('option', { name: duration, exact: true });
    }

    /**
     * "Save" button inside the risk management panel.
     * Desktop TP/SL: .risk-management-desktop__tp-sl-wrapper > Save — real `disabled` attribute tied
     *                to tp_is_loading/sl_is_loading, so `toBeEnabled()` is a reliable readiness check.
     * Desktop DC:    .deal-cancellation-desktop__footer > Save
     * Mobile TP/SL:  Rendered directly inside .risk-management__tp-sl__wrapper (NOT hoisted to any
     *                ActionSheet footer) — take-profit-and-stop-loss-container.tsx. This button has
     *                no `disabled` state at all; `onSave` silently no-ops if the TP/SL proposal ref
     *                isn't ready yet, so callers must retry the click rather than trust one attempt.
     * Mobile DC:     Same picker container, scoped via .risk-management__picker.
     * Source: take-profit-stop-loss-desktop.tsx, deal-cancellation-desktop.tsx,
     *         take-profit-and-stop-loss-container.tsx, deal-cancellation.tsx, risk-management-picker.tsx
     */
    riskManagementSaveButton(mode: 'tp_sl' | 'dc' = 'tp_sl'): Locator {
        if (this.isMobile) {
            return this.actionSheetSaveButton(this.riskManagementSheet);
        }
        return mode === 'dc'
            ? this.page.locator('.deal-cancellation-desktop__footer').getByRole('button', { name: 'Save' })
            : this.page.locator('.risk-management-desktop__tp-sl-wrapper').getByRole('button', { name: 'Save' });
    }

    /**
     * Mobile risk-management action sheet (while open).
     * Source: risk-management-picker.tsx — header Save commits the active tab.
     */
    get riskManagementSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has(.risk-management__picker)');
    }

    /**
     * Multiplier option button inside the desktop SelectionListPopover.
     * Source: SelectionListPopover.tsx — role="option", text content is the multiplier label (e.g. "x200").
     *
     * @param value - Multiplier label as rendered (e.g. 'x200', 'x300')
     */
    multiplierOption(value: string): Locator {
        return this.page.getByRole('option', { name: value, exact: true });
    }

    /**
     * WheelPicker item for a multiplier value — mobile only.
     * Source: WheelPicker data items rendered with text content matching multiplier_range_list text (e.g. "x200").
     *
     * @param value - Multiplier label as rendered (e.g. 'x200', 'x300')
     */
    multiplierWheelItem(value: string): Locator {
        return this.page.locator('.multiplier__wheel-picker').getByText(value, { exact: true });
    }

    /**
     * Open Multiplier action sheet (mobile). Save/Close live in ActionSheet.Header.
     * Source: multiplier.tsx ActionSheet.Header saveAction / closeAction
     */
    get multiplierSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has(.multiplier__wheel-picker)');
    }

    /**
     * "Save" button in the multiplier ActionSheet header — mobile only.
     */
    get multiplierMobileSaveButton(): Locator {
        return this.actionSheetSaveButton(this.multiplierSheet);
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Set the multiplier value.
     * Desktop: opens the SelectionListPopover and clicks the matching option.
     * Mobile: opens the WheelPicker ActionSheet, selects the value, clicks Save.
     *
     * @param value - Multiplier label as rendered (e.g. 'x200', 'x300')
     *
     * @example
     * ```typescript
     * await tradeMultipliersPage.setMultiplier('x200');
     * ```
     */
    async setMultiplier(value: string): Promise<void> {
        const currentValue = (await this.multiplierField.inputValue()).trim();
        if (currentValue === value) {
            return;
        }

        if (this.isMobile) {
            await this.multiplierField.click();

            // Scroll-snap the wheel to the target value (waits for the range list to load first —
            // avoids the "option not found" race when the picker still shows its Skeleton).
            await this.selectWheelPickerOption('.multiplier__wheel-picker', value);

            await this.saveMobileSheet(this.multiplierSheet);
            await expect(
                this.page.locator('.multiplier__wheel-picker'),
                'Multiplier action sheet should dismiss after saving'
            ).not.toBeVisible();
        } else {
            const listbox = this.page.getByRole('listbox', { name: 'Selection options' });

            // The market-selection overlay covers the trade form; dismiss it before opening the
            // multiplier popover (otherwise the click closes the market picker or never reaches
            // the Multiplier field).
            await expect(async () => {
                await this.marketSelectionPage.closeMarketSelectionPicker();
                if (!(await listbox.isVisible())) {
                    await this.multiplierField.click();
                }
                await expect(
                    listbox,
                    'Multiplier selection list should be visible after opening the popover'
                ).toBeVisible();
            }).toPass({ timeout: 15_000 });

            await this.multiplierOption(value).click();
        }

        await expect(this.multiplierField, `Multiplier field should show '${value}' after selection`).toHaveValue(
            value
        );
    }

    /**
     * Select Up or Down in the direction segmented control and verify the segment is active.
     * Mirrors the clickRiseFallOption pattern in TradeRiseFallPage.
     *
     * @param direction - 'Up' or 'Down'
     */
    async clickUpDownOption(direction: 'Up' | 'Down'): Promise<void> {
        await this.directionButton(direction).click();
        await expect(
            this.directionButton(direction),
            `"${direction}" segment should be selected after clicking`
        ).toHaveClass(/selected/);
    }

    /**
     * Click the Buy button. Call clickUpDownOption() first to set the direction.
     */
    async clickMultipliersBuy(): Promise<void> {
        await expect(this.buyButton, 'Buy button should be enabled before buying').toBeEnabled();
        await this.buyButton.click();
    }

    /**
     * Open the Risk management panel, configure the requested params, and Save.
     *
     * Supports two mutually exclusive modes — pass TP/SL (can combine both), or DC alone:
     * - `takeProfit`: enable TP toggle and enter the given amount
     * - `stopLoss`:   enable SL toggle and enter the given amount (can be combined with takeProfit)
     * - `dealCancellation`: switch to the DC tab (mobile) or DC panel (desktop), enable the
     *   DC toggle, and select the given duration chip
     *
     * Desktop flow: opens TradeParameterPopover → configures the requested field → clicks Save.
     * Mobile flow:  opens ActionSheet → selects the correct tab if needed → configures → clicks Save.
     *
     * @param params.takeProfit        - TP amount to enter (e.g. '30.00')
     * @param params.stopLoss          - SL amount to enter (e.g. '15.00')
     * @param params.dealCancellation  - DC duration chip to select (e.g. '60 min')
     */
    async setRiskManagement({
        takeProfit,
        stopLoss,
        dealCancellation,
    }: {
        takeProfit?: string;
        stopLoss?: string;
        dealCancellation?: '5 min' | '10 min' | '15 min' | '30 min' | '60 min';
    }): Promise<void> {
        if (dealCancellation) {
            const dcMinutes = dealCancellation.replace(' min', '');
            if ((await this.riskManagementField.inputValue()).trim() === `DC: ${dcMinutes} minutes`) {
                return;
            }
        }

        await this.riskManagementField.click();

        if (this.isMobile) {
            await expect(
                this.page.locator('.risk-management__picker'),
                'Risk management ActionSheet should open on mobile'
            ).toBeVisible();

            if (dealCancellation) {
                await this.dcTabMobile.click();
                const isPressed = (await this.dcToggleMobile.getAttribute('aria-pressed')) === 'true';
                if (!isPressed) {
                    await this.dcToggleMobile.click();
                }
                await this.selectWheelPickerOption('.deal-cancellation__wheel-picker', dealCancellation);
                await this.saveMobileSheet(this.riskManagementSheet);
            } else {
                await this.tpSlTabMobile.click();
                if (takeProfit !== undefined) {
                    const isPressed = (await this.tpToggleMobile.getAttribute('aria-pressed')) === 'true';
                    if (!isPressed) {
                        await this.tpToggleMobile.click();
                    }
                    await expect(this.tpInputMobile, 'TP input should appear after enabling toggle').toBeVisible();
                    await this.tpInputMobile.clear();
                    await this.tpInputMobile.pressSequentially(takeProfit, { delay: 70 });
                    await expect(this.tpInputMobile, `TP input should show "${takeProfit}"`).toHaveValue(takeProfit);
                    await this.tpInputMobile.press('Tab');
                    // Wait for the proposal round-trip to populate min/max — the hint only renders
                    // numeric values after is_api_response_received_ref is set to true. This replaces
                    // a fixed timeout and ties progress to actual app readiness.
                    await expect(
                        this.tpAcceptableRangeHint,
                        'TP acceptable range hint should contain a numeric range'
                    ).toContainText(/\d/);
                }
                if (stopLoss !== undefined) {
                    const isPressed = (await this.slToggleMobile.getAttribute('aria-pressed')) === 'true';
                    if (!isPressed) {
                        await this.slToggleMobile.click();
                    }
                    await expect(this.slInputMobile, 'SL input should appear after enabling toggle').toBeVisible();
                    await this.slInputMobile.clear();
                    await this.slInputMobile.pressSequentially(stopLoss, { delay: 70 });
                    await expect(this.slInputMobile, `SL input should show "${stopLoss}"`).toHaveValue(stopLoss);
                    await this.slInputMobile.press('Tab');
                    // Same as TP: wait for numeric range to confirm proposal round-trip completed.
                    await expect(
                        this.slAcceptableRangeHint,
                        'SL acceptable range hint should contain a numeric range'
                    ).toContainText(/\d/);
                }
                // Mobile's Save button (take-profit-and-stop-loss-container.tsx) has no `disabled`
                // state — it's always clickable, but `onSave` silently no-ops if the proposal ref for
                // TP/SL hasn't resolved yet. That ref flips independently of the "Acceptable range"
                // hint (which can already show digits left over from an earlier keystroke's response
                // while the latest one is still in flight), so a single click can land in that gap.
                // Retry the click until the sheet actually closes instead of trusting one attempt.
                await expect(async () => {
                    await this.riskManagementSaveButton('tp_sl').click();
                    await expect(
                        this.page.locator('.risk-management__picker'),
                        'Risk management ActionSheet should close after saving'
                    ).not.toBeVisible({ timeout: 3_000 });
                }).toPass({ timeout: 20_000 });
            }

            if (dealCancellation) {
                await expect(
                    this.page.locator('.risk-management__picker'),
                    'Risk management ActionSheet should close after saving'
                ).not.toBeVisible();
            }
        } else {
            await expect(
                this.page.locator('.risk-management-popover__main'),
                'Risk management popover should open on desktop'
            ).toBeVisible();

            if (dealCancellation) {
                await this.dcTabDesktop.click();
                const isPressed = (await this.dcToggleDesktop.getAttribute('aria-pressed')) === 'true';
                if (!isPressed) {
                    await this.dcToggleDesktop.click();
                }
                await this.dcChipDesktop(dealCancellation).click();
                await expect(
                    this.riskManagementSaveButton('dc'),
                    'Deal cancellation Save should enable after changing the draft'
                ).toBeEnabled();
                await this.riskManagementSaveButton('dc').click();
            } else {
                await this.tpSlTabDesktop.click();
                if (takeProfit !== undefined) {
                    const isPressed = (await this.tpToggleDesktop.getAttribute('aria-pressed')) === 'true';
                    if (!isPressed) {
                        await this.tpToggleDesktop.click();
                    }
                    await expect(this.tpInputDesktop, 'TP input should be enabled after toggle').toBeEnabled();
                    await this.tpInputDesktop.clear();
                    await this.tpInputDesktop.pressSequentially(takeProfit, { delay: 70 });
                    await expect(this.tpInputDesktop, `TP input should show "${takeProfit}"`).toHaveValue(takeProfit);
                }
                if (stopLoss !== undefined) {
                    const isPressed = (await this.slToggleDesktop.getAttribute('aria-pressed')) === 'true';
                    if (!isPressed) {
                        await this.slToggleDesktop.click();
                    }
                    await expect(this.slInputDesktop, 'SL input should be enabled after toggle').toBeEnabled();
                    await this.slInputDesktop.clear();
                    await this.slInputDesktop.pressSequentially(stopLoss, { delay: 70 });
                    await expect(this.slInputDesktop, `SL input should show "${stopLoss}"`).toHaveValue(stopLoss);
                }
                await this.riskManagementSaveButton('tp_sl').click();
            }

            await expect(
                this.page.locator('.risk-management-popover__main'),
                'Risk management popover should close after saving'
            ).not.toBeVisible();
        }

        // After the panel closes, verify the Risk management field reflects the saved value.
        // Amounts prefix the currency symbol (risk-management.tsx getRiskManagementText):
        // both: "TP: $10 / SL: $9"; only one: "TP: $10" or "SL: $10".
        if (takeProfit !== undefined && stopLoss !== undefined) {
            await expect(
                this.riskManagementField,
                `Risk management field should show "TP: $${takeProfit} / SL: $${stopLoss}" after saving`
            ).toHaveValue(`TP: $${takeProfit} / SL: $${stopLoss}`);
        } else if (takeProfit !== undefined) {
            await expect(
                this.riskManagementField,
                `Risk management field should show "TP: $${takeProfit}" after saving`
            ).toHaveValue(`TP: $${takeProfit}`);
        } else if (stopLoss !== undefined) {
            await expect(
                this.riskManagementField,
                `Risk management field should show "SL: $${stopLoss}" after saving`
            ).toHaveValue(`SL: $${stopLoss}`);
        } else if (dealCancellation) {
            const dcMinutes = dealCancellation.replace(' min', '');
            await expect(
                this.riskManagementField,
                `Risk management field should show "DC: ${dcMinutes} minutes" after saving deal cancellation`
            ).toHaveValue(`DC: ${dcMinutes} minutes`);
        }
    }

    /**
     * Read the Stop out amount pre-buy, from the MultipliersInformation rows (desktop: trade-page
     * landing panel; mobile: Stake action sheet details rows — stake-details.tsx). Reopening the
     * sheet is a no-op: the draft already equals the committed stake, so header Save stays disabled
     * (`stake-input.tsx` dirty gate). Dismiss with Close. The values are populated from the proposal
     * response, which can lag under load; `not.toBeEmpty()` auto-retries, so a generous budget is used
     * instead of the default window.
     *
     * The "Stop out level" row is asserted to be present here but its value is not captured — it is
     * not asserted on the closed contract details page. Commission is not present on the trade panel;
     * the contract details page renders it from the API, so it is read there instead.
     */
    private async readStopOut(): Promise<{ stopOut: string }> {
        if (this.isMobile) {
            await this.stakeField.click();
            await expect(this.stakeContainer, 'Stake action sheet should open').toBeVisible();
        }

        // Stop out and Stop out level are populated from the proposal response, which can lag under
        // load. not.toBeEmpty() auto-retries, so give it a generous budget instead of the default window.
        await expect(this.stopOutValue, 'Stop out value should be visible and non-empty').not.toBeEmpty({
            timeout: 15_000,
        });
        await expect(this.stopOutLevelValue, 'Stop out level should be visible and non-empty').not.toBeEmpty({
            timeout: 15_000,
        });
        // Trade params render `$20.00`; closed mobile Order Details still uses Money (`-20.00 USD`).
        // Keep the numeric amount so `toContainText` matches either surface.
        const stopOut = (await this.stopOutValue.innerText()).replace(/,/g, '').replace(/[^\d.]/g, '');

        if (this.isMobile) {
            await this.stakeCloseButton.click();
            await expect(this.stakeContainer, 'Stake action sheet should dismiss after closing').not.toBeVisible();
        }
        return { stopOut };
    }

    // ============================================
    // FULL FLOW METHODS
    // ============================================

    /**
     * Flow 9.7 — buy an Up Multipliers contract with Deal Cancellation, then cancel it.
     *
     * Cancellation is a structural exception vs `buyUpAndVerify`: the contract is cancelled from
     * details (not closed from Positions), and Reports is skipped because there is no P/L sell row.
     */
    async buyUpAndVerifyWithDC({
        accountType,
        market,
        multiplier,
        stake,
        currency,
        dealCancellation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        multiplier: string;
        stake: string;
        currency: string;
        dealCancellation: '5 min' | '10 min' | '15 min' | '30 min' | '60 min';
    }): Promise<void> {
        // 0. Trade on the account type requested by the test — the account created in beforeAll is real by default.
        await this.switchToAccountType(accountType);

        // 1. Configure Deal Cancellation and buy
        await this.selectMarketAndTradeType(market, 'Multipliers');
        await this.clickUpDownOption('Up');
        await this.setStake(stake);
        await this.setMultiplier(multiplier);
        await this.setRiskManagement({ dealCancellation });
        await expect(
            this.purchaseButton,
            'Buy button should show Total cost while Deal Cancellation is active'
        ).toContainText('Total cost');
        await expect(
            this.multipliersTotalCost,
            'Total cost should show a numeric amount before buying'
        ).not.toBeEmpty();
        const totalCost = parseFloat(
            (await this.multipliersTotalCost.innerText()).replace(/,/g, '').replace(/[^\d.]/g, '')
        ).toFixed(2);
        const { stopOut } = await this.readStopOut();
        const balanceBefore = await this.getBalance();
        const buyDate = this.getCurrentDate();
        await this.clickMultipliersBuy();

        // 2. Verify contract card appears in Positions and balance deducted
        await this.positionsPage.verifyOpenPositionsVisible();
        await this.verifyBalanceAfterContractPurchase(balanceBefore, totalCost);
        await this.positionsPage.verifyMultipliersContractCardDetails(market, 'Multipliers Up', currency, totalCost, {
            dealCancellation,
        });
        await this.positionsPage.verifyDesktopDealCancellationCancelOnOpenCard();

        // 3. Capture balance before cancel
        const balanceBeforeClose = await this.getBalance();

        // 4. Open contract details — verify, cancel Deal Cancellation, then close details
        await this.goToPositions();
        await this.positionsPage.openFirstContract();
        const { buyId, entrySpot, commission } = await this.contractDetailsPage.verifyMultipliersContractDetailsPage(
            market,
            'Up',
            currency,
            stake,
            multiplier,
            buyDate,
            undefined,
            undefined,
            totalCost
        );
        await this.contractDetailsPage.verifyDealCancellationAvailable();
        await this.contractDetailsPage.cancelDealCancellationContract();
        await this.contractDetailsPage.closeContractDetails();

        // 5. Verify closed contract in the Closed tab and contract details
        await this.goToPositions();
        await this.positionsPage.clickClosedTab();
        const contractProfitLossAmount = await this.positionsPage.verifyClosedPositionsTab(
            market,
            'Multipliers Up',
            currency,
            totalCost
        );
        await this.positionsPage.openFirstContract();
        await this.contractDetailsPage.verifyClosedMultipliersContractDetailsPage(
            market,
            'Up',
            currency,
            stake,
            multiplier,
            buyId,
            buyDate,
            contractProfitLossAmount,
            entrySpot,
            stopOut,
            commission,
            undefined,
            undefined,
            totalCost
        );
        await this.contractDetailsPage.closeContractDetails();

        // 6. Verify final balance reflects contract P/L
        const balanceAfterClose = await this.getBalance();
        await this.verifyBalanceAfterContractClose(
            balanceBeforeClose,
            totalCost,
            contractProfitLossAmount,
            balanceAfterClose
        );
    }

    /**
     * Flow 9.8 — buy a Down Multipliers contract with Deal Cancellation, then cancel it.
     *
     * Cancellation is a structural exception vs `buyDownAndVerify`: the contract is cancelled from
     * details (not closed from Positions), and Reports is skipped because there is no P/L sell row.
     */
    async buyDownAndVerifyWithDC({
        accountType,
        market,
        multiplier,
        stake,
        currency,
        dealCancellation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        multiplier: string;
        stake: string;
        currency: string;
        dealCancellation: '5 min' | '10 min' | '15 min' | '30 min' | '60 min';
    }): Promise<void> {
        // 0. Trade on the account type requested by the test — the account created in beforeAll is real by default.
        await this.switchToAccountType(accountType);

        // 1. Configure Deal Cancellation and buy
        await this.selectMarketAndTradeType(market, 'Multipliers');
        await this.clickUpDownOption('Down');
        await this.setStake(stake);
        await this.setMultiplier(multiplier);
        await this.setRiskManagement({ dealCancellation });
        await expect(
            this.purchaseButton,
            'Buy button should show Total cost while Deal Cancellation is active'
        ).toContainText('Total cost');
        await expect(
            this.multipliersTotalCost,
            'Total cost should show a numeric amount before buying'
        ).not.toBeEmpty();
        const totalCost = parseFloat(
            (await this.multipliersTotalCost.innerText()).replace(/,/g, '').replace(/[^\d.]/g, '')
        ).toFixed(2);
        const { stopOut } = await this.readStopOut();
        const balanceBefore = await this.getBalance();
        const buyDate = this.getCurrentDate();
        await this.clickMultipliersBuy();

        // 2. Verify contract card appears in Positions and balance deducted
        await this.positionsPage.verifyOpenPositionsVisible();
        await this.verifyBalanceAfterContractPurchase(balanceBefore, totalCost);
        await this.positionsPage.verifyMultipliersContractCardDetails(market, 'Multipliers Down', currency, totalCost, {
            dealCancellation,
        });
        await this.positionsPage.verifyDesktopDealCancellationCancelOnOpenCard();

        // 3. Capture balance before cancel
        const balanceBeforeClose = await this.getBalance();

        // 4. Open contract details — verify, cancel Deal Cancellation, then close details
        await this.goToPositions();
        await this.positionsPage.openFirstContract();
        const { buyId, entrySpot, commission } = await this.contractDetailsPage.verifyMultipliersContractDetailsPage(
            market,
            'Down',
            currency,
            stake,
            multiplier,
            buyDate,
            undefined,
            undefined,
            totalCost
        );
        await this.contractDetailsPage.verifyDealCancellationAvailable();
        await this.contractDetailsPage.cancelDealCancellationContract();
        await this.contractDetailsPage.closeContractDetails();

        // 5. Verify closed contract in the Closed tab and contract details
        await this.goToPositions();
        await this.positionsPage.clickClosedTab();
        const contractProfitLossAmount = await this.positionsPage.verifyClosedPositionsTab(
            market,
            'Multipliers Down',
            currency,
            totalCost
        );
        await this.positionsPage.openFirstContract();
        await this.contractDetailsPage.verifyClosedMultipliersContractDetailsPage(
            market,
            'Down',
            currency,
            stake,
            multiplier,
            buyId,
            buyDate,
            contractProfitLossAmount,
            entrySpot,
            stopOut,
            commission,
            undefined,
            undefined,
            totalCost
        );
        await this.contractDetailsPage.closeContractDetails();

        // 6. Verify final balance reflects contract P/L
        const balanceAfterClose = await this.getBalance();
        await this.verifyBalanceAfterContractClose(
            balanceBeforeClose,
            totalCost,
            contractProfitLossAmount,
            balanceAfterClose
        );
    }

    /**
     * Full Multipliers Up contract flow: configure → buy → verify positions, reports,
     * contract details, balance, and closed contract.
     *
     * Implements Flow 9.1 (18 steps): Multipliers has no Duration param and no Barrier.
     * The contract details page shows a Multiplier value (not Duration/Barrier).
     *
     * @param accountType - Account to trade on: 'real' or 'demo'
     * @param market     - Market symbol to select (e.g. 'Jump 10 Index')
     * @param multiplier - Multiplier value to select (e.g. 'x200')
     * @param stake      - Stake amount as a string (e.g. '20.00')
     * @param currency   - Currency code (e.g. 'USD')
     */
    async buyUpAndVerify({
        accountType,
        market,
        multiplier,
        stake,
        currency,
        riskManagement,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        multiplier: string;
        stake: string;
        currency: string;
        riskManagement?: {
            takeProfit?: string;
            stopLoss?: string;
            dealCancellation?: '5 min' | '10 min' | '15 min' | '30 min' | '60 min';
        };
    }): Promise<void> {
        // 0. Trade on the account type requested by the test — the account created in beforeAll is real by default.
        await this.switchToAccountType(accountType);

        // 1. Configure and buy
        await this.selectMarketAndTradeType(market, 'Multipliers');
        await this.clickUpDownOption('Up');
        await this.setMultiplier(multiplier);
        await this.setStake(stake);
        if (riskManagement) {
            await this.setRiskManagement(riskManagement);
        }
        const { stopOut } = await this.readStopOut();
        const balanceBefore = await this.getBalance();
        const buyDate = this.getCurrentDate();
        await this.clickMultipliersBuy();

        // 2. Verify contract card appears in Positions and balance deducted
        await this.positionsPage.verifyOpenPositionsVisible();
        await this.verifyBalanceAfterContractPurchase(balanceBefore, stake);
        await this.positionsPage.verifyMultipliersContractCardDetails(
            market,
            'Multipliers Up',
            currency,
            stake,
            riskManagement
        );

        // 3. Capture balance, verify open position in Reports
        const balanceBeforeClose = await this.getBalance();
        await this.goToReports();
        await this.reportsPage.verifyReportsPage();
        await this.reportsPage.verifyOpenPositionsInReportsForMultipliers(
            currency,
            stake,
            multiplier,
            riskManagement?.takeProfit,
            riskManagement?.stopLoss
        );
        await this.reportsPage.closeReports();

        // 4. Open contract details — verify and extract buyId + commission from the audit grid
        await this.goToPositions();
        await this.positionsPage.openFirstContract();
        const { buyId, entrySpot, commission } = await this.contractDetailsPage.verifyMultipliersContractDetailsPage(
            market,
            'Up',
            currency,
            stake,
            multiplier,
            buyDate,
            riskManagement?.takeProfit,
            riskManagement?.stopLoss
        );
        await this.contractDetailsPage.closeContractDetails();
        await this.goToPositions();
        await this.positionsPage.closeFirstContract();

        // 5. Verify closed contract in the Closed tab and contract details
        await this.positionsPage.clickClosedTab();
        const contractProfitLossAmount = await this.positionsPage.verifyClosedPositionsTab(
            market,
            'Multipliers Up',
            currency,
            stake
        );
        await this.positionsPage.openFirstContract();
        const sellId = await this.contractDetailsPage.verifyClosedMultipliersContractDetailsPage(
            market,
            'Up',
            currency,
            stake,
            multiplier,
            buyId,
            buyDate,
            contractProfitLossAmount,
            entrySpot,
            stopOut,
            commission,
            riskManagement?.takeProfit,
            riskManagement?.stopLoss
        );
        await this.contractDetailsPage.closeContractDetails();

        // 6. Verify final balance reflects contract P/L
        const balanceAfterClose = await this.getBalance();
        await this.verifyBalanceAfterContractClose(
            balanceBeforeClose,
            stake,
            contractProfitLossAmount,
            balanceAfterClose
        );

        // 7. Verify closed contract appears in Reports > Trade table and Statement
        await this.goToReports();
        await this.reportsPage.verifyClosedContractInReports(
            buyId,
            sellId,
            currency,
            stake,
            buyDate,
            contractProfitLossAmount,
            balanceAfterClose,
            balanceBeforeClose
        );
        await this.reportsPage.closeReports();
    }

    /**
     * Full Multipliers Down contract flow: configure → buy → verify positions, reports,
     * contract details, balance, and closed contract.
     *
     * Implements Flow 9.2 (15 steps): same structure as buyUpAndVerify but with Down direction.
     *
     * @param accountType - Account to trade on: 'real' or 'demo'
     * @param market     - Market symbol to select (e.g. 'Jump 10 Index')
     * @param multiplier - Multiplier value to select (e.g. 'x300')
     * @param stake      - Stake amount as a string (e.g. '21.00')
     * @param currency   - Currency code (e.g. 'USD')
     */
    async buyDownAndVerify({
        accountType,
        market,
        multiplier,
        stake,
        currency,
        riskManagement,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        multiplier: string;
        stake: string;
        currency: string;
        riskManagement?: {
            takeProfit?: string;
            stopLoss?: string;
            dealCancellation?: '5 min' | '10 min' | '15 min' | '30 min' | '60 min';
        };
    }): Promise<void> {
        // 0. Trade on the account type requested by the test — the account created in beforeAll is real by default.
        await this.switchToAccountType(accountType);

        // 1. Configure and buy
        await this.selectMarketAndTradeType(market, 'Multipliers');
        await this.clickUpDownOption('Down');
        await this.setMultiplier(multiplier);
        await this.setStake(stake);
        if (riskManagement) {
            await this.setRiskManagement(riskManagement);
        }
        const { stopOut } = await this.readStopOut();
        const balanceBefore = await this.getBalance();
        const buyDate = this.getCurrentDate();
        await this.clickMultipliersBuy();

        // 2. Verify contract card appears in Positions and balance deducted
        await this.positionsPage.verifyOpenPositionsVisible();
        await this.verifyBalanceAfterContractPurchase(balanceBefore, stake);
        await this.positionsPage.verifyMultipliersContractCardDetails(
            market,
            'Multipliers Down',
            currency,
            stake,
            riskManagement
        );

        // 3. Capture balance, verify open position in Reports
        const balanceBeforeClose = await this.getBalance();
        await this.goToReports();
        await this.reportsPage.verifyReportsPage();
        await this.reportsPage.verifyOpenPositionsInReportsForMultipliers(
            currency,
            stake,
            multiplier,
            riskManagement?.takeProfit,
            riskManagement?.stopLoss
        );
        await this.reportsPage.closeReports();

        // 4. Open contract details — verify and extract buyId + commission from the audit grid
        await this.goToPositions();
        await this.positionsPage.openFirstContract();
        const { buyId, entrySpot, commission } = await this.contractDetailsPage.verifyMultipliersContractDetailsPage(
            market,
            'Down',
            currency,
            stake,
            multiplier,
            buyDate,
            riskManagement?.takeProfit,
            riskManagement?.stopLoss
        );
        await this.contractDetailsPage.closeContractDetails();
        await this.goToPositions();
        await this.positionsPage.closeFirstContract();

        // 5. Verify closed contract in the Closed tab and contract details
        await this.positionsPage.clickClosedTab();
        const contractProfitLossAmount = await this.positionsPage.verifyClosedPositionsTab(
            market,
            'Multipliers Down',
            currency,
            stake
        );
        await this.positionsPage.openFirstContract();
        const sellId = await this.contractDetailsPage.verifyClosedMultipliersContractDetailsPage(
            market,
            'Down',
            currency,
            stake,
            multiplier,
            buyId,
            buyDate,
            contractProfitLossAmount,
            entrySpot,
            stopOut,
            commission,
            riskManagement?.takeProfit,
            riskManagement?.stopLoss
        );
        await this.contractDetailsPage.closeContractDetails();

        // 6. Verify final balance reflects contract P/L
        const balanceAfterClose = await this.getBalance();
        await this.verifyBalanceAfterContractClose(
            balanceBeforeClose,
            stake,
            contractProfitLossAmount,
            balanceAfterClose
        );

        // 7. Verify closed contract appears in Reports > Trade table and Statement
        await this.goToReports();
        await this.reportsPage.verifyClosedContractInReports(
            buyId,
            sellId,
            currency,
            stake,
            buyDate,
            contractProfitLossAmount,
            balanceAfterClose,
            balanceBeforeClose
        );
        await this.reportsPage.closeReports();
    }
}
