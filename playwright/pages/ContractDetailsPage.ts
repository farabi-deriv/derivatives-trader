import { Locator, expect } from '@playwright/test';
import { TradeBasePage } from './TradeBasePage';

/**
 * Page Object for the Contract Details overlay (/contract/).
 *
 * Opens as a full-screen overlay when a contract card is clicked from Positions.
 * Shows the contract card (live values) and the audit grid (static values).
 *
 * @example
 * ```typescript
 * test('VERIFY contract details after buy', async ({ contractDetailsPage }) => {
 *     await contractDetailsPage.verifyContractDetailsPage(market, tradeType, currency, stake, payout, buyId);
 * });
 * ```
 */
export class ContractDetailsPage extends TradeBasePage {
    // ============================================
    // LOCATORS
    // ============================================

    /**
     * Contract details header title — viewport-aware.
     * - Desktop: `.dc-page-overlay__header-title`
     * - Mobile: `<p>` inside `.contract-details-header-v2` banner
     */
    get contractDetailsHeaderTitle(): Locator {
        return this.isMobile
            ? this.page.locator('.contract-details-header-v2 p')
            : this.page.locator('.dc-page-overlay__header-title');
    }

    /**
     * Contract details back/close button — viewport-aware.
     * - Desktop: data-testid="dt_page_overlay_header_close"
     * - Mobile: back arrow `<button class="arrow">` inside the header
     */
    get contractDetailsCloseButton(): Locator {
        return this.isMobile
            ? this.page.locator('.contract-details-header-v2 .arrow')
            : this.page.getByTestId('dt_page_overlay_header_close');
    }

    /**
     * Contract card wrapper inside the contract drawer.
     * Desktop only — `#dt_contract_drawer .dc-contract-card`.
     * Mobile uses `.contract-details` wrapper with `.contract-card` elements.
     */
    get contractCard(): Locator {
        return this.page.locator('#dt_contract_drawer .dc-contract-card');
    }

    /**
     * Mobile contract details — "Close X.XX USD" / "Close" footer button.
     * Label pattern: "Close [amount] [currency]" while valid to sell, "Close" when disabled.
     * Source: contract-details-footer.tsx — Button label `${card_labels.CLOSE} ${bid_details}`
     */
    get mobileContractDetailsCloseButton(): Locator {
        return this.page.getByRole('button', { name: /^Close/ });
    }

    /**
     * Deal Cancellation button — "Cancel" + remaining time, while the cancellation window is open.
     * - Mobile: AppV2 footer — `.contract-details-footer--container`
     * - Desktop: `#dt_contract_drawer` card footer — `button.dc-btn--cancel`
     *   (`id="dc_contract_card_{id}_cancel_button"`)
     */
    get dealCancellationButton(): Locator {
        return this.isMobile
            ? this.page
                  .locator('.contract-details-footer--container')
                  .getByRole('button', { name: /^Cancel(?:\s+\d{2}:\d{2})?$/ })
            : this.contractCard.locator('.dc-btn--cancel');
    }

    /**
     * Live mm:ss countdown inside the Cancel button.
     * Source: RemainingTime — `.dc-remaining-time` (desktop: block `div`; mobile: `span`)
     */
    get dealCancellationRemainingTime(): Locator {
        return this.dealCancellationButton.locator('.dc-remaining-time');
    }

    /**
     * Remaining Deal Cancellation time shown in the mobile contract details risk-management card.
     * Source: DealCancellationRemainingTime — data-testid="dt_deal_cancellation_badge".
     */
    get dealCancellationBadge(): Locator {
        return this.page.getByTestId('dt_deal_cancellation_badge');
    }

    /**
     * Desktop audit-grid row for Deal Cancellation.
     * Source: data-testid="dt_cancellation_label"
     */
    get dealCancellationAuditRow(): Locator {
        return this.page.getByTestId('dt_cancellation_label');
    }

    /**
     * Desktop audit-grid label inside the cancellation row.
     * Open: "Deal cancellation (active)". After cancel the live UI uses "Deal cancellation"
     * (sold before the DC window expired — contract-details.tsx getLabel).
     */
    get dealCancellationAuditLabel(): Locator {
        return this.dealCancellationAuditRow.locator('.contract-audit__label');
    }

    /**
     * Desktop audit-grid fee value inside the cancellation row (`dt_span`).
     */
    get dealCancellationAuditValue(): Locator {
        return this.dealCancellationAuditRow.getByTestId('dt_span');
    }

    /**
     * Mobile Order Details table — wraps all key-value rows.
     */
    get mobileOrderDetails(): Locator {
        return this.page.locator('.order-details__table');
    }

    /**
     * Returns the value cell of a mobile Order Details row by its label text.
     * Uses the sibling structure: each row has two `.order-details__table-row-cell` divs.
     *
     * @param label - Exact label text, e.g. "Reference ID", "Duration", "Barrier", "Stake"
     */
    mobileOrderDetailsValue(label: string): Locator {
        return this.page
            .locator('.order-details__table-row', {
                has: this.page.locator('.order-details__table-row-cell', { hasText: label }),
            })
            .locator('.order-details__table-row-cell')
            .last();
    }

    /**
     * Mobile contract details — market name shown on the contract card.
     * Source: `.symbol` text paragraph
     */
    get mobileContractMarket(): Locator {
        return this.page.locator('.contract-details .symbol');
    }

    /**
     * Mobile contract details — trade type (e.g. "Rise", "Fall").
     * Source: `.trade-type` text paragraph
     */
    get mobileContractTradeType(): Locator {
        return this.page.locator('.contract-details .trade-type');
    }

    /**
     * Mobile contract details — profit/loss (live value).
     * Source: `.profit` paragraph
     */
    get mobileContractProfit(): Locator {
        return this.page.locator('.contract-details .profit');
    }

    /**
     * Mobile contract card — stake amount shown as the subtitle next to the trade type.
     * Rendered as a subtle-coloured paragraph: e.g. "21.01 USD"
     * Source: second `.contract-card__details` row inside `.contract-card__details-col` > `p.quill-typography__color--subtle`
     */
    get mobileContractCardStake(): Locator {
        return this.page.locator(
            '.contract-card__details-col .contract-card__details p.quill-typography__color--subtle'
        );
    }

    /**
     * Mobile Entry & exit details section — wraps start time, entry spot, exit spot rows.
     * Source: EntryExitDetails component
     */
    get mobileEntryExitDetails(): Locator {
        return this.page.locator('.entry-exit-details');
    }

    /**
     * Mobile risk management card — TP toggle button.
     * `aria-pressed="true"` when TP is active, `"false"` when not set.
     */
    get mobileRiskManagementTpToggle(): Locator {
        return this.page
            .locator('.risk-management-item__container', {
                has: this.page.locator('p', { hasText: 'Take profit' }),
            })
            .locator('button.toggle-switch');
    }

    /**
     * Mobile risk management card — SL toggle button.
     * `aria-pressed="true"` when SL is active, `"false"` when not set.
     */
    get mobileRiskManagementSlToggle(): Locator {
        return this.page
            .locator('.risk-management-item__container', {
                has: this.page.locator('p', { hasText: 'Stop loss' }),
            })
            .locator('button.toggle-switch');
    }

    /**
     * Mobile risk management card — TP value input (only present when TP is active).
     * Value format: "10.00 USD"
     */
    get mobileRiskManagementTpInput(): Locator {
        return this.page
            .locator('.risk-management-item__container', {
                has: this.page.locator('p', { hasText: 'Take profit' }),
            })
            .locator('input');
    }

    /**
     * Mobile risk management card — SL value input (only present when SL is active).
     * Value format: "-10.00 USD" (negative prefix rendered by the app)
     */
    get mobileRiskManagementSlInput(): Locator {
        return this.page
            .locator('.risk-management-item__container', {
                has: this.page.locator('p', { hasText: 'Stop loss' }),
            })
            .locator('input');
    }

    /**
     * Mobile contract card — "TP" badge shown when take profit is active.
     * Source: `.tag__wrapper .risk-management` > `p` with text "TP"
     */
    get mobileContractCardTpBadge(): Locator {
        return this.page.locator('.contract-card__details .tag__wrapper .risk-management', {
            hasText: 'TP',
        });
    }

    /**
     * Mobile contract card — "SL" badge shown when stop loss is active.
     * Source: `.tag__wrapper .risk-management` > `p` with text "SL"
     */
    get mobileContractCardSlBadge(): Locator {
        return this.page.locator('.contract-card__details .tag__wrapper .risk-management', {
            hasText: 'SL',
        });
    }

    /**
     * Mobile TP & SL History section title — visible when the card-wrapper is present.
     * Source: `.card-wrapper.take-profit-history > p.title`
     */
    get mobileTpSlHistoryTitle(): Locator {
        return this.page.locator('.card-wrapper.take-profit-history .title');
    }

    /**
     * Mobile TP & SL History — a single row by zero-based index inside the carousel.
     * Each row has a label cell ("Take profit" / "Stop loss") and a value cell.
     * Source: `.take-profit-history__table-row`
     */
    mobileTpSlHistoryRow(index: number): Locator {
        return this.page.locator('.take-profit-history__table-row').nth(index);
    }

    /**
     * Mobile TP & SL History — label text of a row (e.g. "Take profit", "Stop loss").
     * Source: second `.take-profit-history__table-cell > p` (subtle coloured)
     */
    mobileTpSlHistoryRowLabel(index: number): Locator {
        return this.mobileTpSlHistoryRow(index).locator('.take-profit-history__table-cell').last().locator('p').first();
    }

    /**
     * Mobile TP & SL History — value text of a row (e.g. "30.01 USD", "-12.00 USD").
     * Source: second `.take-profit-history__table-cell > p` (default coloured, second p)
     */
    mobileTpSlHistoryRowValue(index: number): Locator {
        return this.mobileTpSlHistoryRow(index).locator('.take-profit-history__table-cell').last().locator('p').last();
    }

    /**
     * Market symbol on the contract card.
     * Source: dc-contract-card__symbol
     */
    get contractDetailsMarket(): Locator {
        return this.contractCard.locator('.dc-contract-card__symbol');
    }

    /**
     * Contract type label on the contract card (e.g. "Rise", "Fall").
     * Source: dc-contract-type__type-label
     */
    get contractDetailsTradeType(): Locator {
        return this.contractCard.locator('.dc-contract-type__type-label');
    }

    /**
     * Currency badge on the contract card (e.g. "USD").
     * Source: dc-currency-badge
     */
    get contractDetailsCurrency(): Locator {
        return this.contractCard.locator('.dc-currency-badge');
    }

    /**
     * Remaining time on the progress slider — live value.
     * Source: dc-remaining-time
     */
    get contractDetailsRemainingTime(): Locator {
        return this.contractCard.locator('.dc-remaining-time');
    }

    /**
     * Progress slider track line — open time-based contracts (Rise/Fall, etc.).
     * Source: dc-progress-slider__line
     */
    get contractDetailsProgressBar(): Locator {
        return this.contractCard.locator('.dc-progress-slider__line');
    }

    /**
     * Tick progress slider — open tick contracts (Rise/Fall ticks, Even/Odd, Matches/Differs, Over/Under).
     * Source: dc-progress-slider with dc-progress-slider__ticks-caption ("Tick N").
     */
    get contractDetailsTickProgressSlider(): Locator {
        return this.contractCard.locator('.dc-progress-slider');
    }

    get contractDetailsTickProgressCaption(): Locator {
        return this.contractCard.locator('.dc-progress-slider__ticks-caption');
    }

    /**
     * Completed progress slider — closed contracts only.
     * Source: dc-progress-slider--completed
     */
    get contractDetailsProgressBarCompleted(): Locator {
        return this.contractCard.locator('.dc-progress-slider--completed');
    }

    /**
     * Sell button on the contract card footer.
     * Source: data-testid="dt_contract_card_sell"
     */
    get contractDetailsSellButton(): Locator {
        return this.contractCard.getByTestId('dt_contract_card_sell');
    }

    /**
     * Desktop contract card — non-resalable footer message (tick digit types).
     * Source: dc-contract-card__no-resale-msg (not a button on contract details).
     */
    get contractDetailsResaleNotOffered(): Locator {
        return this.contractCard.locator('.dc-contract-card__no-resale-msg');
    }

    /** @deprecated Use {@link contractDetailsResaleNotOffered} — Positions cards may render a button instead. */
    get contractDetailsResaleNotOfferedButton(): Locator {
        return this.contractCard.getByRole('button', { name: /^Resale not offered$/i });
    }

    /** Mobile contract details footer — same non-resalable state as desktop. */
    get mobileContractDetailsResaleNotOfferedButton(): Locator {
        return this.page
            .locator('.contract-details-footer--container')
            .getByRole('button', { name: /^Resale not offered$/i });
    }

    /**
     * Returns a contract card item body scoped to the given header label.
     * Source: dc-contract-card-item__header + dc-contract-card-item__body
     *
     * @param label - Exact header text, e.g. "Stake:", "Potential payout:"
     */
    contractCardItem(label: string): Locator {
        return this.contractCard
            .locator('.dc-contract-card-item', { hasText: label })
            .locator('.dc-contract-card-item__body');
    }

    /**
     * Reference ID label in the audit grid.
     * Source: contract-audit__grid[data-testid="dt_id_label"] > contract-audit__label
     */
    get contractDetailsReferenceIDLabel(): Locator {
        return this.page.getByTestId('dt_id_label').locator('.contract-audit__label');
    }

    /**
     * Reference ID value in the audit grid (e.g. "1071599 (Buy)").
     * Source: contract-audit__grid[data-testid="dt_id_label"] > contract-audit__value
     */
    get contractDetailsReferenceID(): Locator {
        return this.page.getByTestId('dt_id_label').locator('.contract-audit__value');
    }

    /**
     * Duration label in the audit grid.
     * Source: contract-audit__grid[data-testid="dt_duration_label"] > contract-audit__label
     */
    get contractDetailsDurationLabel(): Locator {
        return this.page.getByTestId('dt_duration_label').locator('.contract-audit__label');
    }

    /**
     * Duration value in the audit grid (e.g. "30 minutes").
     * Source: contract-audit__grid[data-testid="dt_duration_label"] > contract-audit__value
     */
    get contractDetailsDuration(): Locator {
        return this.page.getByTestId('dt_duration_label').locator('.contract-audit__value');
    }

    /**
     * Barrier label in the audit grid.
     * Source: contract-audit__grid[data-testid="dt_bt_label"] > contract-audit__label
     */
    get contractDetailsBarrierLabel(): Locator {
        return this.page.getByTestId('dt_bt_label').locator('.contract-audit__label');
    }

    /**
     * Barrier value in the audit grid (e.g. "9,666.52").
     * Source: contract-audit__grid[data-testid="dt_bt_label"] > contract-audit__value
     */
    get contractDetailsBarrier(): Locator {
        return this.page.getByTestId('dt_bt_label').locator('.contract-audit__value');
    }

    /**
     * Audit-grid value cell scoped by its label text — use when multiple `dt_bt_label` rows exist
     * (e.g. Vanillas render separate Strike and Payout per point rows).
     */
    contractAuditValue(label: string): Locator {
        return this.page
            .getByTestId('dt_bt_label')
            .filter({ has: this.page.locator('.contract-audit__label', { hasText: label }) })
            .locator('.contract-audit__value');
    }

    /**
     * Start time label in the audit grid.
     * Source: contract-audit__grid[data-testid="dt_start_time_label"] > contract-audit__label
     */
    get contractDetailsStartTimeLabel(): Locator {
        return this.page.getByTestId('dt_start_time_label').locator('.contract-audit__label');
    }

    /**
     * Start time value in the audit grid (e.g. "2026-06-18 07:50:17 GMT").
     * Source: contract-audit__grid[data-testid="dt_start_time_label"] > contract-audit__value
     */
    get contractDetailsStartTime(): Locator {
        return this.page.getByTestId('dt_start_time_label').locator('.contract-audit__value');
    }

    /**
     * Entry spot label in the audit grid.
     * Source: contract-audit__grid[data-testid="dt_entry_spot_label"] > contract-audit__label
     */
    get contractDetailsEntrySpotLabel(): Locator {
        return this.page.getByTestId('dt_entry_spot_label').locator('.contract-audit__label');
    }

