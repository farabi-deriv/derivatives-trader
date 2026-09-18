import { Locator, Page, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';
import { TradeBasePage } from './TradeBasePage';

/**
 * Page Object for the Positions view.
 *
 * On desktop, positions open as a flyout drawer (`dc-flyout`) alongside the trade form.
 * On mobile, positions are a dedicated bottom-nav page.
 *
 * @example
 * ```typescript
 * test('VERIFY open position appears after buy', async ({ positionsPage }) => {
 *     await positionsPage.goToPositions();
 *     await positionsPage.verifyOpenPositionsVisible();
 * });
 * ```
 */
export class PositionsPage extends TradeBasePage {
    // ============================================
    // LOCATORS
    // ============================================

    /**
     * Desktop positions flyout drawer.
     * Source: positions-drawer.jsx role="dialog" class="dc-flyout dc-flyout--open"
     */
    get positionsFlyout(): Locator {
        return this.page.locator('.dc-flyout.dc-flyout--open');
    }

    /**
     * Positions flyout/page title — "Positions".
     * Desktop: #flyout-title inside dc-flyout__header
     */
    get positionsTitle(): Locator {
        return this.page.locator('#flyout-title');
    }

    /**
     * "Open" tab in the positions tab list — desktop and mobile.
     * Source: .positions-drawer-tabs__tab-bar > button role="tab" with text "Open"
     */
    get positionsOpenTab(): Locator {
        return this.page.getByRole('tab', { name: 'Open' });
    }

    /**
     * "Closed" tab in the positions tab list — desktop and mobile.
     * Source: .positions-drawer-tabs__tab-bar > button role="tab" with text "Closed"
     */
    get positionsClosedTab(): Locator {
        return this.page.getByRole('tab', { name: 'Closed' });
    }

    /**
     * First contract card in the positions list — both desktop and mobile.
     * Source: a.contract-card[data-testid="dt_contract_card"]
     */
    get firstContractCard(): Locator {
        return this.page.getByTestId('dt_contract_card').first();
    }

    /**
     * Position count badge on the sidebar Positions button — desktop only.
     * Source: sidebar__item-badge span inside dt_sidebar_positions button.
     * Shows the number of open positions (e.g. "1").
     */
    get sidebarPositionsBadge(): Locator {
        return this.sidebarPositionsButton.locator('.sidebar__item-badge');
    }

    /**
     * Position count badge on the bottom nav Positions tab — mobile only.
     * Source: badge__position-top-sm <p> inside .bottom-nav-item--positions.
     * Shows the number of open positions (e.g. "1").
     */
    get bottomNavPositionsBadge(): Locator {
        return this.page.locator('.bottom-nav-item--positions .bottom-nav-item__position-badge p');
    }

    /**
     * Symbol name on the first contract card.
     * Source: contract-card__details > p.symbol
     */
    get contractCardMarket(): Locator {
        return this.firstContractCard.locator('.symbol');
    }

    /**
     * Contract type label on the first contract card (e.g. "Rise", "Fall").
     * Source: contract-card__details > p.trade-type
     */
    get contractCardType(): Locator {
        return this.firstContractCard.locator('.trade-type');
    }

    /**
     * Automation trading icon on the first contract card — rendered when `auto_run_id` is set.
     * Source: contract-card.tsx — `IcAutomationTrading` (20×16 svg beside the market name).
     */
    get contractCardAutomationIcon(): Locator {
        return this.firstContractCard
            .locator('.contract-card__details')
            .first()
            .locator('svg[width="20"][height="16"]');
    }

    /**
     * Remaining time display on the contract card.
     * Source: .timer.tag > dc-remaining-time
     * Text format: "00:04:50" — live value, assert non-empty only.
     */
    get contractCardRemainingTime(): Locator {
        return this.firstContractCard.locator('.dc-remaining-time');
    }

    /**
     * Stake value on the contract card (e.g. "10.00 USD" — combined with currency).
     * Source: .contract-card__details-col > .contract-card__details > p > [data-testid="dt_span"]
     * Scoped to the details column (not the bottom profit row) to avoid matching the profit span.
     */
    get contractCardStake(): Locator {
        return this.firstContractCard.locator('.contract-card__details-col').getByTestId('dt_span');
    }

    /**
     * Profit/loss paragraph on the contract card (e.g. "-2.05 USD" or "+3.01 USD").
     * The sign is a raw text node; the amount lives in a nested dt_span.
     * Source: p.profit (full paragraph — contains sign + dt_span)
     * Live tick value — assert non-empty only.
     */
    get contractCardProfit(): Locator {
        return this.firstContractCard.locator('p.profit');
    }

    /**
     * Status timer tag on the first contract card — tick progress (e.g. "19 ticks") or remaining time.
     * Source: ContractCardStatusTimer inside `.timer.tag`.
     */
    get contractCardStatusTimer(): Locator {
        return this.firstContractCard.locator('.timer.tag');
    }

    /**
     * Close/sell button on the first contract card — desktop only.
     * Source: .contract-card__sell-btn (labelled "Close")
     */
    get contractCardCloseButton(): Locator {
        return this.firstContractCard.locator('.contract-card__sell-btn');
    }

    /**
     * Deal Cancellation Cancel button on the first open-position card — desktop only.
     * Source: contract-card.tsx — `.contract-card__cancel-btn` (issue #899).
     * Accessible name includes the DC countdown; class is the stable selector.
     */
    get contractCardCancelButton(): Locator {
        return this.firstContractCard.locator('.contract-card__cancel-btn');
    }

    /**
     * Desktop flyout only — assert Cancel is on the open-position card while DC is active (issue #899).
     * Covered by trade Flow 9.7/9.8 via `buyUpAndVerifyWithDC` / `buyDownAndVerifyWithDC`.
     */
    async verifyDesktopDealCancellationCancelOnOpenCard(): Promise<void> {
        if (this.isMobile) return;

        await expect(
            this.contractCardCancelButton,
            'Desktop open-position card should show Cancel while Deal Cancellation is active (issue #899)'
        ).toBeVisible();
    }

    /**
     * Close button revealed after swiping the first contract card left — mobile only.
     * Source: .contract-card-wrapper .buttons > button (labelled "Close")
     * The card must have class "show-buttons" before this button is interactable.
     */
    get mobileContractCardCloseButton(): Locator {
        return this.page.locator('.contract-card-wrapper').first().locator('.buttons button');
    }

    /**
     * Empty state message shown when there are no open positions.
     * Desktop: .portfolio-empty__text inside the flyout
     * Mobile: "No open positions" paragraph inside the Open tabpanel
     */
    get noOpenPositionsText(): Locator {
        return this.isMobile
            ? this.page.getByRole('tabpanel', { name: 'Open' }).getByText('No open positions')
            : this.page.locator('.portfolio-empty__text');
    }

    /**
     * Empty state icon for positions (both open and closed tabs).
     * Source: data-testid="dt_empty_state_icon"
     */
    get emptyStateIcon(): Locator {
        return this.page.getByTestId('dt_empty_state_icon');
    }

    /**
     * All open contract cards in positions.
     * Source: data-testid="dt_contract_card"
     */
    get contractCards(): Locator {
        return this.page.getByTestId('dt_contract_card');
    }

    /**
     * Date section headers on the mobile Closed tab (e.g. "03 Sep 2026").
     * Source: .contract-cards-section__title
     */
    get closedPositionsDateHeader(): Locator {
        return this.page.locator('.contract-cards-section__title');
    }

    /**
     * Trade types filter chip on Open positions (mobile).
     */
    get tradeTypeFilterChip(): Locator {
        return this.page.locator('.filter__chip').filter({ hasText: 'Trade types' });
    }

    /**
     * Time filter chip on Closed positions (mobile).
     */
    get timeFilterChip(): Locator {
        return this.page.locator('.filter__chip').first();
    }

    /**
     * Action sheet title for filters.
     */
    get filterActionSheetHeader(): Locator {
        return this.page.locator('.action-sheet__header, .filter__item__wrapper');
    }

    /**
     * Apply button inside filter action sheet.
     */
    get filterActionSheetApplyButton(): Locator {
        return this.page.getByRole('button', { name: 'Apply' });
    }

    /**
     * Clear All button inside filter action sheet.
     */
    get filterActionSheetClearAllButton(): Locator {
        return this.page.getByRole('button', { name: 'Clear All' });
    }

    /**
     * Reset button inside time filter action sheet.
     */
    get timeFilterResetButton(): Locator {
        return this.page.getByRole('button', { name: 'Reset' }).or(this.page.getByText('All time'));
    }

    /**
     * Cancel button revealed after swiping multiplier card left (mobile).
     * Scoped to the specific contract card wrapper that contains a Cancel button.
     */
    get mobileContractCardCancelButton(): Locator {
        return this.page
            .locator('.contract-card-wrapper')
            .filter({
                has: this.page.locator('.buttons button.cancel-button, .buttons button:has-text("Cancel")'),
            })
            .first()
            .locator('.buttons button.cancel-button, .buttons button:has-text("Cancel")')
            .first();
    }

    /**
     * "Closed" status tag on the first contract card in the Closed tab.
     * Desktop only — Source: .status.tag > p.custom (text "Closed")
     */
    get closedContractStatusTag(): Locator {
        return this.firstContractCard.locator('.status.tag p.custom');
    }

    /**
     * Risk management badge label on the first open contract card.
     * Shows "TP", "SL", "DC", or a combined pill when multiple are set.
     * Source: .risk-management.tag p.custom inside .tag__wrapper
     */
    get contractCardRiskTag(): Locator {
        return this.firstContractCard.locator('.risk-management.tag p.custom');
    }

    /**
     * First closed contract link card — mobile Closed tab only.
     * The Closed tab on mobile renders <a> link cards (not dt_contract_card).
     * Source: tabpanel[name="Closed"] > a (first link)
     */
    get firstMobileClosedCard(): Locator {
        return this.page.getByRole('tabpanel', { name: 'Closed' }).getByRole('link').first();
    }

    /**
     * Trade type label on the first mobile closed card (e.g. "Even", "Rise").
     * Source: p.trade-type inside the Closed tabpanel link card — same class as desktop dt_contract_card.
     */
    get mobileClosedCardTradeType(): Locator {
        return this.firstMobileClosedCard.locator('.trade-type');
    }

    /**
     * "Closed" status paragraph inside the first mobile closed card.
     * Source: paragraph with text "Closed" inside the link card
     */
    get mobileClosedCardStatusText(): Locator {
        return this.firstMobileClosedCard.getByText('Closed', { exact: true });
    }

    /**
     * Profit/loss paragraph (last paragraph) inside the first mobile closed card.
     * e.g. "-0.75 USD" or "+1.35 USD"
     */
    get mobileClosedCardProfit(): Locator {
        return this.firstMobileClosedCard.locator('p').last();
    }

    /**
     * Footer open position count — desktop only.
     * Source: positions-drawer-footer.jsx class="positions-drawer-footer--count"
     * Text pattern: "N open position(s)"
     */
    get footerPositionCount(): Locator {
        return this.page.locator('.positions-drawer-footer--count');
    }

    /**
     * Footer Total P/L label — desktop only.
     * Source: positions-drawer-footer.jsx class="positions-drawer-footer--total"
     * Live value — assert presence only.
     */
    get footerTotalPL(): Locator {
        return this.page.locator('.positions-drawer-footer--total');
    }

    /**
     * Mobile-only total profit/loss summary above the positions list.
     * Source: TotalProfitLoss component — data-testid="dt_total_profit_loss"
     */
    get mobileTotalProfitLoss(): Locator {
        return this.page.getByTestId('dt_total_profit_loss');
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Close the first open contract and verify the Open tab reaches the empty state.
     * Desktop clicks the inline Close button; mobile force-clicks the hidden close button.
     */
    async closeFirstContract(): Promise<void> {
        if (this.isMobile) {
            await expect(this.mobileContractCardCloseButton, 'Mobile close button should be attached').toBeAttached({
                timeout: 60_000,
            });
            await this.mobileContractCardCloseButton.click({ force: true });
            await this.pollUntilContractClosed(this.mobileContractCardCloseButton);
        } else {
            // The close button can be slow to enable under staging load; pollUntilContractClosed retries the click.
            await expect(this.contractCardCloseButton, 'Close button should be visible').toBeVisible({
                timeout: 60_000,
            });
            await this.contractCardCloseButton.click().catch(() => {});
            await this.pollUntilContractClosed(this.contractCardCloseButton);
            // The footer is hidden at 0 positions — assert the empty state instead.
            await expect(this.noOpenPositionsText, 'Open tab should show the empty state').toBeVisible();
            await expect(this.footerTotalPL, 'Footer should be hidden at 0 positions').toBeHidden();
        }
    }

    /**
     * Close every contract still open in the Positions Open tab.
     * Accumulators keep Initial stake / Growth rate disabled while an open contract exists on the symbol.
     */
    async closeAllOpenContracts(): Promise<void> {
        await this.goToPositions();

        if (!this.isMobile) {
            await expect(this.positionsFlyout, 'Positions flyout should be open').toBeVisible();
        }

        await expect(this.positionsOpenTab, 'Open tab should be visible').toBeVisible();
        if ((await this.positionsOpenTab.getAttribute('aria-selected')) !== 'true') {
            await this.positionsOpenTab.click();
        }

        for (let attempt = 0; attempt < 5; attempt++) {
            if (!(await this.firstContractCard.isVisible().catch(() => false))) {
                return;
            }
            await this.closeFirstContract();
        }

        await expect(
            this.noOpenPositionsText,
            'Open tab should show the empty state after closing all contracts'
        ).toBeVisible({ timeout: 60_000 });
    }

    /**
     * Click the "Closed" tab to switch to the closed positions list.
     */
    async clickClosedTab(): Promise<void> {
        await this.positionsClosedTab.click();
    }

    /** Empty-state copy on the mobile Open tab (Flow 3). */
    get emptyOpenPositionsDescription(): Locator {
        return this.page.getByText('Your active trades will appear here.');
    }

    /** CTA on the mobile Open tab empty state (Flow 3). */
    get startTradingButton(): Locator {
        return this.page.getByRole('button', { name: 'Start trading' });
    }

    /** Empty-state heading on the mobile Closed tab (G3). */
    get noClosedPositionsText(): Locator {
        return this.page.getByText('No closed positions');
    }

    /** Empty-state copy on the mobile Closed tab (G3). */
    get emptyClosedPositionsDescription(): Locator {
        return this.page.getByText('Your closed positions will be shown here.');
    }

    /**
     * Close any open contracts so the mobile Open tab can show the empty state.
     * Caller must already be on `/positions`.
     */
    async ensureEmptyOpenPositionsTab(): Promise<void> {
        const hasOpen = await this.firstContractCard.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasOpen) {
            await this.closeAllOpenContracts();
        }
    }

    /** Flow 3 — mobile Open tab empty state (icon, heading, description, CTA). */
    async verifyEmptyOpenPositionsState(): Promise<void> {
        await expect(this.emptyStateIcon, 'Empty state icon should be visible').toBeVisible();
        await expect(this.noOpenPositionsText, 'Empty heading should show "No open positions"').toBeVisible();
        await expect(this.emptyOpenPositionsDescription, 'Empty description should be visible').toBeVisible();
        await expect(
            this.startTradingButton,
            'Start trading button should be visible in empty open positions state'
        ).toBeVisible();
    }

    /** G3 — mobile Closed tab empty state when the account has no contract history. */
    async verifyEmptyClosedPositionsState(): Promise<void> {
        await expect(this.emptyStateIcon, 'Empty state icon should be visible on Closed tab').toBeVisible();
        await expect(this.noClosedPositionsText, 'Empty heading should show "No closed positions"').toBeVisible();
        await expect(this.emptyClosedPositionsDescription, 'Empty description should be visible').toBeVisible();
    }

    /**
     * Open the first contract in the Positions list by clicking its card.
     * Waits for the contract card to be visible before clicking.
     */
    async openFirstContract(): Promise<void> {
        await expect(
            this.firstContractCard,
            'At least one open contract card should be visible in Positions'
        ).toBeVisible();
        // The contract card re-renders on every tick, so it can detach mid-click ("element not
        // stable / detached"). Retry the click until the URL actually reaches /contract/.
        await expect(async () => {
            await this.firstContractCard.click({ timeout: 3_000 }).catch(() => {});
            await expect(this.page, 'Should navigate to /contract/ after opening the first position').toHaveURL(
                /\/contract\//,
                { timeout: 3_000 }
            );
        }).toPass({ timeout: 30_000 });
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Open the first contract on the Closed tab.
     * Desktop uses `dt_contract_card`; mobile Closed tab renders link cards instead.
     */
    async openFirstClosedContract(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.firstMobileClosedCard,
                'At least one closed contract card should be visible in Positions'
            ).toBeVisible();
            await expect(async () => {
                await this.firstMobileClosedCard.click({ timeout: 3_000 }).catch(() => {});
                await expect(
                    this.page,
                    'Should navigate to /contract/ after opening the first closed position'
                ).toHaveURL(/\/contract\//, { timeout: 3_000 });
            }).toPass({ timeout: 30_000 });
        } else {
            await this.openFirstContract();
        }
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    private async pollUntilContractClosed(closeButton: import('@playwright/test').Locator): Promise<void> {
        // The Open tab stays active after close — the card disappears and the empty state appears.
        // We poll for the empty state with a short inner timeout to allow MobX re-render to settle.
        // Retry the close on each interval; click errors (button gone or disabled) are swallowed.
        await expect
            .poll(
                async () => {
                    // Use a short inner timeout — the global expect timeout is 45s, which would
                    // block each poll interval for 45s on every miss before retrying the close.
                    try {
                        await expect(this.noOpenPositionsText).toBeVisible({ timeout: 5000 });
                        return true;
                    } catch {
                        // not visible yet — retry close only if button is still attached
                    }
                    try {
                        if (this.isMobile) {
                            await closeButton.click({ force: true });
                        } else {
                            await closeButton.click();
                        }
                    } catch {
                        // button gone or disabled — ignore
                    }
                    return false;
                },
                {
                    message: 'Open positions empty state should appear after closing the contract',
                    intervals: [1000],
                    timeout: 60_000,
                }
            )
            .toBe(true);
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Verify the first contract card shows the expected trade details.
     *
     * On desktop: also asserts the inline Close button and footer summary.
     * On mobile: there is no inline Close button; contracts are closed from the contract details page.
     *
     * @param market    - Market symbol, e.g. "Volatility 100 (1s) Index"
     * @param tradeType - Contract type, e.g. "Rise" or "Fall"
     * @param currency  - Currency code, e.g. "USD" — stake is displayed as "10.00 USD" (combined)
     * @param stake     - Stake amount as displayed, e.g. "10.00"
     * @param payout    - Not shown on the new card layout; kept for call-site compatibility.
     * Profit/loss is a live tick-by-tick value — only its presence is asserted, not its value.
     */
    async verifyContractCardDetails(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        _payout: string | null
    ): Promise<void> {
        // Market symbol and contract type
        await expect(this.contractCardMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.contractCardType, `Contract card type should be "${tradeType}"`).toHaveText(tradeType);

        // Stake — displayed as "10.00 USD" (stake + currency combined in one element)
        await expect(this.contractCardStake, `Stake should contain "${stake} ${currency}"`).toHaveText(
            `${stake} ${currency}`
        );

        // Remaining time — Multipliers contracts have no expiry, so no remaining time is shown
        const isMultipliers = tradeType.startsWith('Multipliers');
        if (!isMultipliers) {
            await expect(this.contractCardRemainingTime, 'Remaining time should have a value').not.toBeEmpty();
        }

        // Profit/loss — live tick value (sign is a text node outside dt_span), assert presence only
        await expect(this.contractCardProfit, 'Profit/loss should have a value').not.toBeEmpty();

        if (this.isMobile) {
            // Mobile has no inline close button — contract is closed from the contract details page
            await expect(
                this.mobileTotalProfitLoss,
                'Mobile total profit/loss summary should be visible'
            ).toBeVisible();
        } else {
            // Desktop: assert inline close button and drawer footer
            await expect(
                this.contractCardCloseButton,
                'Close button should be visible on the contract card'
            ).toBeVisible();
            await this.verifyPositionsFooter();
        }
    }

    /**
     * Verify the open contract card for a Multipliers position, including the risk management badge.
     * Delegates common field checks to `verifyContractCardDetails`, then additionally asserts
     * the TP / SL / DC badge label visible on the card.
     *
     * Badge text rules (mirrors the app's label logic):
     * - TP only  → "TP"
     * - SL only  → "SL"
     * - DC only  → "DC"
     * - TP + SL  → "TP/SL"
     *
     * @param market         - Market symbol, e.g. "Volatility 25 (1s) Index"
     * @param tradeType      - "Multipliers Up" or "Multipliers Down"
     * @param currency       - Currency code, e.g. "USD"
     * @param stake          - Stake amount as displayed, e.g. "10.00"
     * @param riskManagement - Optional risk management config set before purchase
     */
    async verifyMultipliersContractCardDetails(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        riskManagement?: {
            takeProfit?: string;
            stopLoss?: string;
            dealCancellation?: string;
        }
    ): Promise<void> {
        await this.verifyContractCardDetails(market, tradeType, currency, stake, null);

        if (riskManagement) {
            const { takeProfit, stopLoss, dealCancellation } = riskManagement;
            let expectedTag: string;
            if (dealCancellation) {
                expectedTag = 'DC';
            } else if (takeProfit && stopLoss) {
                expectedTag = 'TP/SL';
            } else if (takeProfit) {
                expectedTag = 'TP';
            } else if (stopLoss) {
                expectedTag = 'SL';
            } else {
                return;
            }
            await expect(this.contractCardRiskTag, `Risk management badge should show "${expectedTag}"`).toHaveText(
                expectedTag
            );
        }
    }

    /**
     * Verify the positions flyout footer — desktop only.
     * Derives the expected count from the number of contract cards in the DOM.
     * Asserts the open position count label and that Total P/L has a value.
     */
    async verifyPositionsFooter(): Promise<void> {
        const count = await this.page.getByTestId('dt_contract_card').count();
        const label = count === 1 ? '1 open position' : `${count} open positions`;
        await expect(this.footerPositionCount, `Footer should show "${label}"`).toHaveText(label);
        await expect(this.footerTotalPL.locator('span').first(), 'Footer should show "Total P/L:" label').toHaveText(
            'Total P/L:'
        );
        await expect(
            this.footerTotalPL.getByTestId('dt_span'),
            'Footer Total P/L value should be non-empty'
        ).not.toBeEmpty();
    }

    /**
     * Verify the Closed tab is selected and the first closed contract card is correct.
     * Desktop also asserts the drawer footer (count + Total P/L).
     * Mobile asserts the total profit/loss summary above the list instead.
     *
     * @param market    - Market symbol, e.g. "Volatility 100 (1s) Index"
     * @param tradeType - Contract type, e.g. "Rise" or "Fall"
     * @param currency  - Currency code, e.g. "USD"
     * @param stake     - Stake amount as displayed, e.g. "10.00"
     * @returns The profit/loss text as displayed on the closed card, e.g. "-2.05 USD"
     */
    async verifyClosedPositionsTab(
        market: string,
        tradeType: string,
        currency: string,
        stake: string
    ): Promise<string> {
        await expect(this.positionsClosedTab, 'Closed tab should be selected after switching').toHaveAttribute(
            'aria-selected',
            'true'
        );

        if (this.isMobile) {
            // Mobile Closed tab renders <a> link cards — no dt_contract_card testid
            await expect(this.firstMobileClosedCard, 'At least one closed contract card should be visible').toBeVisible(
                { timeout: 60_000 }
            );
            await expect(this.firstMobileClosedCard, `Closed card should show market "${market}"`).toContainText(
                market,
                { timeout: 60_000 }
            );
            await expect(this.mobileClosedCardTradeType, `Closed card trade type should be "${tradeType}"`).toHaveText(
                tradeType,
                { timeout: 60_000 }
            );
            await expect(
                this.firstMobileClosedCard,
                `Closed card should show stake "${stake} ${currency}"`
            ).toContainText(`${stake} ${currency}`);
            await expect(this.mobileClosedCardStatusText, 'Closed card should show "Closed" status').toBeVisible();
            await expect(this.mobileClosedCardProfit, 'Closed card profit/loss should have a value').not.toBeEmpty();
            const profitLoss = (await this.mobileClosedCardProfit.innerText()).trim();
            return profitLoss;
        }

        // Desktop — dt_contract_card structure
        await expect(this.firstContractCard, 'At least one closed contract card should be visible').toBeVisible();
        await expect(this.contractCardMarket, `Closed card market should be "${market}"`).toHaveText(market);
        await expect(this.contractCardType, `Closed card type should be "${tradeType}"`).toHaveText(tradeType);
        await expect(this.contractCardStake, `Closed card stake should be "${stake} ${currency}"`).toHaveText(
            `${stake} ${currency}`
        );
        await expect(this.closedContractStatusTag, 'Closed card should show "Closed" status tag').toHaveText('Closed');
        await expect(this.contractCardProfit, 'Closed card profit/loss should have a value').not.toBeEmpty();
        const profitLoss = (await this.contractCardProfit.innerText()).trim();

        const count = await this.page.getByTestId('dt_contract_card').count();
        const label = count === 1 ? '1 closed position' : `${count} closed positions`;
        await expect(this.footerPositionCount, `Footer should show "${label}"`).toHaveText(label);
        await expect(this.footerTotalPL.locator('span').first(), 'Footer should show "Total P/L:" label').toHaveText(
            'Total P/L:'
        );
        await expect(
            this.footerTotalPL.getByTestId('dt_span'),
            'Footer Total P/L value should be non-empty'
        ).not.toBeEmpty();

        return profitLoss;
    }

    /**
     * Verify the first open automation contract card — market, automation icon, trade type,
     * stake, live timer/profit, and Positions summary (footer on desktop, total P/L on mobile).
     *
     * @param market            - Market name as shown on the card, e.g. "Volatility 15 (1s) Index"
     * @param tradeTypeCategory - Automate trade-type category, e.g. "Accumulators" or "Rise/Fall"
     * @param currency          - Currency code, e.g. "USD"
     * @param stake             - Initial stake amount, e.g. "1" or "2.00" (formatted to two decimals on the card)
     * @param options.allowStrategyAdjustedStake - When true, assert open stake is within [initial, maxStake] instead of exact initial.
     * @param options.maxStake  - Max. stake cap from the automation panel (optional upper bound).
     */
    async verifyAutomationContractCardDetails(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        stake: string,
        options: { allowStrategyAdjustedStake?: boolean; maxStake?: string } = {}
    ): Promise<void> {
        const formattedStake = Number(stake).toFixed(2);

        await expect(this.contractCardMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(
            this.contractCardAutomationIcon,
            'Automation contract card should show the automation trading icon'
        ).toBeVisible();
        await expect(
            this.contractCardType,
            `Contract card type should match the ${tradeTypeCategory} automation trade type`
        ).toHaveText(this.automationCardTradeTypeMatcher(tradeTypeCategory));
        if (options.allowStrategyAdjustedStake) {
            await this.assertOpenAutomationStakeInRange(this.contractCardStake, stake, currency, options.maxStake);
        } else {
            await expect(this.contractCardStake, `Stake should show "${formattedStake} ${currency}"`).toHaveText(
                `${formattedStake} ${currency}`
            );
        }
        await expect(
            this.contractCardStatusTimer,
            'Status timer should show remaining time or tick progress'
        ).toBeVisible();
        await expect(this.contractCardStatusTimer, 'Status timer should have a value').not.toBeEmpty();
        await expect(this.contractCardProfit, 'Profit/loss should have a live value').not.toBeEmpty();

        if (this.isMobile) {
            await expect(
                this.mobileTotalProfitLoss,
                'Mobile total profit/loss summary should be visible'
            ).toBeVisible();
        } else {
            await expect(
                this.contractCardCloseButton,
                'Close button should be visible on the automation contract card'
            ).toBeVisible();
            await this.verifyPositionsFooter();
        }
    }

    private automationCardTradeTypeMatcher(tradeTypeCategory: string): string | RegExp {
        switch (tradeTypeCategory) {
            case 'Rise/Fall':
                return /^(Rise|Fall)$/;
            case 'Rise':
                return 'Rise';
            case 'Fall':
                return 'Fall';
            case 'Accumulators':
                return 'Accumulators';
            case 'Matches/Differs':
                return /^(Matches|Differs)$/;
            case 'Matches':
                return 'Matches';
            case 'Differs':
                return 'Differs';
            case 'Over/Under':
                return /^(Over|Under)$/;
            case 'Over':
                return 'Over';
            case 'Under':
                return 'Under';
            case 'Even/Odd':
                return /^(Even|Odd)$/;
            case 'Even':
                return 'Even';
            case 'Odd':
                return 'Odd';
            default:
                throw new Error(
                    `verifyAutomationContractCardDetails: unsupported trade type category '${tradeTypeCategory}'`
                );
        }
    }

    /**
     * Verify the Closed tab lists a settled contract from an automation run at the **initial stake**.
     * Martingale increases stake after losses, so multiple closed cards may exist — this targets the
     * one matching market, trade type, and initial stake from the spec.
     *
     * @returns The profit/loss text from the matched closed card, e.g. "+1.03 USD"
     */
    async verifyAutomationClosedPositionVisible(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        stake: string
    ): Promise<string> {
        const formattedStake = Number(stake).toFixed(2);
        const tradeTypeMatcher = this.automationCardTradeTypeMatcher(tradeTypeCategory);
        const expectedStake = `${formattedStake} ${currency}`;

        await this.goToPositions();

        if (!this.isMobile) {
            await expect(this.positionsFlyout, 'Positions flyout should be open').toBeVisible();
            await expect(this.positionsTitle, 'Positions flyout header should read "Positions"').toHaveText(
                'Positions'
            );
        }

        await this.clickClosedTab();
        await expect(this.positionsClosedTab, 'Closed tab should be selected').toHaveAttribute('aria-selected', 'true');

        const card = this.automationClosedCard(market, tradeTypeCategory, formattedStake, currency);
        await expect(
            card,
            `Closed card with market "${market}", trade type "${tradeTypeCategory}", and initial stake "${expectedStake}" should be visible`
        ).toBeVisible({ timeout: 60_000 });
        await expect(card.locator('p.symbol'), `Closed card market should be "${market}"`).toHaveText(market, {
            timeout: 60_000,
        });
        if (!this.isMobile) {
            await expect(
                card.locator('.contract-card__details').first().locator('svg[width="20"][height="16"]'),
                'Closed automation contract card should show the automation trading icon'
            ).toBeVisible();
        }
        await expect(
            card.locator('.trade-type'),
            `Closed card trade type should match ${tradeTypeCategory}`
        ).toHaveText(tradeTypeMatcher);
        await expect(
            this.automationCardStakeLocator(card, formattedStake, currency),
            `Closed card stake should be "${expectedStake}"`
        ).toHaveText(expectedStake);
        await expect(
            card.getByText('Closed', { exact: true }),
            'Closed card should show "Closed" status'
        ).toBeVisible();
        const profitLocator = card.locator('p.profit');
        await expect(profitLocator, 'Closed card profit/loss should have a value').not.toBeEmpty();
        return (await profitLocator.innerText()).trim();
    }

    /**
     * Open the closed automation contract card matching market, trade type, and initial stake.
     */
    async openAutomationClosedContract(
        market: string,
        tradeTypeCategory: string,
        stake: string,
        currency = 'USD'
    ): Promise<void> {
        const formattedStake = Number(stake).toFixed(2);
        const card = this.automationClosedCard(market, tradeTypeCategory, formattedStake, currency);
        await expect(
            card,
            `Closed card with initial stake "${formattedStake} ${currency}" should be visible`
        ).toBeVisible({ timeout: 60_000 });
        await expect(async () => {
            await card.click({ timeout: 3_000 }).catch(() => {});
            await expect(this.page, 'Should navigate to /contract/ after opening the closed position').toHaveURL(
                /\/contract\//,
                { timeout: 3_000 }
            );
        }).toPass({ timeout: 30_000 });
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Closed-tab contract cards — mobile uses tabpanel links; desktop flyout uses
     * `.positions-drawer-closed-tab` (no `tabpanel[name="Closed"]` in the drawer).
     */
    private closedPositionsCards(): Locator {
        if (this.isMobile) {
            return this.page.getByRole('tabpanel', { name: 'Closed' }).getByRole('link');
        }
        return this.positionsFlyout.locator('.positions-drawer-closed-tab a[data-testid="dt_contract_card"]');
    }

    private automationClosedCard(
        market: string,
        tradeTypeCategory: string,
        formattedStake: string,
        currency: string
    ): Locator {
        const tradeTypeMatcher = this.automationCardTradeTypeMatcher(tradeTypeCategory);
        return this.closedPositionsCards()
            .filter({ has: this.page.locator('p.symbol').filter({ hasText: market }) })
            .filter({ has: this.page.locator('.trade-type').filter({ hasText: tradeTypeMatcher }) })
            .filter({ has: this.automationCardStakeLocator(this.page, formattedStake, currency) })
            .first();
    }

    /** Stake label on a contract card — exact match (`2.00 USD` must not match `32.00 USD`). */
    private automationCardStakeLocator(scope: Locator | Page, formattedStake: string, currency: string): Locator {
        const expectedStake = `${formattedStake} ${currency}`;
        return scope
            .locator('.contract-card__details-col')
            .getByTestId('dt_span')
            .getByText(expectedStake, { exact: true });
    }

    /**
     * Open-tab contract cards scoped to the active Positions view.
     */
    private get openTabContractCards(): Locator {
        if (this.isMobile) {
            return this.page.getByRole('tabpanel', { name: 'Open' }).getByTestId('dt_contract_card');
        }
        return this.positionsFlyout.locator('.positions-drawer-open [data-testid="dt_contract_card"]');
    }

    private get positionsBadge(): Locator {
        return this.isMobile ? this.bottomNavPositionsBadge : this.sidebarPositionsBadge;
    }

    /**
     * Read the sidebar/bottom-nav open-positions badge count. Returns 0 when the badge is hidden.
     */
    async getOpenPositionsCount(): Promise<number> {
        if (!(await this.positionsBadge.isVisible().catch(() => false))) {
            return 0;
        }
        const text = (await this.positionsBadge.textContent())?.trim() ?? '';
        return text ? Number.parseInt(text, 10) : 0;
    }

    /**
     * Assert automation holds exactly one open contract — badge and Open-tab card count both read 1.
     */
    async verifyExactlyOneOpenPosition(): Promise<void> {
        await expect(
            this.positionsBadge,
            'Positions badge should show exactly one open contract while the bot is running'
        ).toHaveText('1');

        await this.goToPositions();

        if (!this.isMobile) {
            await expect(this.positionsFlyout, 'Positions flyout should be open').toBeVisible();
        }

        await expect(this.positionsOpenTab, 'Open tab should be visible').toBeVisible();
        await expect(this.positionsOpenTab, 'Open tab should be selected').toHaveAttribute('aria-selected', 'true');
        await expect(this.openTabContractCards, 'Open tab should list exactly one contract card').toHaveCount(1);
    }

    /**
     * Count contract cards on the Positions Open tab (navigates to Positions first).
     */
    async getOpenTabContractCount(): Promise<number> {
        await this.goToPositions();

        if (!this.isMobile) {
            await expect(this.positionsFlyout, 'Positions flyout should be open').toBeVisible();
        }

        await expect(this.positionsOpenTab, 'Open tab should be visible').toBeVisible();
        await expect(this.positionsOpenTab, 'Open tab should be selected').toHaveAttribute('aria-selected', 'true');
        return this.openTabContractCards.count();
    }

    /**
     * Assert no contracts remain open — badge hidden and Open tab shows the empty state.
     */
    async verifyNoOpenPositions(): Promise<void> {
        await expect(this.positionsBadge, 'Positions badge should be hidden when no contracts are open').toBeHidden();

        await this.goToPositions();

        if (!this.isMobile) {
            await expect(this.positionsFlyout, 'Positions flyout should be open').toBeVisible();
        }

        await expect(this.positionsOpenTab, 'Open tab should be visible').toBeVisible();
        await expect(this.positionsOpenTab, 'Open tab should be selected').toHaveAttribute('aria-selected', 'true');
        await expect(this.noOpenPositionsText, 'Open tab should show the empty state').toBeVisible();
    }

    /**
     * Verify the Positions view lists exactly one open position from an automation run,
     * then assert the first contract card details.
     *
     * Used by `verifyAutomateBotIsRunning()` for all automate flows (panel Flows 1–3 and
     * trade-type lifecycles 5–14). Requires badge and Open-tab count === 1, not merely ≥ 1.
     */
    async verifyAutomationOpenPositionVisible(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        stake: string,
        options: { allowStrategyAdjustedStake?: boolean; maxStake?: string } = {}
    ): Promise<void> {
        await this.verifyExactlyOneOpenPosition();

        if (!this.isMobile) {
            await expect(this.positionsTitle, 'Positions flyout header should read "Positions"').toHaveText(
                'Positions'
            );
        }

        await expect(this.positionsClosedTab, 'Closed tab should be visible').toBeVisible();
        await this.verifyAutomationContractCardDetails(market, tradeTypeCategory, currency, stake, options);
    }

    private async assertOpenAutomationStakeInRange(
        stakeLocator: Locator,
        initialStake: string,
        currency: string,
        maxStake?: string
    ): Promise<void> {
        await expect(
            stakeLocator,
            `Stake should be formatted as an amount in ${currency} while the bot is running`
        ).toHaveText(new RegExp(`^[\\d,]+\\.\\d{2} ${currency}$`));
        const stakeText = (await stakeLocator.textContent()) ?? '';
        PositionsPage.assertStrategyAdjustedStakeText(stakeText, initialStake, maxStake);
    }

    /**
     * Parse a formatted stake label and assert it stays within strategy bounds while a run is active.
     * Martingale/D'Alembert may raise the live open stake above the configured initial stake.
     */
    static assertStrategyAdjustedStakeText(stakeText: string, initialStake: string, maxStake?: string): void {
        const match = stakeText.replace(/,/g, '').match(/([\d]+\.\d{2})/);
        if (!match) {
            throw new Error(`Could not parse automation stake from "${stakeText}"`);
        }
        const amount = Number.parseFloat(match[1]);
        const initial = Number(initialStake);
        expect(amount, `Open stake ${amount} should be at least initial stake ${initial}`).toBeGreaterThanOrEqual(
            initial
        );
        if (maxStake !== undefined) {
            expect(amount, `Open stake ${amount} should not exceed max stake ${maxStake}`).toBeLessThanOrEqual(
                Number(maxStake)
            );
        }
    }

    /**
     * Verify the positions flyout/page is open and shows at least one open position.
     */
    async verifyOpenPositionsVisible(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.bottomNavPositionsBadge,
                'Bottom nav Positions badge should show 1 open position'
            ).toHaveText('1');
            await this.bottomNavPositions.click();
        } else {
            await expect(this.positionsFlyout, 'Positions flyout should be open').toBeVisible();
            await expect(this.positionsTitle, 'Positions flyout header should read "Positions"').toHaveText(
                'Positions'
            );
            await expect(this.sidebarPositionsBadge, 'Sidebar Positions badge should show 1 open position').toHaveText(
                '1'
            );
        }
        await expect(this.positionsOpenTab, 'Open tab should be visible').toBeVisible();
        await expect(this.positionsOpenTab, 'Open tab should be selected by default').toHaveAttribute(
            'aria-selected',
            'true'
        );
        await expect(this.positionsClosedTab, 'Closed tab should be visible').toBeVisible();
        await expect(
            this.firstContractCard,
            'At least one open contract card should be visible in Positions'
        ).toBeVisible();
    }

    /**
     * Open the trade type filter sheet on Open positions (mobile).
     */
    async openTradeTypeFilter(): Promise<void> {
        await this.tradeTypeFilterChip.click();
        await expect(this.filterActionSheetHeader.first(), 'Filter sheet header should open').toBeVisible();
        await expect(
            this.page.getByText('Filter by trade types'),
            'Filter sheet title should be visible'
        ).toBeVisible();
    }

    /**
     * Select the first available trade type in the filter action sheet.
     */
    async selectFirstTradeTypeFilter(): Promise<void> {
        await this.page.getByRole('checkbox').first().check();
    }

    /**
     * Apply the selected filter options.
     */
    async applyFilter(): Promise<void> {
        await this.filterActionSheetApplyButton.click();
    }

    /**
     * Clear all selected filter options and apply.
     */
    async clearFilter(): Promise<void> {
        await this.filterActionSheetClearAllButton.click();
        await this.applyFilter();
    }

    /**
     * Open the time filter action sheet on Closed positions (mobile).
     */
    async openTimeFilter(): Promise<void> {
        await this.timeFilterChip.click();
        await expect(
            this.page.getByRole('heading', { name: 'Filter by time' }),
            'Time filter sheet should open'
        ).toBeVisible();
    }

    /**
     * Select a specific radio option in the time filter (e.g. 'Today').
     */
    async selectTimeFilterOption(option: string): Promise<void> {
        await this.page.getByRole('dialog').getByText(option, { exact: true }).click();
    }

    /**
     * Reset the time filter back to default.
     */
    async resetTimeFilter(): Promise<void> {
        await this.openTimeFilter();
        await this.timeFilterResetButton.first().click();
    }
}