    /**
     * Entry spot price in the audit grid (e.g. "9,666.52") — varies per run.
     * Source: contract-audit__grid[data-testid="dt_entry_spot_label"] > contract-audit__value
     */
    get contractDetailsEntrySpot(): Locator {
        return this.page.getByTestId('dt_entry_spot_label').locator('.contract-audit__value');
    }

    /**
     * Entry spot timestamp in the audit grid (e.g. "2026-06-18 07:50:18 GMT").
     * Source: contract-audit__grid[data-testid="dt_entry_spot_label"] > contract-audit__value2
     */
    get contractDetailsEntrySpotTime(): Locator {
        return this.page.getByTestId('dt_entry_spot_label').locator('.contract-audit__value2');
    }

    /**
     * Sell reference ID in the audit grid — closed contracts only (e.g. "1071699 (Sell)").
     * Source: contract-audit__grid[data-testid="dt_id_label"] > contract-audit__value2
     */
    get contractDetailsReferenceIDSell(): Locator {
        return this.page.getByTestId('dt_id_label').locator('.contract-audit__value2');
    }

    // ============================================
    // MULTIPLIERS-SPECIFIC LOCATORS
    // ============================================

    /**
     * Multipliers contract type direction label — first child div of `.dc-contract-type__type-label`.
     * Renders "Multipliers" (not "Up" / "Down").
     */
    get multContractTypeLabel(): Locator {
        return this.contractCard.locator('.dc-contract-type__type-label > div').first();
    }

    /**
     * Multipliers trade param label — second child div of `.dc-contract-type__type-label`.
     * Renders "Up x200" or "Down x300".
     */
    get multContractTradeParam(): Locator {
        return this.contractCard.locator(
            '.dc-contract-type__type-label--multipliers .dc-contract-type__type-label-trade-param'
        );
    }

    /**
     * Commission value in the Multipliers audit grid.
     * Source: contract-audit__grid[data-testid="dt_commission_label"] > contract-audit__value
     */
    get multContractDetailsCommission(): Locator {
        return this.page.getByTestId('dt_commission_label').locator('.contract-audit__value');
    }

    /**
     * Close button on the Multipliers contract card footer (open contracts only).
     * Source: `.dc-btn--sell` — does NOT use dt_contract_card_sell data-testid.
     */
    get multContractDetailsCloseButton(): Locator {
        return this.contractCard.locator('.dc-btn--sell');
    }

    /**
     * Pencil toggle that opens the TP/SL editor on the desktop Multipliers card.
     * While Deal Cancellation is active it is non-interactive via the native `disabled`
     * attribute (Popover path) or `.dc-contract-card-dialog-toggle--disabled` (toggle-card-dialog.tsx).
     */
    get multTpSlEditToggle(): Locator {
        return this.contractCard.locator('button.dc-contract-card-dialog-toggle');
    }

    /**
     * "Details" tab in the contract audit tabs (Reference ID, Commission, Deal cancellation, etc.).
     * Source: `.dc-tabs__list--contract-audit__tabs li` with text "Details"
     */
    get multDetailsTab(): Locator {
        return this.page.locator('.dc-tabs__list--contract-audit__tabs li', { hasText: 'Details' });
    }

    /**
     * "TP & SL History" tab in the contract audit tabs.
     * Source: `.dc-tabs__list--contract-audit__tabs li` with text "TP & SL History"
     */
    get multTpSlHistoryTab(): Locator {
        return this.page.locator('.dc-tabs__list--contract-audit__tabs li', { hasText: 'TP & SL History' });
    }

    /**
     * Empty state header inside the TP & SL History tab ("No history").
     * Source: `.contract-audit__empty h4`
     */
    get multTpSlHistoryEmptyHeader(): Locator {
        return this.page.locator('.contract-audit__empty h4');
    }

    /**
     * Empty state description inside the TP & SL History tab.
     * Source: `.contract-audit__empty span`
     */
    get multTpSlHistoryEmptyDescription(): Locator {
        return this.page.locator('.contract-audit__empty span');
    }

    /**
     * A single TP/SL history entry by zero-based index.
     * Source: `.contract-audit__grid[data-testid="dt_history_label_{index}"]`
     */
    multTpSlHistoryEntry(index: number): Locator {
        return this.page.getByTestId(`dt_history_label_${index}`);
    }

    /**
     * Label text of a TP/SL history entry (e.g. "Take profit", "Stop loss").
     * Source: `.contract-audit__label` inside the entry grid
     */
    multTpSlHistoryEntryLabel(index: number): Locator {
        return this.multTpSlHistoryEntry(index).locator('.contract-audit__label');
    }

    /**
     * Value of a TP/SL history entry (e.g. "30.01").
     * The amount lives in a nested `dt_span`; spot price follows in a `<br><span>`.
     * Source: `[data-testid="dt_span"]` inside `.contract-audit__value`
     */
    multTpSlHistoryEntryValue(index: number): Locator {
        return this.multTpSlHistoryEntry(index).locator('.contract-audit__value').getByTestId('dt_span');
    }

    /**
     * Date portion of a TP/SL history entry timestamp (e.g. "2026-07-08").
     * Two `.contract-audit__timestamp-value` spans exist per entry — first is date, second is time.
     * Source: `.contract-audit__timestamp-value` first span inside the entry grid
     */
    multTpSlHistoryEntryDate(index: number): Locator {
        return this.multTpSlHistoryEntry(index).locator('.contract-audit__timestamp-value').first();
    }

    /**
     * Exit spot price in the audit grid (e.g. "9,603.17") — closed contracts only.
     * Source: contract-audit__grid[data-testid="dt_exit_spot_label"] > contract-audit__value
     */
    get contractDetailsExitSpot(): Locator {
        return this.page.getByTestId('dt_exit_spot_label').locator('.contract-audit__value');
    }

    /**
     * Exit spot timestamp in the audit grid (e.g. "2026-06-18 08:43:49 GMT") — closed contracts only.
     * Source: contract-audit__grid[data-testid="dt_exit_spot_label"] > contract-audit__value2
     */
    get contractDetailsExitSpotTime(): Locator {
        return this.page.getByTestId('dt_exit_spot_label').locator('.contract-audit__value2');
    }

    /**
     * Exit spot label in the audit grid — closed contracts only.
     * Source: contract-audit__grid[data-testid="dt_exit_spot_label"] > contract-audit__label
     */
    get contractDetailsExitSpotLabel(): Locator {
        return this.page.getByTestId('dt_exit_spot_label').locator('.contract-audit__label');
    }

    /**
     * Exit time label in the audit grid — closed contracts only.
     * Source: contract-audit__grid[data-testid="dt_exit_time_label"] > contract-audit__label
     */
    get contractDetailsExitTimeLabel(): Locator {
        return this.page.getByTestId('dt_exit_time_label').locator('.contract-audit__label');
    }

    /**
     * Exit time value in the audit grid (e.g. "2026-06-18 08:43:49 GMT") — closed contracts only.
     * Source: contract-audit__grid[data-testid="dt_exit_time_label"] > contract-audit__value
     */
    get contractDetailsExitTime(): Locator {
        return this.page.getByTestId('dt_exit_time_label').locator('.contract-audit__value');
    }

    // ============================================
    // ACCUMULATORS-SPECIFIC LOCATORS
    // ============================================

    /**
     * Accumulators contract type label — first child div of `.dc-contract-type__type-label`.
     * Renders "Accumulators".
     */
    get accuContractTypeLabel(): Locator {
        return this.contractCard
            .locator('.dc-contract-card__type--accumulators .dc-contract-type__type-label > div')
            .first();
    }

    /**
     * Accumulators growth rate chip — rendered inside the contract type label.
     * Renders e.g. "3%".
     * Source: `.dc-contract-type__type-label-trade-param` scoped to the accumulators type block.
     */
    get accuContractGrowthRate(): Locator {
        return this.contractCard.locator(
            '.dc-contract-card__type--accumulators .dc-contract-type__type-label-trade-param'
        );
    }

    /**
     * Accumulators tick progress bar on the open contract card (e.g. "14 Ticks").
     * Source: dc-tick-counter-bar__container — replaces the duration/progress-slider on open accu contracts.
     */
    get accuTickCounterBar(): Locator {
        return this.contractCard.locator('.dc-tick-counter-bar__text');
    }

    /** Contract details page overlay — `#dt_contract_replay_container.dc-page-overlay`. */
    get contractDetailsOverlay(): Locator {
        return this.page.locator('#dt_contract_replay_container.dc-page-overlay');
    }

    /** Replay chart panel beside the contract drawer on desktop open contracts. */
    get replayChartContainer(): Locator {
        return this.page.getByTestId('dt_replay_chart_container');
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Whether contract details show a settled contract (used to retry Accumulators / short tick runs).
     */
    async isAutomationContractDetailsClosed(): Promise<boolean> {
        if (this.isMobile) {
            return this.page
                .locator('.contract-details')
                .getByText('Closed', { exact: true })
                .isVisible()
                .catch(() => false);
        }

        if (await this.contractDetailsReferenceIDSell.isVisible().catch(() => false)) {
            const sellRefText = await this.contractDetailsReferenceIDSell.innerText().catch(() => '');
            if (/\(Sell\)/.test(sellRefText)) {
                return true;
            }
        }

        if (await this.contractDetailsExitSpotLabel.isVisible().catch(() => false)) {
            return true;
        }

        if (await this.contractDetailsExitTimeLabel.isVisible().catch(() => false)) {
            return true;
        }

        // Contract drawer audit rows may omit data-testids — fall back to settled labels in the card.
        if (
            await this.contractCard
                .getByText('Exit time', { exact: true })
                .isVisible()
                .catch(() => false)
        ) {
            return true;
        }

        if (
            await this.contractCard
                .getByText('Exit spot', { exact: true })
                .isVisible()
                .catch(() => false)
        ) {
            return true;
        }

        if (
            await this.contractCard
                .getByText(/\(Sell\)/)
                .isVisible()
                .catch(() => false)
        ) {
            return true;
        }

        return this.contractDetailsProgressBarCompleted.isVisible().catch(() => false);
    }

    /**
     * Whether contract details currently show an open contract.
     * - Accumulators: Sell/Close footer, or accu tick counter while open.
     * - Tick digits (Even/Odd, etc.): "Resale not offered" or tick progress caption — no Sell/Close.
     * - Rise/Fall (ticks): "Resale not offered" while open; minute/hour duration may show Sell.
     * - Rise/Fall (time): Sell button + remaining-time progress bar.
     */
    async isOpenAutomationContractDetails(): Promise<boolean> {
        if (await this.isAutomationContractDetailsClosed()) {
            return false;
        }

        const sellOrCloseButton = this.isMobile
            ? this.mobileContractDetailsCloseButton
            : this.contractDetailsSellButton;
        if (await sellOrCloseButton.isVisible().catch(() => false)) {
            return true;
        }

        const resaleNotOffered = this.isMobile
            ? this.mobileContractDetailsResaleNotOfferedButton
            : this.contractDetailsResaleNotOffered;
        if (await resaleNotOffered.isVisible().catch(() => false)) {
            return true;
        }

        if (!this.isMobile) {
            if (await this.accuTickCounterBar.isVisible().catch(() => false)) {
                return true;
            }
            if (await this.contractDetailsTickProgressCaption.isVisible().catch(() => false)) {
                return true;
            }
            return this.contractDetailsProgressBar.isVisible().catch(() => false);
        }

        return false;
    }

    /**
     * Close the contract details overlay by clicking the header close button.
     */
    async closeContractDetails(): Promise<void> {
        // The close button can detach/re-render as the contract card updates, and the overlay can
        // briefly intercept the click, so a single click + waitForURL is flaky. Retry the click
        // until the URL actually leaves /contract/ (mobile back arrow navigates asynchronously).
        await expect(async () => {
            await this.contractDetailsCloseButton.click({ timeout: 3_000 }).catch(() => {});
            await expect(this.page, 'Should navigate away from /contract/ after closing details').not.toHaveURL(
                /\/contract\//,
                { timeout: 3_000 }
            );
        }).toPass({ timeout: 30_000 });
    }

    /**
     * Sell / early-close the open contract.
     * - Desktop: clicks the Sell button on the contract card (`dt_contract_card_sell`)
     * - Mobile: clicks the "Close X.XX USD" footer button
     *
     * Retries on PriceMoved rejection (button re-enables after a transient market-moved error).
     */
    async sellContract(): Promise<void> {
        const sellBtn = this.isMobile ? this.mobileContractDetailsCloseButton : this.contractDetailsSellButton;

        await expect(sellBtn, 'Sell/Close button should be visible on the contract details').toBeVisible();
        await expect(sellBtn, 'Sell/Close button should be enabled before selling').toBeEnabled();
        // Clicks are swallowed: the contract card re-renders on every tick, so the button can detach
        // mid-click ("element not stable / detached"). The poll below re-clicks until it is gone (sold).
        await sellBtn.click().catch(() => {});

        // Poll: re-click if rejected (PriceMoved) or if a tick re-render detached the button — it
        // re-enables without navigating away, so keep clicking until it disappears (contract sold).
        await expect
            .poll(
                async () => {
                    const isGone = !(await sellBtn.isVisible().catch(() => false));
                    if (isGone) return true;
                    const isEnabled = await sellBtn.isEnabled().catch(() => false);
                    if (isEnabled) await sellBtn.click().catch(() => {});
                    return false;
                },
                {
                    message: 'Sell/Close button should disappear after contract is sold',
                    intervals: [1000],
                    timeout: 60_000,
                }
            )
            .toBe(true);
    }

    /**
     * Cancel an open Multipliers contract while its Deal Cancellation window is active.
     * The action is enabled only while the live contract is losing, so wait for that valid state.
     */
    async cancelDealCancellationContract(): Promise<void> {
        await expect(
            this.dealCancellationButton,
            'Deal Cancellation button should become enabled while the contract is cancellable'
        ).toBeEnabled({ timeout: 240_000 });
        await this.dealCancellationButton.click();
        await expect(
            this.dealCancellationButton,
            'Deal Cancellation button should disappear after the contract is cancelled'
        ).not.toBeVisible({ timeout: 60_000 });
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Verify the open contract details expose an active Deal Cancellation timer and action.
     */
    async verifyDealCancellationAvailable(): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.dealCancellationBadge,
                'Deal Cancellation timer badge should be visible on the open contract details'
            ).toBeVisible();
        } else {
            // Deal cancellation audit row lives on the Details tab, not TP & SL History.
            await this.multDetailsTab.click();
            await expect(
                this.dealCancellationAuditRow,
                'Desktop audit grid should show the Deal cancellation row'
            ).toBeVisible();
            await expect(
                this.dealCancellationAuditLabel,
                'Desktop contract details should show Deal cancellation (active)'
            ).toHaveText('Deal cancellation (active)');
            await expect(
                this.dealCancellationAuditValue,
                'Deal cancellation (active) should show the fee amount'
            ).not.toBeEmpty();
        }
        await expect(this.dealCancellationButton, 'Deal Cancellation Cancel button should be visible').toBeVisible();
        await expect(
            this.dealCancellationRemainingTime,
            'Deal Cancellation button should show a live mm:ss countdown'
        ).toHaveText(/^\d{2}:\d{2}$/);
    }

    /**
     * Compute the expected barrier price from the entry spot and the configured offset.
     * The server applies the offset to the entry spot tick, e.g. "10,643.97" + 5.00 → "10,648.97".
     *
     * @param entrySpot  - Formatted entry spot, e.g. "10,643.97"
     * @param barrier    - Offset string without sign, e.g. "5.00"
     * @param barrierType - "Above spot" adds the offset; "Below spot" subtracts it
     * @returns Formatted barrier price, e.g. "10,648.97"
     */
    private calculateBarrier(
        entrySpot: string,
        barrier: string,
        barrierType: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): string {
        const spotValue = parseFloat(entrySpot.replace(/,/g, ''));
        const offsetValue = parseFloat(barrier);
        const spotDecimals = (entrySpot.replace(/,/g, '').split('.')[1] ?? '').length;
        const barrierDecimals = (barrier.split('.')[1] ?? '').length;
        const decimalPlaces = Math.max(spotDecimals, barrierDecimals);
        let result: number;
        if (barrierType === 'Above spot') {
            result = spotValue + offsetValue;
        } else if (barrierType === 'Below spot') {
            result = spotValue - offsetValue;
        } else {
            result = offsetValue;
        }
        return result.toLocaleString('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
        });
    }

    /**
     * Normalise a chip-format duration label to the full-word form the audit grid renders.
     * e.g. '5 min' → '5 minutes', '15 sec' → '15 seconds', '6 ticks' → '6 ticks' (unchanged)
     */
    private normaliseDurationForAudit(value: string): string {
        // '1h 30m' → '01h 30m' (audit grid zero-pads hours)
        const customMatch = value.match(/^(\d+)h\s+(\d+)m$/);
        if (customMatch) {
            const h = customMatch[1].padStart(2, '0');
            const m = customMatch[2];
            return `${h}h ${m}m`;
        }
        // '1 hr' → '1 hour', '2 hr' → '2 hours'
        const hrMatch = value.match(/^(\d+) hr$/);
        if (hrMatch) {
            const n = parseInt(hrMatch[1], 10);
            return `${n} ${n === 1 ? 'hour' : 'hours'}`;
        }
        return value
            .replace(/\bmin\b/, 'minutes')
            .replace(/\bsec\b/, 'seconds')
            .replace(/\bhr\b/, 'hours');
    }

    /**
     * Contract value = stake ± P&L.
     * Early sells settle at bid price (non-zero loss possible); expiry losses settle at 0.00.
     *
     * @param stake            - e.g. "10.50"
     * @param profitLossAmount - e.g. "+1.26 USD" or "-0.23 USD"
     * @returns e.g. "11.76" or "10.27"
     */
    private calculateClosedContractValue(stake: string, profitLossAmount: string): string {
        const sign = profitLossAmount.startsWith('-') ? -1 : 1;
        const profitNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        return (parseFloat(stake) + sign * parseFloat(profitNumeric)).toFixed(2);
    }

    /**
     * Verify the open contract details page for a contract opened by an automation run.
     * Uses spec params for market/stake/trade-type category; live fields are asserted for presence only.
     *
     * @param options.growthRate - Accumulators growth rate from the spec, e.g. `"3%"`.
     * @param options.takeProfit - Accumulators take profit when set; omit to assert `"-"` on the card.
     */
    async verifyAutomationOpenContractDetailsPage(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        stake: string,
        options: { growthRate?: string; takeProfit?: string } = {}
    ): Promise<void> {
        const formattedStake = Number(stake).toFixed(2);

        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        if (this.isMobile) {
            await this.verifyAutomationOpenContractDetailsMobile(
                market,
                tradeTypeCategory,
                currency,
                formattedStake,
                options
            );
        } else {
            await this.verifyAutomationOpenContractDetailsDesktop(
                market,
                tradeTypeCategory,
                currency,
                formattedStake,
                options
            );
        }
    }

    private automationContractTradeTypeMatcher(tradeTypeCategory: string): string | RegExp {
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
                    `verifyAutomationOpenContractDetailsPage: unsupported trade type category '${tradeTypeCategory}'`
                );
        }
    }

    /** Even/Odd, Matches/Differs, Over/Under — tick digit contracts; not Accumulators or Rise/Fall. */
    private isDigitTradeTypeCategory(tradeTypeCategory: string): boolean {
        return [
            'Matches/Differs',
            'Matches',
            'Differs',
            'Over/Under',
            'Over',
            'Under',
            'Even/Odd',
            'Even',
            'Odd',
        ].includes(tradeTypeCategory);
    }

    /** Tick digit contracts do not offer early resale while open. Accumulators keep Sell/Close. */
    private isNonResalableTickTradeType(tradeTypeCategory: string): boolean {
        return this.isDigitTradeTypeCategory(tradeTypeCategory);
    }

    /** Throws a retryable error when the contract settled before open assertions run. */
    private async assertAutomationContractDetailsStillOpen(): Promise<void> {
        if (await this.isAutomationContractDetailsClosed()) {
            throw new Error(
                'Contract settled before open details could be verified — retrying with the next open contract'
            );
        }
    }

    private async verifyOpenContractTickProgress(): Promise<void> {
        await expect(
            this.contractDetailsTickProgressCaption,
            'Tick progress caption should show the current tick'
        ).toHaveText(/Tick \d+/);
        await expect(this.contractDetailsTickProgressSlider, 'Tick progress slider should be visible').toBeVisible();
    }

    /**
     * Open contract progress — tick duration (Rise/Fall ticks, digit types) shows "Tick N";
     * minute/hour duration shows remaining time on the progress bar.
     */
    private async verifyOpenContractProgressIndicator(): Promise<void> {
        if (await this.contractDetailsTickProgressCaption.isVisible().catch(() => false)) {
            await this.verifyOpenContractTickProgress();
            return;
        }
        await expect(this.contractDetailsRemainingTime, 'Remaining time should have a value').not.toBeEmpty();
        await expect(this.contractDetailsProgressBar, 'Progress bar should be visible').toBeVisible();
    }

    private async verifyAutomationOpenContractSellAction(tradeTypeCategory: string): Promise<void> {
        if (await this.isAutomationContractDetailsClosed()) {
            throw new Error(
                'Contract settled before open details could be verified — retrying with the next open contract'
            );
        }

        if (this.isNonResalableTickTradeType(tradeTypeCategory)) {
            if (this.isMobile) {
                await expect(
                    this.mobileContractDetailsResaleNotOfferedButton,
                    'Resale not offered should be shown on open tick digit contracts'
                ).toBeVisible();
                await expect(
                    this.mobileContractDetailsResaleNotOfferedButton,
                    'Resale not offered button should be disabled'
                ).toBeDisabled();
            } else {
                await expect(
                    this.contractDetailsResaleNotOffered,
                    'Resale not offered should be shown on open tick digit contracts'
                ).toHaveText('Resale not offered');
            }

            const sellOrCloseButton = this.isMobile
                ? this.mobileContractDetailsCloseButton
                : this.contractDetailsSellButton;
            await expect(
                sellOrCloseButton,
                'Sell/Close should not be shown when resale is not offered'
            ).not.toBeVisible();
            return;
        }

        const resaleNotOffered = this.isMobile
            ? this.mobileContractDetailsResaleNotOfferedButton
            : this.contractDetailsResaleNotOffered;
        if (await resaleNotOffered.isVisible().catch(() => false)) {
            if (this.isMobile) {
                await expect(
                    resaleNotOffered,
                    'Resale not offered button should be disabled when early sell is unavailable'
                ).toBeDisabled();
            } else {
                await expect(
                    this.contractDetailsResaleNotOffered,
                    'Resale not offered should be shown when early sell is unavailable'
                ).toHaveText('Resale not offered');
            }
            await expect(
                this.isMobile ? this.mobileContractDetailsCloseButton : this.contractDetailsSellButton,
                'Sell/Close should not be shown when resale is not offered'
            ).not.toBeVisible();
            return;
        }

        const sellOrCloseButton = this.isMobile
            ? this.mobileContractDetailsCloseButton
            : this.contractDetailsSellButton;
        await expect(sellOrCloseButton, 'Sell/Close button should be visible on the open contract').toBeVisible();
        if (!this.isMobile) {
            await expect(this.contractDetailsSellButton, 'Sell button label should be "Sell"').toHaveText('Sell');
        }
    }

    private async verifyAutomationOpenContractDetailsMobile(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        formattedStake: string,
        options: { growthRate?: string; takeProfit?: string }
    ): Promise<void> {
        await this.assertAutomationContractDetailsStillOpen();
        await this.verifyAutomationOpenContractSellAction(tradeTypeCategory);

        await expect(this.mobileContractMarket, `Mobile contract card should show market "${market}"`).toHaveText(
            market
        );

        if (tradeTypeCategory === 'Accumulators') {
            await expect(
                this.mobileContractTradeType,
                'Mobile contract card should show trade type "Accumulators"'
            ).toHaveText('Accumulators');
        } else {
            await expect(
                this.mobileContractTradeType,
                `Mobile contract card trade type should match ${tradeTypeCategory}`
            ).toHaveText(this.automationContractTradeTypeMatcher(tradeTypeCategory));
        }

        await expect(this.mobileContractProfit, 'Mobile contract profit/loss should have a live value').not.toBeEmpty();
        await expect(this.mobileContractCardStake, `Stake should show "${formattedStake} ${currency}"`).toContainText(
            formattedStake
        );
        await expect(this.mobileOrderDetailsValue('Reference ID'), 'Reference ID should have a value').not.toBeEmpty();

        if (tradeTypeCategory === 'Accumulators') {
            await expect(
                this.mobileOrderDetailsValue('Stake'),
                `Stake should contain "${formattedStake}"`
            ).toContainText(formattedStake);
            if (options.growthRate) {
                await expect(
                    this.mobileOrderDetailsValue('Growth rate'),
                    `Growth rate should contain "${options.growthRate}"`
                ).toContainText(options.growthRate);
            } else {
                await expect(
                    this.mobileOrderDetailsValue('Growth rate'),
                    'Growth rate should have a value'
                ).not.toBeEmpty();
            }
            if (options.takeProfit) {
                await expect(
                    this.mobileOrderDetailsValue('Take profit'),
                    `Take profit should contain "${options.takeProfit}"`
                ).toContainText(options.takeProfit);
            }
            await expect(
                this.mobileEntryExitDetails,
                'Entry & exit details section should be visible for Accumulators'
            ).toBeVisible();
        } else {
            await expect(this.mobileOrderDetailsValue('Duration'), 'Duration should have a value').not.toBeEmpty();
            await expect(
                this.mobileOrderDetailsValue('Stake'),
                `Stake should contain "${formattedStake}"`
            ).toContainText(formattedStake);

            if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
                await expect(this.mobileOrderDetailsValue('Target'), 'Target should have a value').not.toBeEmpty();
            } else {
                await expect(this.mobileOrderDetailsValue('Barrier'), 'Barrier should have a value').not.toBeEmpty();
            }
        }
    }

    private async verifyAutomationOpenContractDetailsDesktop(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        formattedStake: string,
        options: { growthRate?: string; takeProfit?: string }
    ): Promise<void> {
        await this.assertAutomationContractDetailsStillOpen();

        await expect(this.contractDetailsOverlay, 'Contract details overlay should be visible').toBeVisible();
        await expect(
            this.page.getByTestId('dt_page_overlay_header_close'),
            'Contract details close button should be visible'
        ).toBeVisible();
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );

        if (tradeTypeCategory === 'Accumulators') {
            await expect(this.accuContractTypeLabel, 'Contract type should be "Accumulators"').toHaveText(
                'Accumulators'
            );
            if (options.growthRate) {
                await expect(
                    this.accuContractGrowthRate,
                    `Growth rate chip should be "${options.growthRate}"`
                ).toHaveText(options.growthRate);
            } else {
                await expect(this.accuContractGrowthRate, 'Growth rate chip should have a value').not.toBeEmpty();
            }
            await expect(this.accuTickCounterBar, 'Tick counter should show tick progress').toHaveText(
                /\d+\s+[Tt]icks/
            );
            if (options.takeProfit) {
                await expect(
                    this.contractCardItem('Take profit:'),
                    `Take profit should show "${options.takeProfit}"`
                ).toContainText(options.takeProfit);
            } else {
                await expect(
                    this.contractCardItem('Take profit:'),
                    'Take profit should be "-" when not set'
                ).toHaveText('-');
            }
        } else if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(
                this.contractDetailsTradeType,
                `Contract card type should match ${tradeTypeCategory}`
            ).toHaveText(this.automationContractTradeTypeMatcher(tradeTypeCategory));
            await this.verifyOpenContractTickProgress();
        } else {
            await expect(
                this.contractDetailsTradeType,
                `Contract card type should match ${tradeTypeCategory}`
            ).toHaveText(this.automationContractTradeTypeMatcher(tradeTypeCategory));
            await this.verifyOpenContractProgressIndicator();
        }

        await expect(this.contractCardItem('Stake:'), `Stake should contain "${formattedStake}"`).toContainText(
            formattedStake
        );
        await expect(
            this.contractCardItem('Total profit/loss:'),
            'Total profit/loss should have a live value'
        ).not.toBeEmpty();
        await expect(
            this.contractCardItem('Contract value:'),
            'Contract value should have a live value'
        ).not.toBeEmpty();
        await this.verifyAutomationOpenContractSellAction(tradeTypeCategory);

        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, 'Reference ID should match "N (Buy)"').toHaveText(
            /\d+\s+\(Buy\)/
        );
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, 'Start time should have a value').not.toBeEmpty();

        if (tradeTypeCategory === 'Accumulators') {
            await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
                'Entry spot'
            );
            await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
            await expect(this.replayChartContainer, 'Replay chart should be visible for Accumulators').toBeVisible();
        } else if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText(
                'Duration'
            );
            await expect(this.contractDetailsDuration, 'Duration should have a value').not.toBeEmpty();
            await expect(this.contractDetailsBarrierLabel, 'Target label should be "Target"').toHaveText('Target');
            await expect(this.contractDetailsBarrier, 'Target should have a value').not.toBeEmpty();
            await expect(
                this.replayChartContainer,
                'Replay chart should be visible for tick digit contracts'
            ).toBeVisible();
        } else {
            await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
                'Entry spot'
            );
            await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
            await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText(
                'Duration'
            );
            await expect(this.contractDetailsDuration, 'Duration should have a value').not.toBeEmpty();
            await expect(this.contractDetailsBarrierLabel, 'Barrier label should be "Barrier"').toHaveText('Barrier');
            await expect(this.contractDetailsBarrier, 'Barrier should have a value').not.toBeEmpty();
        }
    }

    /**
     * Verify the closed contract details page for a contract settled after an automation run stops.
     * Uses spec params for market/stake/trade-type category; settled fields are asserted for presence
     * or cross-checked against the Closed-tab P/L where applicable.
     *
     * @param profitLossAmount - P/L from the closed positions card, e.g. "+1.03 USD"
     * @param options.growthRate - Accumulators growth rate from the spec, e.g. `"3%"`.
     * @param options.takeProfit - Accumulators take profit when set; omit to assert `"-"` on the card.
     */
    async verifyAutomationClosedContractDetailsPage(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        stake: string,
        profitLossAmount: string,
        options: { growthRate?: string; takeProfit?: string } = {}
    ): Promise<void> {
        const formattedStake = Number(stake).toFixed(2);

        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        if (this.isMobile) {
            await this.verifyAutomationClosedContractDetailsMobile(
                market,
                tradeTypeCategory,
                currency,
                formattedStake,
                profitLossAmount,
                options
            );
        } else {
            await this.verifyAutomationClosedContractDetailsDesktop(
                market,
                tradeTypeCategory,
                currency,
                formattedStake,
                profitLossAmount,
                options
            );
        }
    }

    private async verifyAutomationClosedContractDetailsMobile(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        formattedStake: string,
        profitLossAmount: string,
        options: { growthRate?: string; takeProfit?: string }
    ): Promise<void> {
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();

        await expect(
            this.mobileContractMarket,
            `Mobile closed contract card should show market "${market}"`
        ).toHaveText(market);

        if (tradeTypeCategory === 'Accumulators') {
            await expect(
                this.mobileContractTradeType,
                'Mobile closed contract card should show trade type "Accumulators"'
            ).toHaveText('Accumulators');
        } else {
            await expect(
                this.mobileContractTradeType,
                `Mobile closed contract card trade type should match ${tradeTypeCategory}`
            ).toHaveText(this.automationContractTradeTypeMatcher(tradeTypeCategory));
        }

        await expect(
            this.mobileContractProfit,
            `Mobile closed contract profit/loss should contain "${profitLossNumeric}"`
        ).toContainText(profitLossNumeric);

        const refIdValueCell = this.page
            .locator('.order-details__table-row', {
                has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
            })
            .locator('.order-details__table-row-cell')
            .last();
        const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
        const sellRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Sell)' });
        await expect(buyRefIdParagraph, 'Buy Reference ID should contain "(Buy)"').toContainText('(Buy)');
        await expect(sellRefIdParagraph, 'Sell Reference ID should contain "(Sell)"').toContainText('(Sell)');

        await expect(this.mobileOrderDetailsValue('Duration'), 'Duration should have a value').not.toBeEmpty();
        await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${formattedStake}"`).toContainText(
            formattedStake
        );

        if (tradeTypeCategory === 'Accumulators') {
            if (options.growthRate) {
                await expect(
                    this.mobileOrderDetailsValue('Growth rate'),
                    `Growth rate should contain "${options.growthRate}"`
                ).toContainText(options.growthRate);
            } else {
                await expect(
                    this.mobileOrderDetailsValue('Growth rate'),
                    'Growth rate should have a value'
                ).not.toBeEmpty();
            }
            if (options.takeProfit) {
                await expect(
                    this.mobileOrderDetailsValue('Take profit'),
                    `Take profit should contain "${options.takeProfit}"`
                ).toContainText(options.takeProfit);
            }
            await expect(
                this.mobileEntryExitDetails,
                'Entry & exit details section should be visible for closed Accumulators'
            ).toBeVisible();
        } else if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(this.mobileOrderDetailsValue('Target'), 'Target should have a value').not.toBeEmpty();
        } else {
            await expect(this.mobileOrderDetailsValue('Barrier'), 'Barrier should have a value').not.toBeEmpty();
        }

        await expect(
            this.mobileContractDetailsCloseButton,
            'Close button should not be visible on a closed automation contract'
        ).not.toBeVisible();
    }

    private async verifyAutomationClosedContractDetailsDesktop(
        market: string,
        tradeTypeCategory: string,
        currency: string,
        formattedStake: string,
        profitLossAmount: string,
        options: { growthRate?: string; takeProfit?: string }
    ): Promise<void> {
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        const expectedContractValue = this.calculateClosedContractValue(formattedStake, profitLossAmount);

        await expect(this.contractDetailsOverlay, 'Contract details overlay should be visible').toBeVisible();
        await expect(
            this.page.getByTestId('dt_page_overlay_header_close'),
            'Contract details close button should be visible'
        ).toBeVisible();
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );

        if (tradeTypeCategory === 'Accumulators') {
            await expect(this.accuContractTypeLabel, 'Contract type should be "Accumulators"').toHaveText(
                'Accumulators'
            );
            if (options.growthRate) {
                await expect(
                    this.accuContractGrowthRate,
                    `Growth rate chip should be "${options.growthRate}"`
                ).toHaveText(options.growthRate);
            } else {
                await expect(this.accuContractGrowthRate, 'Growth rate chip should have a value').not.toBeEmpty();
            }
            await expect(
                this.accuTickCounterBar,
                'Tick counter should not be visible on a closed Accumulators contract'
            ).not.toBeVisible();
            await expect(
                this.contractDetailsProgressBarCompleted,
                'Completed progress slider should be visible on a closed Accumulators contract'
            ).toBeVisible();
            if (options.takeProfit) {
                await expect(
                    this.contractCardItem('Take profit:'),
                    `Take profit should show "${options.takeProfit}"`
                ).toContainText(options.takeProfit);
            } else {
                await expect(
                    this.contractCardItem('Take profit:'),
                    'Take profit should be "-" when not set'
                ).toHaveText('-');
            }
        } else if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(
                this.contractDetailsTradeType,
                `Contract card type should match ${tradeTypeCategory}`
            ).toHaveText(this.automationContractTradeTypeMatcher(tradeTypeCategory));
            await expect(
                this.contractDetailsTickProgressCaption,
                'Tick progress caption should not be visible on a closed tick digit contract'
            ).not.toBeVisible();
            await expect(
                this.contractDetailsProgressBarCompleted,
                'Completed progress slider should be visible on a closed tick digit contract'
            ).toBeVisible();
        } else {
            await expect(
                this.contractDetailsTradeType,
                `Contract card type should match ${tradeTypeCategory}`
            ).toHaveText(this.automationContractTradeTypeMatcher(tradeTypeCategory));
            await expect(
                this.contractDetailsRemainingTime,
                'Remaining time should not be visible on a closed contract'
            ).not.toBeVisible();
            await expect(
                this.contractDetailsProgressBar,
                'Progress bar should not be visible on a closed contract'
            ).not.toBeVisible();
            await expect(
                this.contractDetailsProgressBarCompleted,
                'Completed progress slider should be visible on a closed contract'
            ).toBeVisible();
        }

        await expect(this.contractCardItem('Stake:'), `Stake should contain "${formattedStake}"`).toContainText(
            formattedStake
        );
        await expect(
            this.contractCardItem('Total profit/loss:'),
            `Total profit/loss should contain "${profitLossNumeric}"`
        ).toContainText(profitLossNumeric);
        await expect(
            this.contractCardItem('Contract value:'),
            `Contract value should contain "${expectedContractValue}"`
        ).toContainText(expectedContractValue);
        await expect(
            this.contractDetailsSellButton,
            'Sell button should not be visible on a closed contract'
        ).not.toBeVisible();
        if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(
                this.contractDetailsResaleNotOffered,
                'Resale not offered footer should not be visible on a closed tick digit contract'
            ).not.toBeVisible();
        }

        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, 'Buy reference ID should match "N (Buy)"').toHaveText(
            /\d+\s+\(Buy\)/
        );
        await expect(this.contractDetailsReferenceIDSell, 'Sell reference ID should match "N (Sell)"').toHaveText(
            /\d+\s+\(Sell\)/
        );

        await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText('Duration');
        if (tradeTypeCategory === 'Accumulators' || this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(this.contractDetailsDuration, 'Duration should show tick count').toHaveText(/\d+\s+[Tt]icks/);
        } else {
            await expect(this.contractDetailsDuration, 'Duration should have a value').not.toBeEmpty();
        }
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, 'Start time should have a value').not.toBeEmpty();

        if (tradeTypeCategory === 'Accumulators') {
            await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
                'Entry spot'
            );
            await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
            await expect(this.contractDetailsEntrySpotTime, 'Entry spot time should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
                'Exit spot'
            );
            await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitSpotTime, 'Exit spot time should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
                'Exit time'
            );
            await expect(this.contractDetailsExitTime, 'Exit time should have a value').not.toBeEmpty();
            await expect(
                this.replayChartContainer,
                'Replay chart should be visible for closed Accumulators'
            ).toBeVisible();
        } else if (this.isDigitTradeTypeCategory(tradeTypeCategory)) {
            await expect(this.contractDetailsBarrierLabel, 'Target label should be "Target"').toHaveText('Target');
            await expect(this.contractDetailsBarrier, 'Target should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
                'Exit spot'
            );
            await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitSpotTime, 'Exit spot time should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
                'Exit time'
            );
            await expect(this.contractDetailsExitTime, 'Exit time should have a value').not.toBeEmpty();
            await expect(
                this.replayChartContainer,
                'Replay chart should be visible for closed tick digit contracts'
            ).toBeVisible();
        } else {
            await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
                'Entry spot'
            );
            await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
            await expect(this.contractDetailsBarrierLabel, 'Barrier label should be "Barrier"').toHaveText('Barrier');
            await expect(this.contractDetailsBarrier, 'Barrier should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
                'Exit spot'
            );
            await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
            await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
                'Exit time'
            );
            await expect(this.contractDetailsExitTime, 'Exit time should have a value').not.toBeEmpty();
        }
    }

    /**
     * Verify the contract details page is open and shows the expected contract data.
     * Delegates to the mobile or desktop implementation based on the current viewport.
     *
     * @param market        - Market symbol, e.g. "Volatility 100 (1s) Index"
     * @param tradeType     - Contract type label, e.g. "Rise"
     * @param currency      - Currency badge (desktop only), e.g. "USD"
     * @param stake         - Stake as displayed, e.g. "10.00"
     * @param payout        - Potential payout as displayed, e.g. "19.29"
     * @param buyId         - Reference ID from the buy, e.g. "1071599" (pass "" to skip exact check)
     * @param durationValue - Duration chip label, e.g. "15 min" (normalised internally)
     * @param buyDate       - UTC date captured before buy, e.g. "2026-06-18"
     * @returns Entry spot price string for barrier assertion, e.g. "9,874.68"
     */
    async verifyContractDetailsPage(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        buyDate: string,
        barrier?: string,
        barrierType?: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): Promise<string> {
        return this.isMobile
            ? this.verifyContractDetailsPageMobile(
                  market,
                  tradeType,
                  stake,
                  payout,
                  buyId,
                  durationValue,
                  buyDate,
                  barrier,
                  barrierType
              )
            : this.verifyContractDetailsPageDesktop(
                  market,
                  tradeType,
                  currency,
                  stake,
                  payout,
                  buyId,
                  durationValue,
                  buyDate,
                  barrier,
                  barrierType
              );
    }

    /**
     * Mobile contract details page verification.
     * Uses the AppV2 mobile `/contract/` page structure:
     * - `.contract-details-header-v2` banner
     * - `.order-details__table` key-value rows (Reference ID, Duration, Barrier, Stake, Potential payout)
     * - `.entry-exit-details__table` (Start time, Entry spot)
     * - "Close X.XX USD" footer button
     */
    private async verifyContractDetailsPageMobile(
        market: string,
        tradeType: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        _buyDate: string,
        barrier?: string,
        barrierType?: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): Promise<string> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header should show "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, trade type, profit (live)
        await expect(this.mobileContractMarket, `Mobile contract card should show market "${market}"`).toHaveText(
            market
        );
        await expect(
            this.mobileContractTradeType,
            `Mobile contract card should show trade type "${tradeType}"`
        ).toHaveText(tradeType);
        await expect(this.mobileContractProfit, 'Mobile contract card profit/loss should have a value').not.toBeEmpty();

        // Order Details — Reference ID
        if (buyId) {
            await expect(
                this.mobileOrderDetailsValue('Reference ID'),
                `Reference ID should be "${buyId} (Buy)"`
            ).toContainText(`${buyId} (Buy)`);
        } else {
            await expect(
                this.mobileOrderDetailsValue('Reference ID'),
                'Reference ID should have a value'
            ).not.toBeEmpty();
        }

        // Order Details — Duration
        const auditDuration = this.normaliseDurationForAudit(durationValue);
        await expect(this.mobileOrderDetailsValue('Duration'), `Duration should be "${auditDuration}"`).toHaveText(
            auditDuration
        );

        // Order Details — Stake
        await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${stake}"`).toContainText(stake);

        // Order Details — Potential payout (app may strip trailing zeros, e.g. "20.30" → "20.3")
        await expect(
            this.mobileOrderDetailsValue('Potential payout'),
            `Potential payout should contain "${payout}"`
        ).toContainText(parseFloat(payout).toString());

        // Order Details — Barrier
        await expect(this.mobileOrderDetailsValue('Barrier'), 'Barrier should have a value').not.toBeEmpty();

        // Entry & exit details — entry spot row (needed for barrier calculation)
        await expect(this.mobileEntryExitDetails, 'Entry & exit details section should be visible').toBeVisible();
        const entrySpotRow = this.page.locator('.entry-exit-details__table-row', {
            has: this.page.locator('.entry-exit-details__table-cell', { hasText: 'Entry spot' }),
        });
        await expect(entrySpotRow, 'Entry spot row should be visible').toBeVisible();
        const entrySpotCell = entrySpotRow.locator('.entry-exit-details__table-cell').last();
        const entrySpot = (await entrySpotCell.innerText()).trim().split('\n')[0].trim();

        if (tradeType === 'Rise' || tradeType === 'Fall') {
            await expect(
                this.mobileOrderDetailsValue('Barrier'),
                `Barrier should match entry spot "${entrySpot}"`
            ).toContainText(entrySpot.replace(/,/g, ''));
        } else if (
            tradeType === 'Higher' ||
            tradeType === 'Lower' ||
            tradeType === 'Touch' ||
            tradeType === 'No Touch'
        ) {
            if (!barrier || !barrierType) {
                throw new Error(`barrier and barrierType are required for ${tradeType} contracts`);
            }
            const expectedBarrier = this.calculateBarrier(entrySpot, barrier, barrierType);
            await expect(
                this.mobileOrderDetailsValue('Barrier'),
                `Barrier should be "${expectedBarrier}"`
            ).toContainText(expectedBarrier.replace(/,/g, ''));
        }

        // Close button visible (bid price loaded)
        await expect(
            this.mobileContractDetailsCloseButton,
            'Close button should be visible on the mobile contract details page'
        ).toBeVisible();

        return entrySpot;
    }

    /**
     * Desktop contract details overlay verification.
     * Uses the `.dc-page-overlay` + `#dt_contract_drawer` structure.
     */
    private async verifyContractDetailsPageDesktop(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        buyDate: string,
        barrier?: string,
        barrierType?: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): Promise<string> {
        // Step 1: header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        // Step 2: contract card — market, trade type, currency
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        // Multipliers label renders as "MultipliersUp x200" — toContainText handles both plain and multipliers labels
        await expect(this.contractDetailsTradeType, `Contract card type should be "${tradeType}"`).toContainText(
            tradeType
        );
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );

        // Step 3: contract card — remaining time, progress bar, total profit/loss, contract value
        await expect(this.contractDetailsRemainingTime, 'Remaining time should have a value').not.toBeEmpty();
        await expect(this.contractDetailsProgressBar, 'Progress bar should be visible').toBeVisible();
        await expect(
            this.contractCardItem('Total profit/loss:'),
            'Total profit/loss should have a value'
        ).not.toBeEmpty();
        await expect(this.contractCardItem('Contract value:'), 'Contract value should have a value').not.toBeEmpty();

        // Step 4: contract card — stake and payout
        await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toHaveText(stake);
        await expect(this.contractCardItem('Potential payout:'), `Potential payout should be "${payout}"`).toHaveText(
            payout
        );

        // Step 5: sell button
        await expect(
            this.contractDetailsSellButton,
            'Sell button should be visible on the contract card'
        ).toBeVisible();

        // Step 6: Reference ID
        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        if (buyId) {
            await expect(this.contractDetailsReferenceID, `Reference ID should be "${buyId} (Buy)"`).toHaveText(
                `${buyId} (Buy)`
            );
        } else {
            await expect(this.contractDetailsReferenceID, 'Reference ID should have a value').not.toBeEmpty();
        }

        // Step 7: Duration
        const auditDuration = this.normaliseDurationForAudit(durationValue);
        await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText('Duration');
        await expect(this.contractDetailsDuration, `Duration should be "${auditDuration}"`).toHaveText(auditDuration);

        // Step 8: Start time
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);

        // Step 9: Entry spot (extract price for barrier assertion)
        await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
            'Entry spot'
        );
        const entrySpot = (await this.contractDetailsEntrySpot.innerText()).trim();
        await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsEntrySpotTime, `Entry spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        // Step 10: Barrier
        await expect(this.contractDetailsBarrierLabel, 'Barrier label should be "Barrier"').toHaveText('Barrier');
        if (tradeType === 'Rise' || tradeType === 'Fall') {
            await expect(this.contractDetailsBarrier, `Barrier should match entry spot "${entrySpot}"`).toHaveText(
                entrySpot
            );
        } else if (
            tradeType === 'Higher' ||
            tradeType === 'Lower' ||
            tradeType === 'Touch' ||
            tradeType === 'No Touch'
        ) {
            if (!barrier || !barrierType) {
                throw new Error(`barrier and barrierType are required for ${tradeType} contracts`);
            }
            const expectedBarrier = this.calculateBarrier(entrySpot, barrier, barrierType);
            await expect(this.contractDetailsBarrier, `Barrier should be "${expectedBarrier}"`).toHaveText(
                expectedBarrier
            );
        } else {
            await expect(this.contractDetailsBarrier, 'Barrier should have a value').not.toBeEmpty();
        }

        return entrySpot;
    }

    /**
     * Read the buy Reference ID from the contract details page (open or closed), stripped of the
     * " (Buy)" suffix. Viewport-aware. Capture this from the OPEN position right after purchase so
     * later closed-state checks target the same contract (important on shared accounts with history).
     *
     * @returns The buy reference ID, e.g. "1071599"
     */
    async getBuyReferenceId(): Promise<string> {
        if (this.isMobile) {
            const refIdValueCell = this.page
                .locator('.order-details__table-row', {
                    has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
                })
                .locator('.order-details__table-row-cell')
                .last();
            const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
            await expect(
                buyRefIdParagraph,
                'Buy Reference ID should be visible on the contract details page'
            ).toBeVisible();
            return (await buyRefIdParagraph.innerText()).trim().replace(' (Buy)', '');
        }
        await expect(
            this.contractDetailsReferenceID,
            'Buy Reference ID should be visible on the contract details page'
        ).toBeVisible();
        return (await this.contractDetailsReferenceID.innerText()).trim().replace(' (Buy)', '');
    }

    /**
     * Read the sell Reference ID from a settled contract's details page, stripped of the " (Sell)"
     * suffix. Viewport-aware. Mirror of {@link getBuyReferenceId}; use to cross-check the Reports
     * Statement sell row for contracts closed without a captured open reference ID.
     *
     * @returns The sell reference ID, e.g. "1071699"
     */
    async getSellReferenceId(): Promise<string> {
        if (this.isMobile) {
            const sellRefIdParagraph = this.page
                .locator('.order-details__table-row', {
                    has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
                })
                .locator('.order-details__table-row-cell')
                .last()
                .locator('p')
                .filter({ hasText: '(Sell)' });
            await expect(
                sellRefIdParagraph,
                'Sell Reference ID should be visible on the closed contract details page'
            ).toBeVisible();
            return (await sellRefIdParagraph.innerText()).trim().replace(' (Sell)', '');
        }
        await expect(
            this.contractDetailsReferenceIDSell,
            'Sell Reference ID should be visible on the closed contract details page'
        ).toBeVisible();
        return (await this.contractDetailsReferenceIDSell.innerText()).trim().replace(' (Sell)', '');
    }

    /**
     * Wait, on the contract details page of the currently-open contract, for it to settle in place.
     * Settlement is detected by the Sell reference ID appearing in the audit grid. Use for short
     * (tick-duration) contracts so the SAME contract is verified after it auto-expires.
     */
    async waitForContractSettled(): Promise<void> {
        if (this.isMobile) {
            const sellRefIdParagraph = this.page
                .locator('.order-details__table-row', {
                    has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
                })
                .locator('.order-details__table-row-cell')
                .last()
                .locator('p')
                .filter({ hasText: '(Sell)' });
            await expect(
                sellRefIdParagraph,
                'Contract should settle in place (Sell reference ID should appear)'
            ).toBeVisible({ timeout: 120_000 });
            return;
        }
        await expect(
            this.contractDetailsReferenceIDSell,
            'Contract should settle in place (Sell reference ID should appear)'
        ).not.toBeEmpty({ timeout: 120_000 });
    }

    /**
     * Verify the settled (closed) details page for a digit contract (Matches/Differs, Over/Under, Even/Odd).
     *
     * Digit contracts render a different audit grid than directional contracts: there is **no Entry spot**
     * and **no Barrier** — instead a **Target** row (`dt_bt_label`) shows the prediction, e.g. "Equals 5"
     * (Matches), "Over 5"/"Under 5" (Over/Under), or "Even"/"Odd" (Even/Odd). Everything else (Reference
     * IDs, Duration, Start time, Exit spot, Exit time) matches.
     *
     * @param market           - Market symbol, e.g. "Volatility 10 Index"
     * @param tradeType        - Contract type name, e.g. "Matches", "Over", "Even"
     * @param currency         - Currency badge, e.g. "USD"
     * @param stake            - Stake as displayed, e.g. "10.00"
     * @param payout           - Potential payout as displayed
     * @param buyId            - Buy reference ID to assert (read via {@link getBuyReferenceId})
     * @param durationValue    - Ticks duration, e.g. "5 ticks"
     * @param buyDate          - UTC date captured before buy, e.g. "2026-07-09"
     * @param profitLossAmount - Settled profit/loss from the Closed positions tab, e.g. "-10.00 USD"
     * @param targetText       - Substring the Target row must contain — the digit ("5") for digit-prediction
     *                           types, or the outcome ("Even"/"Odd") for Even/Odd
     * @returns The extracted sell reference ID
     */
    async verifyClosedDigitContractDetailsPage(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        buyDate: string,
        profitLossAmount: string,
        targetText: string
    ): Promise<string> {
        const auditDuration = this.normaliseDurationForAudit(durationValue);
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();

        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        if (this.isMobile) {
            // Contract card
            await expect(this.mobileContractMarket, `Closed contract card should show market "${market}"`).toHaveText(
                market
            );
            await expect(
                this.mobileContractTradeType,
                `Closed contract card should show trade type "${tradeType}"`
            ).toHaveText(tradeType);
            await expect(this.mobileContractProfit, 'Closed contract profit/loss should have a value').not.toBeEmpty();

            // Reference ID row — buy + sell paragraphs in the same value cell
            const refIdValueCell = this.page
                .locator('.order-details__table-row', {
                    has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
                })
                .locator('.order-details__table-row-cell')
                .last();
            const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
            const sellRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Sell)' });
            await expect(buyRefIdParagraph, `Buy Reference ID should contain "${buyId} (Buy)"`).toContainText(
                `${buyId} (Buy)`
            );
            await expect(sellRefIdParagraph, 'Sell Reference ID should have a value').toContainText('(Sell)');
            const sellId = (await sellRefIdParagraph.innerText()).trim().replace(' (Sell)', '');

            // Order details
            await expect(this.mobileOrderDetailsValue('Duration'), `Duration should be "${auditDuration}"`).toHaveText(
                auditDuration
            );
            await expect(this.mobileOrderDetailsValue('Target'), `Target should contain "${targetText}"`).toContainText(
                targetText
            );
            await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${stake}"`).toContainText(stake);
            // parseFloat strips trailing zeros ("19.20" → "19.2") to match how the app renders the payout,
            // consistent with the open-contract mobile path above.
            await expect(
                this.mobileOrderDetailsValue('Potential payout'),
                `Potential payout should contain "${payout}"`
            ).toContainText(parseFloat(payout).toString());

            // Close button should be gone on a settled contract
            await expect(
                this.mobileContractDetailsCloseButton,
                'Close button should not be visible on a closed contract'
            ).not.toBeVisible();

            return sellId;
        }

        // Desktop — contract card summary
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.contractDetailsTradeType, `Contract card type should be "${tradeType}"`).toContainText(
            tradeType
        );
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );
        await expect(
            this.contractDetailsRemainingTime,
            'Remaining time should not be visible on a closed contract'
        ).not.toBeVisible();
        await expect(
            this.contractCardItem('Total profit/loss:'),
            `Total profit/loss should contain "${profitLossNumeric}"`
        ).toContainText(profitLossNumeric);
        const expectedContractValue = this.calculateClosedContractValue(stake, profitLossAmount);
        await expect(
            this.contractCardItem('Contract value:'),
            `Contract value should be "${expectedContractValue}"`
        ).toHaveText(expectedContractValue);
        await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toHaveText(stake);
        await expect(this.contractCardItem('Potential payout:'), `Potential payout should be "${payout}"`).toHaveText(
            payout
        );
        await expect(
            this.contractDetailsSellButton,
            'Sell button should not be visible on a closed contract'
        ).not.toBeVisible();

        // Reference IDs
        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, `Buy reference ID should be "${buyId} (Buy)"`).toHaveText(
            `${buyId} (Buy)`
        );
        await expect(this.contractDetailsReferenceIDSell, 'Sell reference ID should have a value').not.toBeEmpty();
        const sellId = (await this.contractDetailsReferenceIDSell.innerText()).trim().replace(' (Sell)', '');

        // Duration
        await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText('Duration');
        await expect(this.contractDetailsDuration, `Duration should be "${auditDuration}"`).toHaveText(auditDuration);

        // Target (digit prediction) — reuses the barrier audit row (dt_bt_label) with a "Target" label
        await expect(this.contractDetailsBarrierLabel, 'Target label should be "Target"').toHaveText('Target');
        await expect(this.contractDetailsBarrier, `Target should contain "${targetText}"`).toContainText(targetText);

        // Start time
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);

        // Exit spot + Exit time (digit contracts have no Entry spot)
        await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
            'Exit spot'
        );
        await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsExitSpotTime, `Exit spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );
        await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
            'Exit time'
        );
        await expect(this.contractDetailsExitTime, `Exit time should contain "${buyDate}"`).toContainText(buyDate);

        return sellId;
    }

    /**
     * Verify the contract details page for a closed contract.
     * Delegates to the mobile or desktop implementation based on the current viewport.
     *
     * @param market           - Market symbol, e.g. "Volatility 100 (1s) Index"
     * @param tradeType        - Contract type label, e.g. "Rise"
     * @param currency         - Currency badge (desktop only), e.g. "USD"
     * @param stake            - Stake as displayed, e.g. "10.00"
     * @param payout           - Potential payout as displayed, e.g. "19.29"
     * @param buyId            - Buy reference ID, e.g. "1071659"
     * @param durationValue    - Duration chip label, e.g. "15 min" (normalised internally)
     * @param buyDate          - UTC date captured before buy, e.g. "2026-06-18"
     * @param profitLossAmount - P&L from the closed positions card, e.g. "+1.26 USD" or "-2.05 USD"
     * @param entrySpot        - Entry spot price from the open contract details, e.g. "9,585.02"
     * @returns The sell reference ID string (desktop) or empty string (mobile)
     */
    async verifyClosedContractDetailsPage(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        buyDate: string,
        profitLossAmount: string,
        entrySpot: string,
        barrier?: string,
        barrierType?: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): Promise<string> {
        if (this.isMobile) {
            return this.verifyClosedContractDetailsPageMobile(
                market,
                tradeType,
                stake,
                payout,
                buyId,
                durationValue,
                buyDate,
                profitLossAmount,
                entrySpot,
                barrier,
                barrierType
            );
        }
        return this.verifyClosedContractDetailsPageDesktop(
            market,
            tradeType,
            currency,
            stake,
            payout,
            buyId,
            durationValue,
            buyDate,
            profitLossAmount,
            entrySpot,
            barrier,
            barrierType
        );
    }

    /**
     * Mobile closed contract details verification.
     * After sell, the contract details page shows settled values in Order Details and
     * Entry & exit details sections. The Close button is gone; no sell button.
     */
    private async verifyClosedContractDetailsPageMobile(
        market: string,
        tradeType: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        _buyDate: string,
        _profitLossAmount: string,
        entrySpot: string,
        barrier?: string,
        barrierType?: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): Promise<string> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header should show "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, trade type, profit
        await expect(
            this.mobileContractMarket,
            `Mobile closed contract card should show market "${market}"`
        ).toHaveText(market);
        await expect(
            this.mobileContractTradeType,
            `Mobile closed contract card should show trade type "${tradeType}"`
        ).toHaveText(tradeType);
        await expect(
            this.mobileContractProfit,
            'Mobile closed contract card profit/loss should have a value'
        ).not.toBeEmpty();

        // Order Details — Reference ID: single row whose value cell contains both
        // Buy and Sell IDs as separate paragraphs (e.g. "1092759 (Buy)" / "1092779 (Sell)").
        const refIdValueCell = this.page
            .locator('.order-details__table-row', {
                has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
            })
            .locator('.order-details__table-row-cell')
            .last();

        const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
        const sellRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Sell)' });

        await expect(buyRefIdParagraph, `Buy Reference ID should contain "${buyId} (Buy)"`).toContainText(
            `${buyId} (Buy)`
        );
        await expect(sellRefIdParagraph, 'Sell Reference ID should contain "(Sell)"').toContainText('(Sell)');

        const sellRefIdRaw = (await sellRefIdParagraph.innerText()).trim();
        const sellId = sellRefIdRaw.replace(' (Sell)', '');

        // Order Details — Duration
        const auditDuration = this.normaliseDurationForAudit(durationValue);
        await expect(this.mobileOrderDetailsValue('Duration'), `Duration should be "${auditDuration}"`).toHaveText(
            auditDuration
        );

        // Order Details — Stake and Potential payout
        await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${stake}"`).toContainText(stake);
        await expect(
            this.mobileOrderDetailsValue('Potential payout'),
            `Potential payout should contain "${payout}"`
        ).toContainText(parseFloat(payout).toString());

        // Entry & exit details present (needed before barrier calculation for Higher/Lower)
        await expect(this.mobileEntryExitDetails, 'Entry & exit details section should be visible').toBeVisible();

        // Order Details — Barrier
        if (tradeType === 'Rise' || tradeType === 'Fall') {
            await expect(this.mobileOrderDetailsValue('Barrier'), `Barrier should be "${entrySpot}"`).toContainText(
                entrySpot.replace(/,/g, '')
            );
        } else if (
            tradeType === 'Higher' ||
            tradeType === 'Lower' ||
            tradeType === 'Touch' ||
            tradeType === 'No Touch'
        ) {
            if (!barrier || !barrierType) {
                throw new Error(`barrier and barrierType are required for ${tradeType} contracts`);
            }
            const expectedBarrier = this.calculateBarrier(entrySpot, barrier, barrierType);
            await expect(
                this.mobileOrderDetailsValue('Barrier'),
                `Barrier should be "${expectedBarrier}"`
            ).toContainText(expectedBarrier.replace(/,/g, ''));
        } else {
            await expect(this.mobileOrderDetailsValue('Barrier'), 'Barrier should have a value').not.toBeEmpty();
        }

        // Close button should be gone (contract already settled)
        await expect(
            this.mobileContractDetailsCloseButton,
            'Close button should not be visible on a closed contract'
        ).not.toBeVisible();

        return sellId;
    }

    /**
     * Desktop closed contract details overlay verification.
     */
    private async verifyClosedContractDetailsPageDesktop(
        market: string,
        tradeType: string,
        currency: string,
        stake: string,
        payout: string,
        buyId: string,
        durationValue: string,
        buyDate: string,
        profitLossAmount: string,
        entrySpot: string,
        barrier?: string,
        barrierType?: 'Above spot' | 'Below spot' | 'Fixed barrier'
    ): Promise<string> {
        // Step 1: header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        // Step 2: contract card — market, trade type, currency
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        // Multipliers label renders as "MultipliersUp x200" — toContainText handles both plain and multipliers labels
        await expect(this.contractDetailsTradeType, `Contract card type should be "${tradeType}"`).toContainText(
            tradeType
        );
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );

        // Step 3: no remaining time on closed contracts
        await expect(
            this.contractDetailsRemainingTime,
            'Remaining time should not be visible on a closed contract'
        ).not.toBeVisible();

        // Step 4: contract card — settled values
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        await expect(
            this.contractCardItem('Total profit/loss:'),
            `Total profit/loss should contain "${profitLossNumeric}"`
        ).toContainText(profitLossNumeric);
        const expectedContractValue = this.calculateClosedContractValue(stake, profitLossAmount);
        await expect(
            this.contractCardItem('Contract value:'),
            `Contract value should be "${expectedContractValue}"`
        ).toHaveText(expectedContractValue);

        // Step 5: stake and payout
        await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toHaveText(stake);
        await expect(this.contractCardItem('Potential payout:'), `Potential payout should be "${payout}"`).toHaveText(
            payout
        );

        // Step 6: no sell button on closed contracts
        await expect(
            this.contractDetailsSellButton,
            'Sell button should not be visible on a closed contract'
        ).not.toBeVisible();

        // Step 7: Reference ID — buy row (assert) + sell row (extract then assert)
        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, `Buy reference ID should be "${buyId} (Buy)"`).toHaveText(
            `${buyId} (Buy)`
        );
        await expect(this.contractDetailsReferenceIDSell, 'Sell reference ID should have a value').not.toBeEmpty();
        const sellIdText = (await this.contractDetailsReferenceIDSell.innerText()).trim();
        const sellId = sellIdText.replace(' (Sell)', '');

        // Step 8: Duration
        const auditDuration = this.normaliseDurationForAudit(durationValue);
        await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText('Duration');
        await expect(this.contractDetailsDuration, `Duration should be "${auditDuration}"`).toHaveText(auditDuration);

        // Step 9: Start time
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);

        // Step 10: Entry spot — read settled value from page (used for Higher/Lower barrier calculation)
        await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
            'Entry spot'
        );
        await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
        const settledEntrySpot = (await this.contractDetailsEntrySpot.innerText()).trim();
        await expect(this.contractDetailsEntrySpotTime, `Entry spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        // Step 11: Barrier
        await expect(this.contractDetailsBarrierLabel, 'Barrier label should be "Barrier"').toHaveText('Barrier');
        if (tradeType === 'Rise' || tradeType === 'Fall') {
            await expect(this.contractDetailsBarrier, `Barrier should match entry spot "${entrySpot}"`).toHaveText(
                entrySpot
            );
        } else if (
            tradeType === 'Higher' ||
            tradeType === 'Lower' ||
            tradeType === 'Touch' ||
            tradeType === 'No Touch'
        ) {
            if (!barrier || !barrierType) {
                throw new Error(`barrier and barrierType are required for ${tradeType} contracts`);
            }
            const expectedBarrier = this.calculateBarrier(settledEntrySpot, barrier, barrierType);
            await expect(this.contractDetailsBarrier, `Barrier should be "${expectedBarrier}"`).toHaveText(
                expectedBarrier
            );
        } else {
            await expect(this.contractDetailsBarrier, 'Barrier should have a value').not.toBeEmpty();
        }

        // Step 12: Exit spot
        await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
            'Exit spot'
        );
        await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsExitSpotTime, `Exit spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        // Step 13: Exit time
        await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
            'Exit time'
        );
        await expect(this.contractDetailsExitTime, `Exit time should contain "${buyDate}"`).toContainText(buyDate);

        return sellId;
    }

    // ============================================
    // MULTIPLIERS CONTRACT DETAILS VERIFICATIONS
    // ============================================

    /**
     * Verify the open Multipliers contract details page.
     * Delegates to desktop or mobile based on the current viewport.
     *
     * @param market      - Market symbol, e.g. "Volatility 100 (1s) Index"
     * @param direction   - "Up" or "Down"
     * @param currency    - Currency badge, e.g. "USD"
     * @param stake       - Stake as displayed, e.g. "20.00"
     * @param multiplier  - Multiplier as displayed, e.g. "x200"
     * @param buyDate     - UTC date captured before buy, e.g. "2026-07-07"
     * @param dealCancellationBuyPrice - Buy-button Total cost when Deal Cancellation is active
     *          (displayed as Stake). Omit when DC is not set.
     * @returns Object containing the extracted `buyId` (reference ID), `entrySpot` (entry price),
     *          and `commission` (captured here so the closed details page can assert the same value).
     */
    async verifyMultipliersContractDetailsPage(
        market: string,
        direction: 'Up' | 'Down',
        currency: string,
        stake: string,
        multiplier: string,
        buyDate: string,
        takeProfit?: string | null,
        stopLoss?: string | null,
        dealCancellationBuyPrice?: string
    ): Promise<{ buyId: string; entrySpot: string; commission: string }> {
        return this.isMobile
            ? this.verifyMultipliersContractDetailsMobile(
                  market,
                  direction,
                  stake,
                  multiplier,
                  buyDate,
                  takeProfit,
                  stopLoss,
                  dealCancellationBuyPrice
              )
            : this.verifyMultipliersContractDetailsDesktop(
                  market,
                  direction,
                  currency,
                  stake,
                  multiplier,
                  buyDate,
                  takeProfit,
                  stopLoss,
                  dealCancellationBuyPrice
              );
    }

    /**
     * Verify the closed Multipliers contract details page.
     * Delegates to desktop or mobile based on the current viewport.
     *
     * @param market           - Market symbol, e.g. "Volatility 100 (1s) Index"
     * @param direction        - "Up" or "Down"
     * @param currency         - Currency badge, e.g. "USD"
     * @param stake            - Stake as displayed, e.g. "20.00"
     * @param multiplier       - Multiplier as displayed, e.g. "x200"
     * @param buyId            - Buy reference ID
     * @param buyDate          - UTC date captured before buy, e.g. "2026-07-07"
     * @param profitLossAmount - P&L from the closed positions card, e.g. "+1.26 USD"
     * @param entrySpot        - Entry spot captured from the open contract details page
     * @param stopOut          - Stop out amount captured before buy, numeric (e.g. "20.00").
     *                           Mobile Order Details still renders Money as "-20.00 USD".
     * @param commission       - Commission captured from the open contract details page, e.g. "0.15 USD"
     * @param dealCancellationBuyPrice - Buy-button Total cost when Deal Cancellation was used.
     * @returns Sell reference ID string
     */
    async verifyClosedMultipliersContractDetailsPage(
        market: string,
        direction: 'Up' | 'Down',
        currency: string,
        stake: string,
        multiplier: string,
        buyId: string,
        buyDate: string,
        profitLossAmount: string,
        entrySpot: string,
        stopOut: string,
        commission: string,
        takeProfit?: string | null,
        stopLoss?: string | null,
        dealCancellationBuyPrice?: string
    ): Promise<string> {
        return this.isMobile
            ? this.verifyClosedMultipliersContractDetailsMobile(
                  market,
                  direction,
                  stake,
                  multiplier,
                  buyId,
                  buyDate,
                  profitLossAmount,
                  entrySpot,
                  stopOut,
                  commission,
                  takeProfit,
                  stopLoss,
                  dealCancellationBuyPrice
              )
            : this.verifyClosedMultipliersContractDetailsDesktop(
                  market,
                  direction,
                  currency,
                  stake,
                  multiplier,
                  buyId,
                  buyDate,
                  profitLossAmount,
                  entrySpot,
                  commission,
                  takeProfit,
                  stopLoss,
                  dealCancellationBuyPrice
              );
    }

    private async verifyMultipliersContractDetailsDesktop(
        market: string,
        direction: 'Up' | 'Down',
        currency: string,
        stake: string,
        multiplier: string,
        buyDate: string,
        takeProfit?: string | null,
        stopLoss?: string | null,
        dealCancellationBuyPrice?: string
    ): Promise<{ buyId: string; entrySpot: string; commission: string }> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, type label, trade param, currency
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.multContractTypeLabel, 'Contract type should be "Multipliers"').toHaveText('Multipliers');
        await expect(
            this.multContractTradeParam,
            `Trade param should contain direction "${direction}" and multiplier "${multiplier}"`
        ).toHaveText(`${direction} ${multiplier}`);
        await expect(this.contractDetailsCurrency, `Currency badge should be "${currency}"`).toHaveText(currency);

        // Live card values
        await expect(this.contractCardItem('Contract cost:'), `Contract cost should be "${stake}"`).toContainText(
            stake
        );
        await expect(this.contractCardItem('Contract value:'), 'Contract value should have a value').not.toBeEmpty();
        let dealCancelFee = '';
        if (dealCancellationBuyPrice) {
            await expect(
                this.contractCardItem('Deal cancel. fee:'),
                'Deal cancel. fee should show a fee amount while Deal Cancellation is active'
            ).not.toHaveText('-');
            dealCancelFee = parseFloat(
                (await this.contractCardItem('Deal cancel. fee:').innerText()).replace(/,/g, '').replace(/[^\d.]/g, '')
            ).toFixed(2);
            await expect(
                this.contractCardItem('Stake:'),
                `Stake should equal the pre-purchase Total cost "${dealCancellationBuyPrice}"`
            ).toContainText(dealCancellationBuyPrice);
        } else {
            await expect(
                this.contractCardItem('Deal cancel. fee:'),
                'Deal cancel. fee should be "-" (not set)'
            ).toHaveText('-');
            await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toContainText(stake);
        }
        if (takeProfit) {
            await expect(this.contractCardItem('Take profit:'), `Take profit should show "${takeProfit}"`).toHaveText(
                takeProfit
            );
        } else {
            await expect(this.contractCardItem('Take profit:'), 'Take profit should be "-" (not set)').toHaveText('-');
        }
        if (stopLoss) {
            // The UI renders SL as "-15.00 " (negative sign + trailing space from a child <strong>).
            // Pass a regex to toHaveText so leading/trailing whitespace is handled automatically.
            await expect(this.contractCardItem('Stop loss:'), `Stop loss should show "-${stopLoss}"`).toHaveText(
                new RegExp(`^-${stopLoss}\\s*$`)
            );
        } else {
            await expect(this.contractCardItem('Stop loss:'), 'Stop loss should be "-" (not set)').toHaveText('-');
        }
        if (dealCancellationBuyPrice) {
            await expect(
                this.multTpSlEditToggle,
                'TP/SL edit should be disabled while Deal Cancellation is active'
            ).toBeDisabled();
        }
        await expect(
            this.contractCardItem('Total profit/loss:'),
            'Total profit/loss should have a value'
        ).not.toBeEmpty();

        // Close button visible (open contract)
        await expect(
            this.multContractDetailsCloseButton,
            'Close button should be visible on the open Multipliers contract'
        ).toBeVisible();

        // Audit grid — Reference ID (extract and return)
        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, 'Reference ID should have a value').not.toBeEmpty();
        const buyIdText = (await this.contractDetailsReferenceID.innerText()).trim();
        const buyId = buyIdText.replace(' (Buy)', '');

        // Audit grid — Commission (Multipliers-specific)
        await expect(this.multContractDetailsCommission, 'Commission should have a value from the API').not.toBeEmpty();
        const commission = (await this.multContractDetailsCommission.innerText()).trim();

        // Audit grid — Deal cancellation (active), rendered directly under Commission
        if (dealCancelFee) {
            await expect(
                this.dealCancellationAuditLabel,
                'Audit grid under Commission should show Deal cancellation (active)'
            ).toHaveText('Deal cancellation (active)');
            await expect(
                this.dealCancellationAuditValue,
                `Deal cancellation (active) fee should be "${dealCancelFee}"`
            ).toContainText(dealCancelFee);
        }

        // Audit grid — Start time
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);

        // Audit grid — Entry spot
        await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
            'Entry spot'
        );
        await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
        const entrySpot = (await this.contractDetailsEntrySpot.innerText()).trim();
        await expect(this.contractDetailsEntrySpotTime, `Entry spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        // TP & SL History tab
        await this.multTpSlHistoryTab.click();
        if (takeProfit || stopLoss) {
            await expect(
                this.multTpSlHistoryEmptyHeader,
                'TP/SL history should NOT show "No history" when TP or SL is set'
            ).not.toBeVisible();
            // Entries appear in reverse-chronological order; index 0 is the most recent change.
            // When both TP and SL are set in one save, they may appear as separate entries.
            let entryIndex = 0;
            if (takeProfit) {
                await expect(
                    this.multTpSlHistoryEntryLabel(entryIndex),
                    `History entry ${entryIndex} label should be "Take profit"`
                ).toHaveText('Take profit');
                await expect(
                    this.multTpSlHistoryEntryValue(entryIndex),
                    `History entry ${entryIndex} value should contain "${takeProfit}"`
                ).toContainText(takeProfit);
                await expect(
                    this.multTpSlHistoryEntryDate(entryIndex),
                    `History entry ${entryIndex} date should contain "${buyDate}"`
                ).toContainText(buyDate);
                entryIndex++;
            }
            if (stopLoss) {
                await expect(
                    this.multTpSlHistoryEntryLabel(entryIndex),
                    `History entry ${entryIndex} label should be "Stop loss"`
                ).toHaveText('Stop loss');
                await expect(
                    this.multTpSlHistoryEntryValue(entryIndex),
                    `History entry ${entryIndex} value should contain "${stopLoss}"`
                ).toContainText(stopLoss);
                await expect(
                    this.multTpSlHistoryEntryDate(entryIndex),
                    `History entry ${entryIndex} date should contain "${buyDate}"`
                ).toContainText(buyDate);
            }
        } else {
            await expect(
                this.multTpSlHistoryEmptyHeader,
                '"No history" should be shown when no TP/SL is set'
            ).toHaveText('No history');
            await expect(
                this.multTpSlHistoryEmptyDescription,
                'Empty state description should indicate no TP/SL has been set'
            ).toHaveText('You have yet to update either take profit or stop loss');
        }

        // Restore Details tab so follow-up checks (e.g. verifyDealCancellationAvailable) see the audit grid.
        await this.multDetailsTab.click();

        return { buyId, entrySpot, commission };
    }

    private async verifyMultipliersContractDetailsMobile(
        market: string,
        direction: 'Up' | 'Down',
        stake: string,
        multiplier: string,
        buyDate: string,
        takeProfit?: string | null,
        stopLoss?: string | null,
        dealCancellationBuyPrice?: string
    ): Promise<{ buyId: string; entrySpot: string; commission: string }> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header should show "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, trade type, stake, profit/loss
        await expect(this.mobileContractMarket, `Mobile contract card should show market "${market}"`).toHaveText(
            market
        );
        await expect(
            this.mobileContractTradeType,
            `Mobile contract card should show "Multipliers ${direction}"`
        ).toHaveText(`Multipliers ${direction}`);
        const displayedStake = dealCancellationBuyPrice ?? stake;
        await expect(
            this.mobileContractCardStake,
            `Mobile contract card should show stake "${displayedStake} USD"`
        ).toHaveText(`${displayedStake} USD`);
        await expect(this.mobileContractProfit, 'Mobile profit/loss should have a value').not.toBeEmpty();

        // Contract card — TP/SL badges (visible only when the respective param is active)
        if (takeProfit) {
            await expect(
                this.mobileContractCardTpBadge,
                'TP badge should be visible when take profit is set'
            ).toBeVisible();
        } else {
            await expect(
                this.mobileContractCardTpBadge,
                'TP badge should not be visible when take profit is not set'
            ).not.toBeVisible();
        }
        if (stopLoss) {
            await expect(
                this.mobileContractCardSlBadge,
                'SL badge should be visible when stop loss is set'
            ).toBeVisible();
        } else {
            await expect(
                this.mobileContractCardSlBadge,
                'SL badge should not be visible when stop loss is not set'
            ).not.toBeVisible();
        }

        // Risk management card — TP/SL toggles and input values
        await expect(
            this.mobileRiskManagementTpToggle,
            `TP toggle should be ${takeProfit ? 'on' : 'off'}`
        ).toHaveAttribute('aria-pressed', takeProfit ? 'true' : 'false');
        await expect(
            this.mobileRiskManagementSlToggle,
            `SL toggle should be ${stopLoss ? 'on' : 'off'}`
        ).toHaveAttribute('aria-pressed', stopLoss ? 'true' : 'false');
        if (dealCancellationBuyPrice) {
            await expect(
                this.mobileRiskManagementTpToggle,
                'TP toggle should be disabled while Deal Cancellation is active'
            ).toBeDisabled();
            await expect(
                this.mobileRiskManagementSlToggle,
                'SL toggle should be disabled while Deal Cancellation is active'
            ).toBeDisabled();
        }
        if (takeProfit) {
            await expect(this.mobileRiskManagementTpInput, `TP input should show "${takeProfit} USD"`).toHaveValue(
                `${takeProfit} USD`
            );
        }
        if (stopLoss) {
            // The app renders the SL input value with a leading negative sign: "-10.00 USD"
            await expect(this.mobileRiskManagementSlInput, `SL input should show "-${stopLoss} USD"`).toHaveValue(
                `-${stopLoss} USD`
            );
        }

        // Order Details — Reference ID (extract and return)
        await expect(this.mobileOrderDetailsValue('Reference ID'), 'Reference ID should have a value').not.toBeEmpty();
        const refIdText = (await this.mobileOrderDetailsValue('Reference ID').innerText()).trim();
        const buyId = refIdText.replace(' (Buy)', '').trim();

        // Order Details — Multiplier
        await expect(
            this.mobileOrderDetailsValue('Multiplier'),
            `Multiplier should contain "${multiplier}"`
        ).toContainText(multiplier);

        // Order Details — Stake
        await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${displayedStake}"`).toContainText(
            displayedStake
        );

        // Order Details — Commission. Rendered here from the API — capture it now to assert the same
        // value on the closed page later.
        await expect(
            this.mobileOrderDetailsValue('Commission'),
            'Commission should have a value from the API'
        ).not.toBeEmpty();
        const commission = (await this.mobileOrderDetailsValue('Commission').innerText()).trim();

        if (dealCancellationBuyPrice) {
            await expect(
                this.mobileOrderDetailsValue('Deal cancellation fees'),
                'Deal cancellation fees should show an active fee'
            ).toContainText('(active)');
        }

        // Order Details — Take profit (when set)
        if (takeProfit) {
            await expect(
                this.mobileOrderDetailsValue('Take profit'),
                `Take profit should contain "${takeProfit}"`
            ).toContainText(takeProfit);
        }

        // Order Details — Stop loss (when set)
        if (stopLoss) {
            await expect(
                this.mobileOrderDetailsValue('Stop loss'),
                `Stop loss should contain "${stopLoss}"`
            ).toContainText(stopLoss);
        }

        // Entry & exit details — Start time
        const startTimeRow = this.page.locator('.entry-exit-details__table-row', {
            has: this.page.locator('.entry-exit-details__table-cell', { hasText: 'Start time' }),
        });
        await expect(startTimeRow, 'Start time row should be visible').toBeVisible();
        const startTimeCell = startTimeRow.locator('.entry-exit-details__table-cell').last();
        // The Start time cell renders the date as "DD Mon YYYY" (e.g. "14 Jul 2026"), not raw ISO —
        // format the captured ISO buyDate to match (consistent with the other contract-details verifiers).
        const buyDateFormatted = TradeBasePage.formatISODate(buyDate);
        await expect(
            startTimeCell.locator('p').first(),
            `Start time date should contain "${buyDateFormatted}"`
        ).toContainText(buyDateFormatted);

        // Entry & exit details — Entry spot
        const entrySpotRow = this.page.locator('.entry-exit-details__table-row', {
            has: this.page.locator('.entry-exit-details__table-cell', { hasText: 'Entry spot' }),
        });
        await expect(entrySpotRow, 'Entry spot row should be visible').toBeVisible();
        const entrySpotCell = entrySpotRow.locator('.entry-exit-details__table-cell').last();
        await expect(entrySpotCell.locator('p').first(), 'Entry spot price should have a value').not.toBeEmpty();
        const entrySpot = (await entrySpotCell.locator('p').first().innerText()).trim();

        // TP & SL History section — the app renders this card only when the contract actually has
        // TP/SL history. A contract opened without TP/SL shows no history card (Order Details reads
        // "Take profit: Not set" / "Stop loss: Not set"), so assert the section only when one was set.
        if (takeProfit || stopLoss) {
            await expect(this.mobileTpSlHistoryTitle, 'TP & SL History section should be visible').toBeVisible();
            // Entries appear in reverse-chronological order; most recent change is row 0.
            // When both TP and SL are set in one save they appear as separate rows.
            let rowIndex = 0;
            if (takeProfit) {
                await expect(
                    this.mobileTpSlHistoryRowLabel(rowIndex),
                    `History row ${rowIndex} label should be "Take profit"`
                ).toHaveText('Take profit');
                await expect(
                    this.mobileTpSlHistoryRowValue(rowIndex),
                    `History row ${rowIndex} value should show "${takeProfit} USD"`
                ).toHaveText(`${takeProfit} USD`);
                rowIndex++;
            }
            if (stopLoss) {
                await expect(
                    this.mobileTpSlHistoryRowLabel(rowIndex),
                    `History row ${rowIndex} label should be "Stop loss"`
                ).toHaveText('Stop loss');
                // The app renders the SL history value with a leading negative sign: "-12.00 USD"
                await expect(
                    this.mobileTpSlHistoryRowValue(rowIndex),
                    `History row ${rowIndex} value should show "-${stopLoss} USD"`
                ).toHaveText(`-${stopLoss} USD`);
            }
        }

        // Close button visible
        await expect(
            this.mobileContractDetailsCloseButton,
            'Close button should be visible on the open Multipliers contract'
        ).toBeVisible();

        return { buyId, entrySpot, commission };
    }

    // Note: stopOut is not asserted here — the desktop closed contract page does not render
    // a "Stop out level" row (it is a pre-buy stake-details field, mobile Order Details only).
    private async verifyClosedMultipliersContractDetailsDesktop(
        market: string,
        direction: 'Up' | 'Down',
        currency: string,
        stake: string,
        multiplier: string,
        buyId: string,
        buyDate: string,
        profitLossAmount: string,
        entrySpot: string,
        commission: string,
        takeProfit?: string | null,
        stopLoss?: string | null,
        dealCancellationBuyPrice?: string
    ): Promise<string> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, type label, trade param, currency
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.multContractTypeLabel, 'Contract type should be "Multipliers"').toHaveText('Multipliers');
        await expect(
            this.multContractTradeParam,
            `Trade param should contain direction "${direction}" and multiplier "${multiplier}"`
        ).toHaveText(`${direction} ${multiplier}`);
        await expect(this.contractDetailsCurrency, `Currency badge should be "${currency}"`).toHaveText(currency);

        // Settled card values
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        await expect(this.contractCardItem('Contract cost:'), `Contract cost should be "${stake}"`).toContainText(
            stake
        );
        let dealCancelFee = '';
        if (dealCancellationBuyPrice) {
            await expect(
                this.contractCardItem('Deal cancel. fee:'),
                'Deal cancel. fee should show the fee after Deal Cancellation'
            ).not.toHaveText('-');
            dealCancelFee = parseFloat(
                (await this.contractCardItem('Deal cancel. fee:').innerText()).replace(/,/g, '').replace(/[^\d.]/g, '')
            ).toFixed(2);
            await expect(
                this.contractCardItem('Stake:'),
                `Stake should equal the pre-purchase Total cost "${dealCancellationBuyPrice}"`
            ).toContainText(dealCancellationBuyPrice);
            await expect(
                this.contractCardItem('Contract value:'),
                'After cancel, contract value should equal the refunded contract cost'
            ).toContainText(stake);
            await expect(
                this.contractCardItem('Total profit/loss:'),
                `Total profit/loss should equal the kept Deal cancel. fee "${dealCancelFee}"`
            ).toContainText(dealCancelFee);
        } else {
            await expect(
                this.contractCardItem('Total profit/loss:'),
                `Total profit/loss should contain "${profitLossNumeric}"`
            ).toContainText(profitLossNumeric);
        }
        if (takeProfit) {
            await expect(this.contractCardItem('Take profit:'), `Take profit should show "${takeProfit}"`).toHaveText(
                takeProfit
            );
        } else {
            await expect(this.contractCardItem('Take profit:'), 'Take profit should be "-" (not set)').toHaveText('-');
        }
        if (stopLoss) {
            // The UI renders SL as "-15.00 " (negative sign + trailing space from a child <strong>).
            // Pass a regex to toHaveText so leading/trailing whitespace is handled automatically.
            await expect(this.contractCardItem('Stop loss:'), `Stop loss should show "-${stopLoss}"`).toHaveText(
                new RegExp(`^-${stopLoss}\\s*$`)
            );
        } else {
            await expect(this.contractCardItem('Stop loss:'), 'Stop loss should be "-" (not set)').toHaveText('-');
        }

        // Close / Cancel buttons absent (contract settled)
        await expect(
            this.multContractDetailsCloseButton,
            'Close button should not be visible on a closed Multipliers contract'
        ).not.toBeVisible();
        await expect(
            this.dealCancellationButton,
            'Cancel button should not be visible on a closed Multipliers contract'
        ).not.toBeVisible();

        // Audit grid — Reference ID (buy + sell)
        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, `Buy reference ID should be "${buyId} (Buy)"`).toHaveText(
            `${buyId} (Buy)`
        );
        await expect(this.contractDetailsReferenceIDSell, 'Sell reference ID should have a value').not.toBeEmpty();
        const sellIdText = (await this.contractDetailsReferenceIDSell.innerText()).trim();
        const sellId = sellIdText.replace(' (Sell)', '');

        // Audit grid — Commission should match the value captured from the open contract details page
        await expect(
            this.multContractDetailsCommission,
            `Commission should match open-contract value "${commission}"`
        ).toHaveText(commission);

        if (dealCancelFee) {
            // Sold inside the DC window: getLabel() returns "Deal cancellation" (not "(executed)").
            await expect(
                this.dealCancellationAuditLabel,
                'Audit grid under Commission should show Deal cancellation'
            ).toHaveText('Deal cancellation');
            await expect(
                this.dealCancellationAuditValue,
                `Deal cancellation fee should be "${dealCancelFee}"`
            ).toContainText(dealCancelFee);
        }

        // Audit grid — Start time
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);

        // Audit grid — Entry spot
        await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
            'Entry spot'
        );
        await expect(this.contractDetailsEntrySpot, `Entry spot should be "${entrySpot}"`).toHaveText(entrySpot);

        // Audit grid — Exit spot
        await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
            'Exit spot'
        );
        await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();

        // Audit grid — Exit time
        await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
            'Exit time'
        );
        await expect(this.contractDetailsExitTime, `Exit time should contain "${buyDate}"`).toContainText(buyDate);

        return sellId;
    }

    private async verifyClosedMultipliersContractDetailsMobile(
        market: string,
        direction: 'Up' | 'Down',
        stake: string,
        multiplier: string,
        buyId: string,
        buyDate: string,
        profitLossAmount: string,
        entrySpot: string,
        stopOut: string,
        commission: string,
        takeProfit?: string | null,
        stopLoss?: string | null,
        dealCancellationBuyPrice?: string
    ): Promise<string> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header should show "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, trade type, profit/loss
        await expect(
            this.mobileContractMarket,
            `Mobile closed contract card should show market "${market}"`
        ).toHaveText(market);
        await expect(
            this.mobileContractTradeType,
            `Mobile closed contract card should contain direction "${direction}"`
        ).toContainText(direction);
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        await expect(this.mobileContractProfit, `Profit/loss should contain "${profitLossNumeric}"`).toContainText(
            profitLossNumeric
        );

        // Order Details — Reference ID: buy + sell paragraphs
        const refIdValueCell = this.page
            .locator('.order-details__table-row', {
                has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
            })
            .locator('.order-details__table-row-cell')
            .last();

        const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
        const sellRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Sell)' });

        await expect(buyRefIdParagraph, `Buy Reference ID should contain "${buyId} (Buy)"`).toContainText(
            `${buyId} (Buy)`
        );
        await expect(sellRefIdParagraph, 'Sell Reference ID should contain "(Sell)"').toContainText('(Sell)');

        const sellRefIdRaw = (await sellRefIdParagraph.innerText()).trim();
        const sellId = sellRefIdRaw.replace(' (Sell)', '');

        // Order Details — Multiplier and Stake
        await expect(
            this.mobileOrderDetailsValue('Multiplier'),
            `Multiplier should contain "${multiplier}"`
        ).toContainText(multiplier);
        const displayedStake = dealCancellationBuyPrice ?? stake;
        await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${displayedStake}"`).toContainText(
            displayedStake
        );

        // Order Details — Commission should match the value captured from the open contract details page
        await expect(
            this.mobileOrderDetailsValue('Commission'),
            `Commission should match open-contract value "${commission}"`
        ).toContainText(commission);

        if (dealCancellationBuyPrice) {
            await expect(
                this.mobileOrderDetailsValue('Deal cancellation fees'),
                'Deal cancellation fees should still show the fee after cancel'
            ).not.toBeEmpty();
        }

        // Order Details — Take profit / Stop loss
        if (takeProfit) {
            await expect(
                this.mobileOrderDetailsValue('Take profit'),
                `Take profit should contain "${takeProfit}"`
            ).toContainText(takeProfit);
        } else {
            await expect(this.mobileOrderDetailsValue('Take profit'), 'Take profit should be "Not set"').toHaveText(
                'Not set'
            );
        }
        if (stopLoss) {
            await expect(
                this.mobileOrderDetailsValue('Stop loss'),
                `Stop loss should contain "${stopLoss}"`
            ).toContainText(stopLoss);
        } else {
            await expect(this.mobileOrderDetailsValue('Stop loss'), 'Stop loss should be "Not set"').toHaveText(
                'Not set'
            );
        }

        // Order Details — Stop out level
        await expect(
            this.mobileOrderDetailsValue('Stop out level'),
            `Stop out level should match pre-buy value "${stopOut}"`
        ).toContainText(stopOut);

        // Entry & exit details section
        await expect(this.mobileEntryExitDetails, 'Entry & exit details section should be visible').toBeVisible();

        const entryExitRow = (label: string) =>
            this.page.locator('.entry-exit-details__table-row', {
                has: this.page.locator('.entry-exit-details__table-cell', { hasText: label }),
            });
        const entryExitValue = (label: string) => entryExitRow(label).locator('.entry-exit-details__table-cell').last();

        const buyDateFormatted = TradeBasePage.formatISODate(buyDate);

        // Start time
        await expect(entryExitRow('Start time'), 'Start time row should be visible').toBeVisible();
        await expect(
            entryExitValue('Start time').locator('p').first(),
            `Start time date should contain "${buyDateFormatted}"`
        ).toContainText(buyDateFormatted);
        await expect(
            entryExitValue('Start time').locator('p').last(),
            'Start time GMT should have a value'
        ).not.toBeEmpty();

        // Entry spot — exact value captured from open contract details
        await expect(entryExitRow('Entry spot'), 'Entry spot row should be visible').toBeVisible();
        await expect(
            entryExitValue('Entry spot').locator('p').first(),
            `Entry spot should be "${entrySpot}"`
        ).toHaveText(entrySpot);

        // Exit time
        await expect(entryExitRow('Exit time'), 'Exit time row should be visible').toBeVisible();
        await expect(
            entryExitValue('Exit time').locator('p').first(),
            `Exit time date should contain "${buyDateFormatted}"`
        ).toContainText(buyDateFormatted);
        await expect(
            entryExitValue('Exit time').locator('p').last(),
            'Exit time GMT should have a value'
        ).not.toBeEmpty();

        // Exit spot
        await expect(entryExitRow('Exit spot'), 'Exit spot row should be visible').toBeVisible();
        await expect(
            entryExitValue('Exit spot').locator('p').first(),
            'Exit spot price should have a value'
        ).not.toBeEmpty();

        // Close button absent (contract settled)
        await expect(
            this.mobileContractDetailsCloseButton,
            'Close button should not be visible on a closed contract'
        ).not.toBeVisible();

        return sellId;
    }

    // ============================================
    // ACCUMULATORS CONTRACT DETAILS VERIFICATIONS
    // ============================================

    /**
     * Verify the contract details page for a settled Accumulators contract.
     * Delegates to the mobile or desktop implementation based on the current viewport.
     *
     * Unlike Multipliers/Digits, Accumulators contract details are only ever opened once — after
     * settlement, from the Closed tab — so there is no earlier open-state reference ID to cross-check
     * against. Both IDs are therefore read from this page and returned, rather than taking `buyId` in.
     *
     * @param market           - Market symbol, e.g. "Volatility 100 Index"
     * @param growthRate       - Growth rate chip label, e.g. "5%"
     * @param currency         - Currency badge (desktop only), e.g. "USD"
     * @param stake            - Stake as displayed, e.g. "10.00"
     * @param buyDate          - UTC date captured before buy, e.g. "2026-08-03"
     * @param profitLossAmount - P&L from the closed positions card, e.g. "+1.26 USD" or "-2.05 USD"
     * @param takeProfit       - Take-profit amount if one was set, e.g. "4.00". Omit for the no-TP flow.
     * @returns The buy and sell reference IDs
     */
    async verifyClosedAccumulatorContractDetailsPage(
        market: string,
        growthRate: string,
        currency: string,
        stake: string,
        buyDate: string,
        profitLossAmount: string,
        takeProfit?: string | null
    ): Promise<{ buyId: string; sellId: string }> {
        return this.isMobile
            ? this.verifyClosedAccumulatorContractDetailsMobile(
                  market,
                  growthRate,
                  stake,
                  buyDate,
                  profitLossAmount,
                  takeProfit
              )
            : this.verifyClosedAccumulatorContractDetailsDesktop(
                  market,
                  growthRate,
                  currency,
                  stake,
                  buyDate,
                  profitLossAmount,
                  takeProfit
              );
    }

    private async verifyClosedAccumulatorContractDetailsDesktop(
        market: string,
        growthRate: string,
        currency: string,
        stake: string,
        buyDate: string,
        profitLossAmount: string,
        takeProfit?: string | null
    ): Promise<{ buyId: string; sellId: string }> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, type label, growth rate, currency
        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        await expect(this.accuContractTypeLabel, 'Contract type should be "Accumulators"').toHaveText('Accumulators');
        await expect(this.accuContractGrowthRate, `Growth rate chip should be "${growthRate}"`).toHaveText(growthRate);
        await expect(this.contractDetailsCurrency, `Currency badge should be "${currency}"`).toHaveText(currency);

        // Settled card values
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toHaveText(stake);
        await expect(
            this.contractCardItem('Total profit/loss:'),
            `Total profit/loss should contain "${profitLossNumeric}"`
        ).toContainText(profitLossNumeric);
        const expectedContractValue = this.calculateClosedContractValue(stake, profitLossAmount);
        await expect(
            this.contractCardItem('Contract value:'),
            `Contract value should be "${expectedContractValue}"`
        ).toHaveText(expectedContractValue);
        if (takeProfit) {
            await expect(this.contractCardItem('Take profit:'), `Take profit should show "${takeProfit}"`).toHaveText(
                takeProfit
            );
        } else {
            await expect(this.contractCardItem('Take profit:'), 'Take profit should be "-" (not set)').toHaveText('-');
        }

        // Audit grid — Reference ID (buy + sell)
        await expect(this.contractDetailsReferenceIDLabel, 'Reference ID label should be "Reference ID"').toHaveText(
            'Reference ID'
        );
        await expect(this.contractDetailsReferenceID, 'Buy reference ID should have a value').not.toBeEmpty();
        const buyIdText = (await this.contractDetailsReferenceID.innerText()).trim();
        const buyId = buyIdText.replace(' (Buy)', '');
        await expect(this.contractDetailsReferenceIDSell, 'Sell reference ID should have a value').not.toBeEmpty();
        const sellIdText = (await this.contractDetailsReferenceIDSell.innerText()).trim();
        const sellId = sellIdText.replace(' (Sell)', '');

        // Audit grid — Duration. Tick count is not predictable ahead of time (depends on how long the
        // contract ran before settling), so assert presence rather than an exact expected value.
        await expect(this.contractDetailsDurationLabel, 'Duration label should be "Duration"').toHaveText('Duration');
        await expect(this.contractDetailsDuration, 'Duration should have a value').not.toBeEmpty();

        // Audit grid — Start time
        await expect(this.contractDetailsStartTimeLabel, 'Start time label should be "Start time"').toHaveText(
            'Start time'
        );
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);

        // Audit grid — Entry spot
        await expect(this.contractDetailsEntrySpotLabel, 'Entry spot label should be "Entry spot"').toHaveText(
            'Entry spot'
        );
        await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsEntrySpotTime, `Entry spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        // Audit grid — Exit spot
        await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
            'Exit spot'
        );
        await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsExitSpotTime, `Exit spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        // Audit grid — Exit time
        await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
            'Exit time'
        );
        await expect(this.contractDetailsExitTime, `Exit time should contain "${buyDate}"`).toContainText(buyDate);

        return { buyId, sellId };
    }

    private async verifyClosedAccumulatorContractDetailsMobile(
        market: string,
        growthRate: string,
        stake: string,
        buyDate: string,
        profitLossAmount: string,
        takeProfit?: string | null
    ): Promise<{ buyId: string; sellId: string }> {
        // Header
        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header should show "Contract details"'
        ).toHaveText('Contract details');

        // Contract card — market, trade type, profit/loss
        await expect(
            this.mobileContractMarket,
            `Mobile closed contract card should show market "${market}"`
        ).toHaveText(market);
        await expect(
            this.mobileContractTradeType,
            'Mobile closed contract card should show trade type "Accumulators"'
        ).toContainText('Accumulators');
        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        await expect(this.mobileContractProfit, `Profit/loss should contain "${profitLossNumeric}"`).toContainText(
            profitLossNumeric
        );

        // Order Details — Reference ID: buy + sell paragraphs
        const refIdValueCell = this.page
            .locator('.order-details__table-row', {
                has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
            })
            .locator('.order-details__table-row-cell')
            .last();
        const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
        const sellRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Sell)' });

        await expect(buyRefIdParagraph, 'Buy Reference ID should contain "(Buy)"').toContainText('(Buy)');
        const buyRefIdRaw = (await buyRefIdParagraph.innerText()).trim();
        const buyId = buyRefIdRaw.replace(' (Buy)', '');
        await expect(sellRefIdParagraph, 'Sell Reference ID should contain "(Sell)"').toContainText('(Sell)');
        const sellRefIdRaw = (await sellRefIdParagraph.innerText()).trim();
        const sellId = sellRefIdRaw.replace(' (Sell)', '');

        // Order Details — Duration (tick count varies per run — assert presence, not an exact value)
        await expect(this.mobileOrderDetailsValue('Duration'), 'Duration should have a value').not.toBeEmpty();

        // Order Details — Growth rate and Stake
        await expect(
            this.mobileOrderDetailsValue('Growth rate'),
            `Growth rate should contain "${growthRate}"`
        ).toContainText(growthRate);
        await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${stake}"`).toContainText(stake);

        // Order Details — Take profit. Unlike Multipliers, this row is omitted entirely (not "Not set")
        // when no take profit is configured.
        if (takeProfit) {
            await expect(
                this.mobileOrderDetailsValue('Take profit'),
                `Take profit should contain "${takeProfit}"`
            ).toContainText(takeProfit);
        } else {
            await expect(
                this.mobileOrderDetailsValue('Take profit'),
                'Take profit row should not be shown when not set'
            ).not.toBeVisible();
        }

        // Entry & exit details section
        await expect(this.mobileEntryExitDetails, 'Entry & exit details section should be visible').toBeVisible();

        const entryExitRow = (label: string) =>
            this.page.locator('.entry-exit-details__table-row', {
                has: this.page.locator('.entry-exit-details__table-cell', { hasText: label }),
            });
        const entryExitValue = (label: string) => entryExitRow(label).locator('.entry-exit-details__table-cell').last();

        const buyDateFormatted = TradeBasePage.formatISODate(buyDate);

        // Start time
        await expect(entryExitRow('Start time'), 'Start time row should be visible').toBeVisible();
        await expect(
            entryExitValue('Start time').locator('p').first(),
            `Start time date should contain "${buyDateFormatted}"`
        ).toContainText(buyDateFormatted);

        // Entry spot
        await expect(entryExitRow('Entry spot'), 'Entry spot row should be visible').toBeVisible();
        await expect(
            entryExitValue('Entry spot').locator('p').first(),
            'Entry spot price should have a value'
        ).not.toBeEmpty();

        // Exit time
        await expect(entryExitRow('Exit time'), 'Exit time row should be visible').toBeVisible();
        await expect(
            entryExitValue('Exit time').locator('p').first(),
            `Exit time date should contain "${buyDateFormatted}"`
        ).toContainText(buyDateFormatted);

        // Exit spot
        await expect(entryExitRow('Exit spot'), 'Exit spot row should be visible').toBeVisible();
        await expect(
            entryExitValue('Exit spot').locator('p').first(),
            'Exit spot price should have a value'
        ).not.toBeEmpty();

        return { buyId, sellId };
    }

    /**
     * Verify the open Vanillas contract details page (Call/Put).
     *
     * Vanillas have no fixed Potential payout on the trade form or card — the audit/order-details
     * grid shows Strike (absolute barrier) and Payout per point instead.
     *
     * @param market        - Market symbol, e.g. "Volatility 75 Index"
     * @param direction     - Direction label on desktop contract details, e.g. "Call" or "Put"
     * @param contractType  - Positions card label (mobile), e.g. "Vanillas Call" or "Vanillas Put"
     * @param currency      - Currency badge (desktop), e.g. "USD"
     * @param stake         - Stake as displayed, e.g. "10.00"
     * @param buyId         - Buy reference ID from Reports
     * @param durationValue - Duration chip label, e.g. "5 min"
     * @param buyDate       - UTC date captured before buy, e.g. "2026-08-19"
     */
    async verifyVanillasOpenContractDetailsPage(
        market: string,
        direction: 'Call' | 'Put',
        contractType: string,
        currency: string,
        stake: string,
        buyId: string,
        durationValue: string,
        buyDate: string
    ): Promise<void> {
        const auditDuration = this.normaliseDurationForAudit(durationValue);

        if (this.isMobile) {
            await expect(
                this.contractDetailsHeaderTitle,
                'Contract details header should show "Contract details"'
            ).toHaveText('Contract details');

            await expect(this.mobileContractMarket, `Mobile contract card should show market "${market}"`).toHaveText(
                market
            );
            await expect(
                this.mobileContractTradeType,
                `Mobile contract card should show trade type "${contractType}"`
            ).toHaveText(contractType);
            await expect(this.mobileContractProfit, 'Mobile contract profit/loss should have a value').not.toBeEmpty();

            await expect(
                this.mobileOrderDetailsValue('Reference ID'),
                `Reference ID should contain "${buyId} (Buy)"`
            ).toContainText(`${buyId} (Buy)`);
            await expect(this.mobileOrderDetailsValue('Duration'), `Duration should be "${auditDuration}"`).toHaveText(
                auditDuration
            );
            await expect(
                this.mobileOrderDetailsValue('Strike Price'),
                'Strike price should show a numeric absolute barrier'
            ).toHaveText(/[\d,]+\.\d{2}/);
            await expect(
                this.mobileOrderDetailsValue('Payout per point'),
                `Payout per point should contain "${currency}"`
            ).toContainText(currency);
            await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${stake}"`).toContainText(stake);

            await expect(this.mobileEntryExitDetails, 'Entry & exit details section should be visible').toBeVisible();
            await expect(
                this.mobileContractDetailsCloseButton,
                'Close button should be visible on the mobile contract details page'
            ).toBeVisible();
            return;
        }

        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        // Desktop contract-details drawer shows direction only ("Call"/"Put"), not "Vanillas Call".
        await expect(this.contractDetailsTradeType, `Contract card type should be "${direction}"`).toHaveText(
            direction
        );
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );

        await expect(this.contractDetailsRemainingTime, 'Remaining time should have a value').not.toBeEmpty();
        await expect(this.contractDetailsProgressBar, 'Progress bar should be visible').toBeVisible();
        await expect(
            this.contractCardItem('Total profit/loss:'),
            'Total profit/loss should have a value'
        ).not.toBeEmpty();
        await expect(this.contractCardItem('Contract value:'), 'Contract value should have a value').not.toBeEmpty();
        await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toHaveText(stake);

        await expect(
            this.contractDetailsSellButton,
            'Sell button should be visible on the contract card'
        ).toBeVisible();

        await expect(this.contractDetailsReferenceID, `Reference ID should be "${buyId} (Buy)"`).toHaveText(
            `${buyId} (Buy)`
        );
        await expect(this.contractDetailsDuration, `Duration should be "${auditDuration}"`).toHaveText(auditDuration);
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);
        await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();

        await expect(this.contractAuditValue('Strike'), 'Strike should show a numeric absolute barrier').toHaveText(
            /[\d,]+\.\d{2}/
        );
        await expect(
            this.contractAuditValue('Payout per point'),
            'Payout per point should have a value'
        ).not.toBeEmpty();
    }

    /**
     * Verify the closed Vanillas contract details page (Call/Put) after early close.
     *
     * Vanillas show Strike and Payout per point in order details — not Potential payout or Barrier.
     *
     * @param profitLossAmount - P&L from the closed positions card, e.g. "+1.26 USD" or "-2.05 USD"
     * @returns The sell reference ID string (desktop) or extracted from mobile order details
     */
    async verifyVanillasClosedContractDetailsPage(
        market: string,
        direction: 'Call' | 'Put',
        contractType: string,
        currency: string,
        stake: string,
        buyId: string,
        durationValue: string,
        buyDate: string,
        profitLossAmount: string
    ): Promise<string> {
        const auditDuration = this.normaliseDurationForAudit(durationValue);

        if (this.isMobile) {
            await expect(
                this.contractDetailsHeaderTitle,
                'Contract details header should show "Contract details"'
            ).toHaveText('Contract details');

            await expect(
                this.mobileContractMarket,
                `Mobile closed contract card should show market "${market}"`
            ).toHaveText(market);
            await expect(
                this.mobileContractTradeType,
                `Mobile closed contract card should show trade type "${contractType}"`
            ).toHaveText(contractType);
            await expect(
                this.mobileContractProfit,
                'Mobile closed contract card profit/loss should have a value'
            ).not.toBeEmpty();

            const refIdValueCell = this.page
                .locator('.order-details__table-row', {
                    has: this.page.locator('.order-details__table-row-cell', { hasText: 'Reference ID' }),
                })
                .locator('.order-details__table-row-cell')
                .last();

            const buyRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Buy)' });
            const sellRefIdParagraph = refIdValueCell.locator('p').filter({ hasText: '(Sell)' });

            await expect(buyRefIdParagraph, `Buy Reference ID should contain "${buyId} (Buy)"`).toContainText(
                `${buyId} (Buy)`
            );
            await expect(sellRefIdParagraph, 'Sell Reference ID should contain "(Sell)"').toContainText('(Sell)');

            const sellRefIdRaw = (await sellRefIdParagraph.innerText()).trim();
            const sellId = sellRefIdRaw.replace(' (Sell)', '');

            await expect(this.mobileOrderDetailsValue('Duration'), `Duration should be "${auditDuration}"`).toHaveText(
                auditDuration
            );
            await expect(
                this.mobileOrderDetailsValue('Strike Price'),
                'Strike price should show a numeric absolute barrier'
            ).toHaveText(/[\d,]+\.\d{2}/);
            await expect(
                this.mobileOrderDetailsValue('Payout per point'),
                `Payout per point should contain "${currency}"`
            ).toContainText(currency);
            await expect(this.mobileOrderDetailsValue('Stake'), `Stake should contain "${stake}"`).toContainText(stake);

            await expect(this.mobileEntryExitDetails, 'Entry & exit details section should be visible').toBeVisible();
            await expect(
                this.mobileContractDetailsCloseButton,
                'Close button should not be visible on a closed contract'
            ).not.toBeVisible();

            return sellId;
        }

        const profitLossNumeric = profitLossAmount
            .replace(/^[+-]/, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
        const expectedContractValue = this.calculateClosedContractValue(stake, profitLossAmount);

        await expect(
            this.contractDetailsHeaderTitle,
            'Contract details header title should be "Contract details"'
        ).toHaveText('Contract details');

        await expect(this.contractDetailsMarket, `Contract card symbol should be "${market}"`).toHaveText(market);
        // Desktop contract-details drawer shows direction only ("Call"/"Put"), not "Vanillas Call".
        await expect(this.contractDetailsTradeType, `Contract card type should be "${direction}"`).toHaveText(
            direction
        );
        await expect(this.contractDetailsCurrency, `Contract card currency should be "${currency}"`).toHaveText(
            currency
        );

        await expect(
            this.contractDetailsRemainingTime,
            'Remaining time should not be visible on a closed contract'
        ).not.toBeVisible();

        await expect(
            this.contractCardItem('Total profit/loss:'),
            `Total profit/loss should contain "${profitLossNumeric}"`
        ).toContainText(profitLossNumeric);
        await expect(
            this.contractCardItem('Contract value:'),
            `Contract value should be "${expectedContractValue}"`
        ).toHaveText(expectedContractValue);
        await expect(this.contractCardItem('Stake:'), `Stake should be "${stake}"`).toHaveText(stake);

        await expect(
            this.contractDetailsSellButton,
            'Sell button should not be visible on a closed contract'
        ).not.toBeVisible();

        await expect(this.contractDetailsReferenceID, `Buy reference ID should be "${buyId} (Buy)"`).toHaveText(
            `${buyId} (Buy)`
        );
        await expect(this.contractDetailsReferenceIDSell, 'Sell reference ID should have a value').not.toBeEmpty();
        const sellIdText = (await this.contractDetailsReferenceIDSell.innerText()).trim();
        const sellId = sellIdText.replace(' (Sell)', '');

        await expect(this.contractDetailsDuration, `Duration should be "${auditDuration}"`).toHaveText(auditDuration);
        await expect(this.contractDetailsStartTime, `Start time should contain "${buyDate}"`).toContainText(buyDate);
        await expect(this.contractDetailsEntrySpot, 'Entry spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsEntrySpotTime, `Entry spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );

        await expect(this.contractAuditValue('Strike'), 'Strike should show a numeric absolute barrier').toHaveText(
            /[\d,]+\.\d{2}/
        );
        await expect(
            this.contractAuditValue('Payout per point'),
            'Payout per point should have a value'
        ).not.toBeEmpty();

        await expect(this.contractDetailsExitSpotLabel, 'Exit spot label should be "Exit spot"').toHaveText(
            'Exit spot'
        );
        await expect(this.contractDetailsExitSpot, 'Exit spot price should have a value').not.toBeEmpty();
        await expect(this.contractDetailsExitSpotTime, `Exit spot time should contain "${buyDate}"`).toContainText(
            buyDate
        );
        await expect(this.contractDetailsExitTimeLabel, 'Exit time label should be "Exit time"').toHaveText(
            'Exit time'
        );
        await expect(this.contractDetailsExitTime, `Exit time should contain "${buyDate}"`).toContainText(buyDate);

        return sellId;
    }
}
