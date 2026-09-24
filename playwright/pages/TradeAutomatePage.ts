import { Locator, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';
import { ContractDetailsPage } from './ContractDetailsPage';
import { PositionsPage } from './PositionsPage';
import { TradeParametersPage } from './TradeParametersPage';

/**
 * Page Object for the DTrader Automated Trading feature.
 *
 * Extends TradeParametersPage (→ TradeBasePage) — automation reuses the shared trade
 * form (trade type, duration, stake) and adds the strategy/risk-management panel plus
 * the Run / Pause / Stop controls.
 *
 * The panel has **no data-testids**, so locators use Quill button labels, the status
 * text, and stable classes (source: `AppV2/Components/AutomationPanel/automation-actions.tsx`).
 *
 * Run status machine: idle → starting → running → stopping → stopped. After Run the store
 * holds `starting` until the first contract is observed, then flips to `running` — so
 * `verifyAutomateBotIsRunning()` waits (tolerating the transient "Starting...").
 *
 * @example
 * ```typescript
 * test('VERIFY automation lifecycle', async ({ tradeAutomatePage }) => {
 *     await tradeAutomatePage.goToAutomatedTrading();
 *     await tradeAutomatePage.startAutomateRun();
 *     await tradeAutomatePage.verifyAutomateBotIsRunning({
 *         market: 'Volatility 100 Index',
 *         stake: '1',
 *         tradeType: 'Rise/Fall',
 *     });
 *     await tradeAutomatePage.stopAutomateRun();
 * });
 * ```
 */
export class TradeAutomatePage extends TradeParametersPage {
    /** Trade-type copy from automation-guide-config.ts — "What is {title}?" body. */
    private static readonly AUTOMATE_GUIDE_TRADE_TYPE_DESCRIPTIONS: Record<string, string> = {
        'Rise/Fall': 'Predict if the market price will end higher or lower than the entry spot at contract expiry.',
        Accumulators: 'Predict how much an index can move to potentially grow your stake at a fixed rate.',
        'Matches/Differs':
            'Predict whether the last digit of the exit spot will match or differ from your chosen number.',
        'Over/Under': 'Predict if the last digit of the exit spot will be over or under your chosen number.',
        'Even/Odd': 'Predict if the last digit of the exit spot will be an even or odd number at contract expiry.',
    };

    /** Default (Martingale) strategy copy shown in the guide popup. */
    private static readonly AUTOMATE_GUIDE_MARTINGALE_DESCRIPTION =
        'Double down after a loss, reset after a profit. Multiplies your stake after a loss to recover funds quickly. Resets to your initial stake after a successful trade.';

    private static readonly AUTOMATE_GUIDE_MARTINGALE_WARNING =
        'Be aware that using Martingale as your strategy can blow up fast without Max stake set.';

    /** Last trade type selected via `selectMarketAndTradeType` — used by `stopAutomateRun()` param unlock checks. */
    private selectedTradeType = 'Rise/Fall';

    private static readonly AUTOMATE_GUIDE_MARTINGALE_PARAMETERS = [
        'Initial stake',
        'Stake multiplier',
        'Max stake',
        'Profit threshold',
        'Loss threshold',
    ] as const;

    /** D'Alembert strategy copy shown after selecting its chip in the guide popup. */
    private static readonly AUTOMATE_GUIDE_DALEMBERT_DESCRIPTION =
        'Add a little after a loss, subtract after a profit. Adds a fixed amount to your stake after a loss, and subtracts it after a successful trade. A more gradual approach.';

    private static readonly AUTOMATE_GUIDE_DALEMBERT_WARNING =
        "D'Alembert is more gradual than Martingale, but it still increases risk during losing streaks if no Max stake is set.";

    private static readonly AUTOMATE_GUIDE_DALEMBERT_PARAMETERS = [
        'Initial stake',
        'Stake increment',
        'Max stake',
        'Profit threshold',
        'Loss threshold',
    ] as const;

    private static readonly AUTOMATE_GUIDE_STRATEGY_INFO_TEXT =
        'Strategies are your automated trading rules. They read your chosen parameters to execute trades for you';

    private static readonly LOSS_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE = 'Loss threshold reached. Automation stopped.';

    /**
     * Snackbar shown when Run is clicked while the server already has an active run
     * for the account (stale-tab guard). Source: useRunControls.ts `handleRunClick`.
     */
    private static readonly ALREADY_RUNNING_SNACKBAR_MESSAGE = 'Automation is already running for this account.';

    private static readonly PROFIT_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE =
        'Profit threshold reached. Automation stopped.';

    /** Source: ThresholdInput + MaxTradeStake — FE guard for non-positive amounts. */
    private static readonly AUTOMATION_POSITIVE_AMOUNT_ERROR = /Please enter .*amount greater than 0/;

    /** Source: StakeMultiplier — Martingale multiplier out-of-range (hint + validation share this copy). */
    private static readonly STAKE_MULTIPLIER_RANGE_ERROR = /The value must be greater than \d+ and no more than \d+\./;

    /** Source: StakeMultiplier desktop/mobile — D'Alembert increment range hint (#1369 / PR #1382). */
    private static readonly STAKE_INCREMENT_RANGE_HINT = 'Minimum 1';

    /** Source: StakeMultiplier — D'Alembert custom increment below minimum (1). */
    private static readonly STAKE_INCREMENT_MIN_ERROR = 'Increment must be at least 1';

    /** Source: MaxTradeStake — cap below trade-form initial stake (Flow 15 baseline stake is `1`). */
    private static readonly MAX_STAKE_BELOW_INITIAL_ERROR = 'Max. stake must be equal or greater than 1';

    private static readonly AUTOMATE_GUIDE_STRATEGIES = {
        Martingale: {
            description: () => TradeAutomatePage.AUTOMATE_GUIDE_MARTINGALE_DESCRIPTION,
            warning: () => TradeAutomatePage.AUTOMATE_GUIDE_MARTINGALE_WARNING,
            parameters: () => TradeAutomatePage.AUTOMATE_GUIDE_MARTINGALE_PARAMETERS,
        },
        "D'Alembert": {
            description: () => TradeAutomatePage.AUTOMATE_GUIDE_DALEMBERT_DESCRIPTION,
            warning: () => TradeAutomatePage.AUTOMATE_GUIDE_DALEMBERT_WARNING,
            parameters: () => TradeAutomatePage.AUTOMATE_GUIDE_DALEMBERT_PARAMETERS,
        },
    } as const;

    private readonly positionsPage: PositionsPage;
    private readonly contractDetailsPage: ContractDetailsPage;

    constructor(page: import('@playwright/test').Page) {
        super(page);
        this.positionsPage = new PositionsPage(page);
        this.contractDetailsPage = new ContractDetailsPage(page);
    }

    // ============================================
    // LOCATORS
    // ============================================

    /** "Strategy parameters" section header — confirms the automation panel rendered. */
    get strategyParametersHeader(): Locator {
        return this.page.getByText('Strategy parameters');
    }

    /** "Risk management" section header. */
    get riskManagementHeader(): Locator {
        return this.page.getByText('Risk management');
    }

    /**
     * Strategy field (readonly `TradeParameterPopover` input) — its value is the selected
     * strategy label, defaulting to "Martingale".
     * Source: strategy-selector-{desktop,mobile}.tsx — `value={getStrategyLabel('martingale')}`.
     */
    get strategyField(): Locator {
        return this.page.getByLabel('Strategy').first();
    }

    /**
     * Mobile Strategy selector action sheet (while open).
     */
    get strategySheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:visible').filter({
            has: this.page.locator('.automation-popover__content'),
        });
    }

    /**
     * A strategy option inside the open Strategy selector. The two viewports render options with
     * different anchors, so branch on `isMobile`:
     * - Desktop: `SelectionListPopover` renders each option as `<button role="option">{label}</button>`.
     * - Mobile: the ActionSheet renders each option as `<button class="automation-popover__option">{label}</button>`
     *   with no `option` role — selection is a draft until header Save commits it.
     * Source: TradeParameters/Shared/SelectionListPopover.tsx · StrategySelector/strategy-selector-mobile.tsx.
     *
     * @param label - The strategy display label, e.g. `'Martingale'` or `"D'Alembert"`.
     * @returns Locator for that option button within the open selector.
     */
    strategyOption(label: string): Locator {
        return this.isMobile
            ? this.strategySheet.locator('.automation-popover__option', { hasText: label })
            : this.page.getByRole('option', { name: label });
    }

    /**
     * ActionSheet header titles for automation numeric-input editors (mobile).
     * Source: StakeMultiplier/stake-multiplier-mobile.tsx, ThresholdInput/threshold-input-mobile.tsx,
     * MaxTradeStake/max-trade-stake-mobile.tsx.
     */
    private automationInputSheet(
        title: 'Stake increment' | 'Stake multiplier' | 'Loss threshold' | 'Profit threshold' | 'Max. stake'
    ): Locator {
        return this.page.locator('.quill-action-sheet--root:visible').filter({
            has: this.page.locator('.action-sheet-header-title', { hasText: title }),
        });
    }

    /**
     * Numeric input inside an open automation input sheet or desktop popover.
     *
     * @param sheetTitle - Mobile ActionSheet header title; ignored on desktop.
     */
    private automationInputField(
        sheetTitle: 'Stake increment' | 'Stake multiplier' | 'Loss threshold' | 'Profit threshold' | 'Max. stake'
    ): Locator {
        return this.isMobile
            ? this.automationInputSheet(sheetTitle).locator('.automation-popover__input-wrapper input')
            : this.page.locator('.automation-popover:visible .automation-popover__input-wrapper input');
    }

    /**
     * Sets a draft in an open automation popover/sheet input.
     * Quill TextField floating labels intercept clicks on an empty input — use fill(), not click()+clear().
     */
    private async fillAutomationDraft(input: Locator, value: string): Promise<void> {
        await input.fill(value);
    }

    /**
     * D'Alembert's stake-parameter field. The shared `StakeMultiplier` component renders with the
     * **"Stake increment"** label for D'Alembert (the `unit` param) — as opposed to Martingale's
     * "Stake multiplier" (the `multiplier` param) — and its value reads `"{n} unit"`.
     * Source: StakeMultiplier/stake-multiplier-{desktop,mobile}.tsx
     * (`is_martingale ? 'Stake multiplier' : 'Stake increment'`).
     */
    get stakeIncrementField(): Locator {
        return this.page.getByLabel('Stake increment').first();
    }

    /** Martingale stake multiplier field — label "Stake multiplier". */
    get stakeMultiplierField(): Locator {
        return this.page.getByLabel('Stake multiplier').first();
    }

    /** Max. stake field trigger in Risk management (readonly until opened). */
    get maxStakeField(): Locator {
        return this.page.getByLabel('Max. stake', { exact: true }).first();
    }

    /** Strategy selector label — `TradeParameterPopover` on desktop, TextField on mobile. */
    get strategyLabel(): Locator {
        return this.page.locator('label', { hasText: 'Strategy' }).first();
    }

    /** Martingale stake-multiplier label inside the automation panel. */
    get stakeMultiplierLabel(): Locator {
        return this.page.locator('label', { hasText: 'Stake multiplier' }).first();
    }

    /** Max. stake label in the strategy-parameters section. */
    get maxStakeLabel(): Locator {
        return this.page.locator('label', { hasText: 'Max. stake' }).first();
    }

    /** Profit-threshold label in the risk-management section. */
    get profitThresholdLabel(): Locator {
        return this.page.locator('label', { hasText: 'Profit threshold' }).first();
    }

    /** Loss-threshold label in the risk-management section. */
    get lossThresholdLabel(): Locator {
        return this.page.locator('label', { hasText: 'Loss threshold' }).first();
    }

    /**
     * Last digit prediction field — mobile only (TextField with label).
     * Desktop uses {@link lastDigitPredictionButtons} inline grid instead.
     * Source: last-digit-prediction.tsx — `render_as_field` vs CaptionText + LastDigitSelector.
     */
    get digitPredictionField(): Locator {
        return this.page.getByLabel('Last digit prediction').first();
    }

    /** Desktop last-digit prediction block — gains `trade-params__field-locked` when automation locks params. */
    get lastDigitPredictionSection(): Locator {
        return this.page.locator('.last-digit-prediction');
    }

    /** Digit selector buttons (0–9) — desktop inline grid; also inside the mobile action sheet. */
    get lastDigitPredictionButtons(): Locator {
        return this.page.locator('.last-digit-prediction__selector button[name="last_digit"]');
    }

    get digitPredictionSheet(): Locator {
        return this.page
            .locator('.quill-action-sheet--root')
            .filter({ has: this.page.locator('.last-digit-prediction__selector') });
    }

    digitButton(digit: string): Locator {
        return this.page
            .locator('.last-digit-prediction__selector')
            .locator('button[name="last_digit"]')
            .filter({ hasText: new RegExp(`^${digit}$`) });
    }

    /** Outcome tab — SegmentedControlSingleChoice (trade-type-tabs.tsx). */
    outcomeTab(label: string): Locator {
        return this.page.locator('.trade-params__option').getByRole('button', { name: label, exact: true });
    }

    /** Green purchase button when the top outcome tab is selected. */
    get outcomeTopPurchaseButton(): Locator {
        return this.page.locator('.quill__color--primary-purchase');
    }

    /** Red purchase button when the bottom outcome tab is selected. */
    get outcomeBottomPurchaseButton(): Locator {
        return this.page.locator('.quill__color--primary-sell');
    }

    /**
     * Select a trade-type outcome tab before an automation run — same tab + purchase-button colour check as manual trade.
     *
     * @param tradeType - Outcome tab label (e.g. 'Rise', 'Matches', 'Even')
     * @param position - 'top' → green purchase button; 'bottom' → red purchase button
     */
    async selectTradeTypeOption(tradeType: string, position: 'top' | 'bottom'): Promise<void> {
        const button = position === 'top' ? this.outcomeTopPurchaseButton : this.outcomeBottomPurchaseButton;
        const expectedColor = position === 'top' ? 'rgb(0, 195, 144)' : 'rgb(222, 0, 64)';
        await this.outcomeTab(tradeType).click();
        await expect(
            button,
            `Purchase button should be ${position === 'top' ? 'green' : 'red'} after selecting ${tradeType}`
        ).toHaveCSS('background-color', expectedColor);
    }

    private maxStakeToggle(sheet: Locator): Locator {
        return sheet.locator('.automation-popover__toggle-header button.toggle-switch');
    }

    /**
     * A preset value chip inside an open parameter popover. The chips tab is the default view, so
     * chips are visible immediately after opening the field — no tab switch needed. `ValueChips`
     * renders each preset as `<button aria-label="Select value {n}">`.
     * Source: AppV2/Components/InputPopover/value-chips.tsx.
     *
     * @param value - The preset numeric value to pick, e.g. `3`.
     * @returns Locator for that chip button.
     */
    valueChip(value: number, sheetTitle: 'Stake increment' | 'Stake multiplier' = 'Stake increment'): Locator {
        return this.isMobile
            ? this.automationInputSheet(sheetTitle).getByRole('button', { name: `Select value ${value}`, exact: true })
            : this.page.getByRole('button', { name: `Select value ${value}`, exact: true });
    }

    /**
     * Automation run controls strip — status line, stats, Run / Pause / Stop.
     * Desktop: `.automation-actions` (automation-actions.tsx).
     * Mobile: `.automate-mobile__run-button` sticky footer (automate-mobile.tsx) — no `.automation-actions` root.
     */
    get automationActions(): Locator {
        return this.isMobile
            ? this.page.locator('.automate-mobile__run-button')
            : this.page.locator('.automation-actions');
    }

    /** Status + stats block — visible while running or paused. */
    get automationActionsStatus(): Locator {
        return this.isMobile
            ? this.page.locator('.automation-actions__status')
            : this.automationActions.locator('.automation-actions__status');
    }

    /** "Status: Running/Paused" row + info icon. */
    get automationActionsStatusLine(): Locator {
        return this.automationActionsStatus.locator('.automation-actions__status-line');
    }

    /** Info icon beside the status line — hover/tap reveals run summary tooltip. */
    get automationStatusInfoIcon(): Locator {
        return this.automationActionsStatusLine.locator('.automation-status-info__icon');
    }

    /** Pause/Stop (or Resume/Stop) button row — replaces Run while a run is active. */
    get automationRunActions(): Locator {
        return this.isMobile
            ? this.page.locator('.automation-actions__run-actions')
            : this.automationActions.locator('.automation-actions__run-actions');
    }

    /** Initial stake field — desktop automate tab label is "Initial stake"; mobile /automate keeps "Stake". */
    get initialStakeField(): Locator {
        return this.isMobile ? this.page.getByLabel('Stake').first() : this.page.getByLabel('Initial stake').first();
    }

    /**
     * Open the Automate stake custom editor via the Initial stake trigger.
     * Reuses Manual/shared Custom-tab + input wait behavior from TradeParametersPage.
     */
    override async openStakeCustomInput(): Promise<void> {
        await this.initialStakeField.click();
        if (!this.isMobile) {
            await this.stakeManualInputToggle.click();
        }
        await expect(this.stakePopoverInput, 'Custom stake input should be visible').toBeVisible();
    }

    /**
     * Run button (idle state) — Quill Button labelled "Run".
     * Desktop: automation-actions.tsx. Mobile: automate-mobile.tsx sticky footer.
     */
    get runButton(): Locator {
        return this.automationActions.getByRole('button', { name: 'Run', exact: true });
    }

    /** "Status: Running" line shown while a run is active. */
    get statusRunning(): Locator {
        return this.automationActionsStatusLine.getByText('Status: Running', { exact: true });
    }

    /** "Status: Paused" line shown while a run is paused. */
    get statusPaused(): Locator {
        return this.automationActionsStatusLine.getByText('Status: Paused', { exact: true });
    }

    /**
     * Run stats line — "Contracts: N | P/L: …" — visible while running/paused.
     * Source: automation-actions.tsx — `Contracts: {{count}} | P/L: {{profit}}`.
     */
    get automationStats(): Locator {
        return this.automationActionsStatus.getByText(/Contracts:\s*\d+\s*\|\s*P\/L:/);
    }

    /**
     * "Automation is already running for this account." snackbar — shown when Run is
     * clicked from a stale tab while another context already has an active run.
     * Source: useRunControls.ts — resync guard inside `handleRunClick`.
     */
    get alreadyRunningSnackbar(): Locator {
        return this.page
            .locator('.snackbar--container')
            .getByText(TradeAutomatePage.ALREADY_RUNNING_SNACKBAR_MESSAGE, { exact: true });
    }

    /**
     * Loss-threshold auto-stop snackbar message.
     * Source: automation-stop-snackbar.tsx — StopLoss / `condition_triggered`.
     */
    get lossThresholdAutoStopSnackbar(): Locator {
        return this.page
            .locator('.snackbar--container')
            .getByText(TradeAutomatePage.LOSS_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE, { exact: true });
    }

    /**
     * Profit-threshold auto-stop snackbar message.
     * Source: automation-stop-snackbar.tsx — TakeProfit / `condition_triggered`.
     */
    get profitThresholdAutoStopSnackbar(): Locator {
        return this.page
            .locator('.snackbar--container')
            .getByText(TradeAutomatePage.PROFIT_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE, { exact: true });
    }

    /**
     * Snackbar shown when a multiplier-only market is active in Automate (Range Break, Crypto).
     * Source: useNonAutomatableSymbolSnackbar.ts — issues #916 / #922.
     *
     * @param market - Display name embedded in the snackbar copy.
     */
    nonAutomatableSymbolSnackbar(market: string): Locator {
        const escapedMarket = market.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return this.page
            .locator('.snackbar--container')
            .getByText(new RegExp(`${escapedMarket} isn.t available for automated trading`, 'i'));
    }

    /** Dismiss control on automation threshold stop snackbars (quill `data-testid="close-button"`). */
    get automationStopSnackbarCloseButton(): Locator {
        return this.page
            .locator('.snackbar--container')
            .filter({
                hasText: new RegExp(
                    `${TradeAutomatePage.LOSS_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE}|${TradeAutomatePage.PROFIT_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE}`
                ),
            })
            .getByTestId('close-button');
    }

    /** Pause button (visible while running). */
    get pauseButton(): Locator {
        return this.automationRunActions.getByRole('button', { name: 'Pause', exact: true });
    }

    /** Resume button (visible while paused). */
    get resumeButton(): Locator {
        return this.automationRunActions.getByRole('button', { name: 'Resume', exact: true });
    }

    /**
     * Stop button (visible while running/paused/stopping).
     * Source: automation-actions.tsx — label `localize('Stop')`, class `automation-actions__run-stop`.
     */
    get stopButton(): Locator {
        return this.automationRunActions.getByRole('button', { name: 'Stop', exact: true });
    }

    /**
     * "Loss threshold" (stop-loss) field trigger in the Risk management section — a readonly
     * `TradeParameterPopover` (desktop) / readonly `TextField` (mobile) that opens the editor.
     * Source: ThresholdInput/threshold-input-{desktop,mobile}.tsx — `label = localize('Loss threshold')`.
     * `exact` avoids also matching the inner "Loss threshold (USD)" input while the editor is open.
     */
    get lossThresholdField(): Locator {
        return this.page.getByLabel('Loss threshold', { exact: true }).first();
    }

    /**
     * "Profit threshold" (take-profit) field trigger in the Risk management section — the same
     * `ThresholdInput` component as the loss threshold (`threshold_type='take_profit'`).
     * `exact` avoids also matching the inner "Profit threshold (USD)" input while the editor is open.
     */
    get profitThresholdField(): Locator {
        return this.page.getByLabel('Profit threshold', { exact: true }).first();
    }

    /**
     * Save button that commits an automation input value on desktop popovers.
     * Mobile callers should use `actionSheetSaveButton(automationInputSheet(title))`.
     */
    get automationPopoverSaveButton(): Locator {
        return this.page.locator('.automation-popover:visible .automation-popover__save-button');
    }

    /** Desktop automation popover — Custom tab when the value is not a Quick picks preset. */
    private get automationPopoverCustomTab(): Locator {
        return this.page.locator('.automation-popover:visible').getByRole('button', { name: 'Custom' });
    }

    /**
     * Automation guide trigger — "Automate {trade type title}".
     * Source: AutomationGuide/automation-guide-trigger.tsx.
     */
    automateGuideTrigger(guideTitle: string): Locator {
        return this.page.getByRole('button', { name: `Automate ${guideTitle}`, exact: true });
    }

    /**
     * Automation guide popup — desktop Modal (`.automation-guide__modal`) or mobile ActionSheet
     * (`.automation-guide__sheet-content`). Source: AutomationGuide/automation-guide.tsx.
     */
    get automationGuidePopup(): Locator {
        return this.isMobile
            ? this.page.locator('.quill-action-sheet--root:visible').filter({
                  has: this.page.locator('.automation-guide__sheet-content'),
              })
            : this.page.locator('.quill-modal__container.automation-guide__modal:visible');
    }

    /** Scrollable guide body inside the open popup. Source: automation-guide-content.tsx. */
    automationGuideContent(popup: Locator): Locator {
        return popup.locator('.automation-guide-content');
    }

    /** Strategy chip inside the open automation guide popup. */
    automationGuideStrategyChip(content: Locator, label: 'Martingale' | "D'Alembert"): Locator {
        return content.locator('.automation-guide-content__chips button').filter({ hasText: label });
    }

    /** "Got it" dismiss control in the open automation guide popup. */
    get automationGuideGotItButton(): Locator {
        return this.automationGuidePopup.getByRole('button', { name: 'Got it', exact: true });
    }

    /** Desktop modal X close control. Source: Quill Modal `.quill-modal__close-icon`. */
    automationGuideCloseButton(popup: Locator): Locator {
        return popup.locator('button.quill-modal__close-icon');
    }

    /**
     * Portaled Quill Tooltip body (react-tiny-popover). Used by the desktop strategy-info
     * icon beside Strategies overview. Source: automation-guide-content.tsx + automation-guide.scss.
     */
    get automationGuideStrategyInfoTooltip(): Locator {
        return this.page.locator('.react-tiny-popover-container .tooltip-content');
    }

    /** Growth rate field trigger — Accumulators only. Source: growth-rate.tsx. */
    get growthRateField(): Locator {
        return this.page.getByLabel('Growth rate').first();
    }

    growthRateOption(value: string): Locator {
        return this.page.getByRole('option', { name: value, exact: true });
    }

    get growthRateSheet(): Locator {
        return this.page.locator('.quill-action-sheet--root:has(.growth-rate__carousel)');
    }

    /**
     * Desktop Automated trading tab — 2nd icon-only option in `TradePanelTabs`.
     * Source: trade-panel-tabs.tsx (tooltip "Automated trading", index 1).
     */
    get automatedTradingTab(): Locator {
        return this.page.locator('.trade-panel-tabs__toggle button.item').nth(1);
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Select market + trade type and remember the trade type for running-state param checks.
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
        await super.selectMarketAndTradeType(market, tradeType, options);
        this.selectedTradeType = tradeType;
    }

    /**
     * Open the Automation view via the in-app entry point.
     *
     * - **Desktop:** click the **Automated trading** tab in `TradePanelTabs`.
     * - **Mobile:** tap the **Automate** bottom-nav item.
     *
     * @returns Promise that resolves once the automation panel (Strategy parameters) is visible.
     */
    async goToAutomatedTrading(): Promise<void> {
        if (this.isMobile) {
            await expect(this.bottomNavAutomate, 'Automate bottom-nav item should be visible').toBeVisible();
            await this.bottomNavAutomate.click();
        } else {
            await expect(this.automatedTradingTab, 'Automated trading tab should be visible').toBeVisible();
            await this.automatedTradingTab.click();
        }

        await NavigationUtils.waitForDerivApiSettled(this.page);
        await expect(
            this.strategyParametersHeader,
            'Automation panel (Strategy parameters) should be visible'
        ).toBeVisible();
    }

    /**
     * Open the automation guide for the active trade type and verify the popup content.
     * Desktop: Quill Modal — dismiss via the **X** close icon. Mobile: ActionSheet — dismiss via **Got it**.
     *
     * @param guideTitle - Trade-type title as shown in the trigger, e.g. `'Accumulators'`.
     */
    async openAndVerifyAutomateGuide(guideTitle: string): Promise<void> {
        const trigger = this.automateGuideTrigger(guideTitle);
        await expect(
            trigger,
            `Automate guide trigger should show 'Automate ${guideTitle}' for this trade type`
        ).toBeVisible();
        await trigger.click();

        const popup = this.automationGuidePopup;
        await expect(popup, 'Automation guide popup should open after clicking the trigger').toBeVisible();
        await this.verifyAutomateGuidePopupContent(popup, guideTitle);
        await this.dismissAutomateGuide(popup);
    }

    /** Close the automation guide — desktop X icon, mobile Got it footer button. */
    private async dismissAutomateGuide(popup: Locator): Promise<void> {
        if (this.isMobile) {
            await expect(
                this.automationGuideGotItButton,
                'Got it button should be visible in the guide popup'
            ).toBeVisible();
            await this.automationGuideGotItButton.click();
        } else {
            await expect(
                this.automationGuideGotItButton,
                'Got it button should be visible in the guide modal'
            ).toBeVisible();
            const closeButton = this.automationGuideCloseButton(popup);
            await expect(closeButton, 'Guide modal close icon should be visible').toBeVisible();
            await closeButton.click();
        }
        await expect(popup, 'Automation guide popup should close after dismiss').not.toBeVisible();
    }

    /**
     * Assert the automation guide popup body — trade-type description, strategy chips/copy,
     * Martingale parameter list, and warning. Source: automation-guide-config.ts.
     */
    private async verifyAutomateGuidePopupContent(popup: Locator, guideTitle: string): Promise<void> {
        const tradeTypeDescription = TradeAutomatePage.AUTOMATE_GUIDE_TRADE_TYPE_DESCRIPTIONS[guideTitle];
        if (!tradeTypeDescription) {
            throw new Error(
                `verifyAutomateGuidePopupContent: no description configured for guide title '${guideTitle}'. ` +
                    'Add an entry to AUTOMATE_GUIDE_TRADE_TYPE_DESCRIPTIONS.'
            );
        }

        const content = this.automationGuideContent(popup);
        await expect(content, 'Automation guide content container should be visible').toBeVisible();

        await expect(
            popup.getByRole('heading', { name: `Automate ${guideTitle}`, exact: true }),
            `Guide popup title should be 'Automate ${guideTitle}'`
        ).toBeVisible();
        await expect(
            popup.getByRole('heading', { name: `What is ${guideTitle}?`, exact: true }),
            `Guide popup should explain what ${guideTitle} is`
        ).toBeVisible();
        await expect(
            content
                .locator('.automation-guide-content__section')
                .first()
                .locator('.automation-guide-content__paragraph'),
            `Guide popup should describe ${guideTitle}`
        ).toHaveText(tradeTypeDescription);

        await expect(
            popup.getByRole('heading', { name: 'Strategies overview', exact: true }),
            'Guide popup should include the Strategies overview section'
        ).toBeVisible();

        await this.verifyAutomateGuideStrategyInfo(content);

        await this.verifyAutomateGuideStrategy(content, popup, 'Martingale', { clickChip: false });
        await this.verifyAutomateGuideStrategy(content, popup, "D'Alembert", { clickChip: true });
        await this.verifyAutomateGuideStrategy(content, popup, 'Martingale', { clickChip: true });
    }

    /**
     * Assert the "More info about strategies" icon beside Strategies overview.
     * Desktop: hover tooltip. Mobile: ActionSheet with Strategy overview. Source: automation-guide-content.tsx.
     */
    private async verifyAutomateGuideStrategyInfo(content: Locator): Promise<void> {
        const infoIcon = content.locator('.automation-guide-content__info-icon');
        await expect(infoIcon, 'Strategy info icon should be visible next to Strategies overview').toBeVisible();
        await expect(infoIcon, 'Strategy info icon should have the More info label').toHaveAttribute(
            'aria-label',
            'More info about strategies'
        );

        if (this.isMobile) {
            await infoIcon.click();
            const strategyInfoSheet = this.page.locator('.quill-action-sheet--root:visible').filter({
                has: this.page.locator('.automation-guide__strategy-info'),
            });
            await expect(strategyInfoSheet, 'Strategy overview sheet should open from the info icon').toBeVisible();
            await expect(
                strategyInfoSheet.getByRole('heading', { name: 'Strategy overview', exact: true }),
                'Strategy overview sheet should have the correct title'
            ).toBeVisible();
            await expect(
                strategyInfoSheet.getByText(TradeAutomatePage.AUTOMATE_GUIDE_STRATEGY_INFO_TEXT),
                'Strategy overview sheet should explain what strategies are'
            ).toBeVisible();
            await strategyInfoSheet.getByRole('button', { name: 'Close', exact: true }).click();
            await expect(strategyInfoSheet, 'Strategy overview sheet should close after Close').not.toBeVisible();
        } else {
            // Quill Tooltip portals to body; a one-shot hover can miss mouseenter inside the
            // modal (layout shift → mouseleave). Re-hover while asserting the portal.
            await expect(async () => {
                await infoIcon.hover();
                await expect(
                    this.automationGuideStrategyInfoTooltip,
                    'Strategy info tooltip should be visible'
                ).toBeVisible({ timeout: 2_000 });
            }).toPass();
            await expect(
                this.automationGuideStrategyInfoTooltip,
                'Strategy info tooltip should explain what strategies are'
            ).toHaveText(TradeAutomatePage.AUTOMATE_GUIDE_STRATEGY_INFO_TEXT);
        }
    }

    /**
     * Select a strategy chip in the guide popup (optional) and assert its description,
     * parameter list, and warning. Source: automation-guide-config.ts.
     */
    private async verifyAutomateGuideStrategy(
        content: Locator,
        popup: Locator,
        strategy: 'Martingale' | "D'Alembert",
        options: { clickChip: boolean }
    ): Promise<void> {
        const chip = this.automationGuideStrategyChip(content, strategy);
        await expect(chip, `${strategy} strategy chip should be visible in the guide`).toBeVisible();

        if (options.clickChip) {
            await chip.click();
        }

        await expect(chip, `${strategy} chip should be selected in the guide`).toHaveAttribute(
            'data-state',
            'selected'
        );

        const strategyCopy = TradeAutomatePage.AUTOMATE_GUIDE_STRATEGIES[strategy];
        await expect(
            content.getByText(strategyCopy.description()),
            `Guide popup should show the ${strategy} strategy description`
        ).toBeVisible();

        await expect(
            popup.getByRole('heading', { name: '5 parameters needed', exact: true }),
            `Guide popup should list five ${strategy} parameters`
        ).toBeVisible();

        for (const parameterLabel of strategyCopy.parameters()) {
            await expect(
                content.locator('.automation-guide-content__param-body').getByText(parameterLabel, { exact: true }),
                `Guide popup should list the '${parameterLabel}' parameter for ${strategy}`
            ).toBeVisible();
        }

        await expect(
            content.locator('.automation-guide-content__warning'),
            `${strategy} warning callout should be visible`
        ).toBeVisible();
        await expect(
            content.getByText(strategyCopy.warning()),
            `Guide popup should show the ${strategy} warning`
        ).toBeVisible();
    }

    /**
     * Start the automation run with the current (default) configuration.
     * Waits for the Run button to be enabled before clicking.
     *
     * @returns Promise that resolves once the Run button has been clicked.
     */
    async startAutomateRun(): Promise<void> {
        await expect(this.runButton, 'Run button should be visible before starting').toBeVisible();
        await expect(this.runButton, 'Run button should be enabled before starting').toBeEnabled();
        await this.runButton.click();
    }

    /**
     * Stop the active automation run, close any remaining open contracts, and verify controls
     * return to the idle Run state with trade-form and automation-panel params enabled again.
     *
     * @returns Promise that resolves once Stop is clicked and the run has returned to idle.
     */
    async stopAutomateRun(): Promise<void> {
        await expect(this.stopButton, 'Stop button should be visible while a run is active').toBeVisible();
        await expect(this.stopButton, 'Stop button should be enabled before stopping').toBeEnabled();
        await this.stopButton.click();
        await expect(this.pauseButton, 'Pause button should no longer be visible after stopping').not.toBeVisible();
        await expect(this.stopButton, 'Stop button should no longer be visible after stopping').not.toBeVisible();
        await expect(this.runButton, 'Run button should reappear after stopping the run').toBeVisible();
        await expect(this.statusRunning, 'Running status should no longer be visible after stopping').not.toBeVisible();
        await this.verifyAutomatePostIdleState(this.selectedTradeType);
    }

    /**
     * Cleanup helper — stop any still-active run so subsequent tests start clean.
     * Safe to call when no run is active (no Stop button present). When a run IS active, the
     * stop click and the resulting return-to-idle are asserted, so a genuine cleanup failure
     * surfaces rather than being silently swallowed.
     *
     * @returns Promise that resolves once no run is active.
     */
    async stopAutomateRunIfActive(): Promise<void> {
        const hasActiveRun = await this.stopButton.isVisible().catch(() => false);
        if (!hasActiveRun) return;
        await this.stopButton.click();
        await expect(this.runButton, 'Run button should reappear after cleanup stop').toBeVisible({
            timeout: 30_000,
        });
    }

    /**
     * Pause the active run (click the Pause button).
     *
     * @returns Promise that resolves once the Pause button has been clicked.
     */
    async pauseRun(): Promise<void> {
        await expect(this.pauseButton, 'Pause button should be visible while running').toBeVisible();
        await expect(this.pauseButton, 'Pause button should be enabled before pausing').toBeEnabled();
        await this.pauseButton.click();
    }

    /**
     * Resume a paused run (click the Resume button).
     *
     * @returns Promise that resolves once the Resume button has been clicked.
     */
    async resumeRun(): Promise<void> {
        await expect(this.resumeButton, 'Resume button should be visible while paused').toBeVisible();
        await expect(this.resumeButton, 'Resume button should be enabled before resuming').toBeEnabled();
        await this.resumeButton.click();
    }

    /**
     * Open the Strategy selector, confirm both bundled strategies are offered, select one if
     * needed, then set the strategy-specific stake parameter (multiplier or increment).
     *
     * Both bundled strategies (Martingale, D'Alembert) are asserted present when the picker
     * opens so the test doubles as coverage of the selector's contents.
     */
    async selectStrategy({
        strategy,
        stakeMultiplier,
        stakeIncrement,
    }: {
        strategy: 'Martingale' | "D'Alembert";
        stakeMultiplier?: number;
        stakeIncrement?: number;
    }): Promise<void> {
        if ((await this.strategyField.inputValue()).trim() !== strategy) {
            await this.strategyField.click();
            await expect(
                this.strategyOption('Martingale'),
                'Martingale should be offered in the strategy selector'
            ).toBeVisible();
            await expect(
                this.strategyOption("D'Alembert"),
                "D'Alembert should be offered in the strategy selector"
            ).toBeVisible();
            await this.strategyOption(strategy).click();
            if (this.isMobile) {
                await expect(
                    this.actionSheetSaveButton(this.strategySheet),
                    'Strategy Save should enable after choosing a different strategy'
                ).toBeEnabled();
                await this.saveMobileSheet(this.strategySheet);
                await expect(this.strategySheet, 'Strategy sheet should close after Save').not.toBeVisible();
            }
            await expect(this.strategyField, `Strategy field should show '${strategy}' after selection`).toHaveValue(
                strategy
            );
        }

        if (strategy === 'Martingale') {
            if (stakeMultiplier === undefined) {
                throw new Error('stakeMultiplier is required when strategy is Martingale');
            }
            await this.setStakeMultiplier(stakeMultiplier);
        } else {
            if (stakeIncrement === undefined) {
                throw new Error("stakeIncrement is required when strategy is D'Alembert");
            }
            await this.setStakeIncrement(stakeIncrement);
        }
    }

    /**
     * Set D'Alembert's Stake increment via a preset chip. The chips tab is shown by default, so the
     * chip is clickable immediately with no tab switch; the field then reads `"{value} unit"`.
     *
     * @param value - A preset increment to pick (one of the chip presets, e.g. `3`).
     * @returns Promise that resolves once the Stake increment field reflects the value.
     */
    async setStakeIncrement(value: number): Promise<void> {
        await this.setStakeMultiplierOrIncrement(value, 'Stake increment', this.stakeIncrementField);
    }

    /**
     * Set Martingale's Stake multiplier via a preset chip. The field displays `x{value}` (e.g. `x2`).
     *
     * @param value - A preset multiplier to pick (one of the chip presets, e.g. `2`).
     */
    async setStakeMultiplier(value: number): Promise<void> {
        await this.setStakeMultiplierOrIncrement(value, 'Stake multiplier', this.stakeMultiplierField);
    }

    private async setStakeMultiplierOrIncrement(
        value: number,
        sheetTitle: 'Stake increment' | 'Stake multiplier',
        field: Locator
    ): Promise<void> {
        const expectedValue = sheetTitle === 'Stake multiplier' ? `x${value}` : `${value} unit`;
        if ((await field.inputValue()).trim() === expectedValue) {
            return;
        }
        await field.click();
        const sheet = this.automationInputSheet(sheetTitle);
        const chip = this.valueChip(value, sheetTitle);
        const input = this.automationInputField(sheetTitle);

        if (await chip.isVisible().catch(() => false)) {
            await chip.click();
            if (this.isMobile) {
                await expect(
                    this.actionSheetSaveButton(sheet),
                    `${sheetTitle} Save should enable after selecting a preset`
                ).toBeEnabled();
                await this.saveMobileSheet(sheet);
                await expect(sheet, `${sheetTitle} sheet should close after Save`).not.toBeVisible();
            }
        } else {
            if (!this.isMobile) {
                await this.automationPopoverCustomTab.click();
            }
            await expect(input, `${sheetTitle} custom input should be visible`).toBeVisible();
            await input.fill(String(value));
            if (this.isMobile) {
                await expect(
                    this.actionSheetSaveButton(sheet),
                    `${sheetTitle} Save should enable after entering a custom value`
                ).toBeEnabled();
                await this.saveMobileSheet(sheet);
                await expect(sheet, `${sheetTitle} sheet should close after Save`).not.toBeVisible();
            } else {
                await this.automationPopoverSaveButton.click();
            }
        }

        await expect(field, `${sheetTitle} field should show '${expectedValue}' after saving`).toHaveValue(
            expectedValue
        );
    }

    /**
     * Enable Max. stake and set the cap. Must be ≥ the trade-form initial stake.
     *
     * @param amount - Max stake in account currency as a string, e.g. `'10'`.
     * @param initialStake - Current initial stake on the trade form (validation requires max ≥ initial).
     */
    async setMaxStake(amount: string, initialStake: string): Promise<void> {
        const expectedValue = `$${amount}`;
        const current = (await this.maxStakeField.inputValue()).trim();
        if (current === expectedValue) {
            return;
        }
        const sheet = this.automationInputSheet('Max. stake');
        const input = this.automationInputField('Max. stake');
        await this.maxStakeField.click();
        await expect(input, 'Max. stake input should be visible after opening the field').toBeVisible();
        const toggle = this.maxStakeToggle(this.isMobile ? sheet : this.page.locator('.automation-popover:visible'));
        const isEnabled =
            (await toggle.getAttribute('aria-checked')) === 'true' ||
            (await toggle.getAttribute('aria-pressed')) === 'true';
        if (!isEnabled) {
            await toggle.click();
        }
        await input.fill(amount);
        if (Number(amount) < Number(initialStake)) {
            throw new Error(`Max. stake (${amount}) must be equal or greater than initial stake (${initialStake})`);
        }
        if (this.isMobile) {
            await expect(
                this.actionSheetSaveButton(sheet),
                'Max. stake Save should enable after editing the draft'
            ).toBeEnabled();
            await this.saveMobileSheet(sheet);
            await expect(sheet, 'Max. stake sheet should close after Save').not.toBeVisible();
        } else {
            await this.automationPopoverSaveButton.click();
        }
        await expect(this.maxStakeField, `Max. stake field should show '${expectedValue}' after saving`).toHaveValue(
            expectedValue
        );
    }

    /**
     * Select the last-digit prediction for Matches/Differs and Over/Under automation runs.
     * Source: TradeDigitsPage.selectDigit.
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
     * Open a Risk-management threshold field's editor, type the amount, save, and confirm the
     * field reflects it. Shared by the loss- and profit-threshold setters.
     *
     * @param field  - The threshold field trigger locator (loss or profit).
     * @param amount - Threshold in the account currency as a string.
     * @returns Promise that resolves once the field shows the saved value.
     */
    private async setThreshold(
        field: Locator,
        amount: string,
        sheetTitle: 'Loss threshold' | 'Profit threshold'
    ): Promise<void> {
        const expectedValue = `$${amount}`;
        if ((await field.inputValue()).trim() === expectedValue) {
            return;
        }
        const sheet = this.automationInputSheet(sheetTitle);
        const input = this.automationInputField(sheetTitle);
        await field.click();
        await expect(input, 'Threshold input should be visible after opening the field').toBeVisible();
        await input.fill(amount);
        if (this.isMobile) {
            await expect(async () => {
                await expect(
                    this.actionSheetSaveButton(sheet),
                    'Threshold Save should enable after editing the draft'
                ).toBeEnabled({ timeout: 2_000 });
                await this.saveMobileSheet(sheet);
            }).toPass({ timeout: 20_000 });
            await expect(sheet, 'Threshold sheet should close after Save').not.toBeVisible();
        } else {
            await this.automationPopoverSaveButton.click();
        }
        await expect(field, `${sheetTitle} field should show '${expectedValue}' after saving`).toHaveValue(
            expectedValue
        );
    }

    /**
     * Set the Loss threshold (stop-loss). Use a small value (e.g. `'1'`) so a losing run
     * auto-stops quickly — the safety control Flow 3 exercises.
     *
     * @param amount - Threshold in the account currency as a string, e.g. `'1'`.
     * @returns Promise that resolves once the field shows the saved value.
     */
    async setLossThreshold(amount: string): Promise<void> {
        await this.setThreshold(this.lossThresholdField, amount, 'Loss threshold');
    }

    /**
     * Set the Profit threshold (take-profit). Set it high (e.g. `'1000'`) so the run cannot stop
     * on profit and can only stop on the loss threshold — this makes the loss auto-stop, and the
     * resulting negative closed P/L, deterministic (otherwise a few early wins could occasionally
     * trip the profit threshold instead, leaving a positive P/L).
     *
     * @param amount - Threshold in the account currency as a string, e.g. `'1000'`.
     * @returns Promise that resolves once the field shows the saved value.
     */
    async setProfitThreshold(amount: string): Promise<void> {
        await this.setThreshold(this.profitThresholdField, amount, 'Profit threshold');
    }

    /**
     * Select the growth rate for Accumulators automation runs.
     * Source: TradeAccumulatorsPage.setGrowthRate — same Growth rate param on the shared trade form.
     */
    async setGrowthRate(value: string): Promise<void> {
        if ((await this.growthRateField.inputValue()).trim() === value) {
            return;
        }
        await this.growthRateField.click();
        if (this.isMobile) {
            await this.selectWheelPickerOption('.growth-rate__wheel-picker', value);
            await this.saveMobileSheet(this.growthRateSheet);
        } else {
            await expect(
                this.page.getByRole('listbox', { name: 'Selection options' }),
                'Growth rate selection list should be visible after opening the popover'
            ).toBeVisible();
            await this.growthRateOption(value).click();
        }
        await expect(this.growthRateField, `Growth rate field should show '${value}' after selection`).toHaveValue(
            value
        );
    }

    /**
     * Rise/Fall automation lifecycle — configures trade params + automation panel, then Run → Stop.
     */
    async runRiseFallAndVerify({
        accountType,
        market,
        tradeType,
        durationUnit,
        durationValue,
        stake,
        automation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        tradeType: 'Rise' | 'Fall';
        durationUnit: string;
        durationValue: string;
        stake: string;
        automation: {
            strategy: 'Martingale' | "D'Alembert";
            stakeMultiplier?: number;
            stakeIncrement?: number;
            maxStake?: string;
            profitThreshold: string;
            lossThreshold: string;
        };
    }): Promise<void> {
        await this.goToAutomatedTrading();
        await this.switchToAccountType(accountType);
        await this.selectMarketAndTradeType(market, 'Rise/Fall', { mode: 'automate' });
        await this.selectTradeTypeOption(tradeType, tradeType === 'Rise' ? 'top' : 'bottom');
        await this.openAndVerifyAutomateGuide('Rise/Fall');
        await this.verifyAutomationPanelFieldsVisible();
        await this.selectDuration(durationUnit, durationValue);
        await this.setStake(stake);
        await this.selectStrategy({
            strategy: automation.strategy,
            stakeMultiplier: automation.stakeMultiplier,
            stakeIncrement: automation.stakeIncrement,
        });
        if (automation.maxStake !== undefined) {
            await this.setMaxStake(automation.maxStake, stake);
        }
        await this.setProfitThreshold(automation.profitThreshold);
        await this.setLossThreshold(automation.lossThreshold);
        await this.startAutomateRun();
        await this.verifyAutomateRunningControls(tradeType);
        await this.verifyAutomateSequentialContractPurchase();
        await this.verifyAutomateOpenPositionAndContractDetails({
            market,
            stake,
            tradeType,
            maxStake: automation.maxStake,
        });
        await this.verifyPauseAndResumeWhileRunning({ market, stake, tradeType, maxStake: automation.maxStake });
        await this.stopAutomateRun();
        await this.verifyAutomateStoppedWithClosedContract({ market, stake, tradeType });
    }

    /**
     * Accumulators automation lifecycle — growth rate, optional take profit, initial stake,
     * automation panel params, then Run → Stop.
     */
    async runAccumulatorsAndVerify({
        accountType,
        market,
        growthRate,
        stake,
        takeProfit,
        automation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        growthRate: string;
        stake: string;
        takeProfit?: string;
        automation: {
            strategy: 'Martingale' | "D'Alembert";
            stakeMultiplier?: number;
            stakeIncrement?: number;
            maxStake?: string;
            profitThreshold: string;
            lossThreshold: string;
        };
    }): Promise<void> {
        await this.goToAutomatedTrading();
        await this.switchToAccountType(accountType);
        await this.selectMarketAndTradeType(market, 'Accumulators', { mode: 'automate' });
        await this.openAndVerifyAutomateGuide('Accumulators');
        await this.verifyAutomationPanelFieldsVisible();
        await this.setGrowthRate(growthRate);
        await this.setStake(stake);
        if (takeProfit !== undefined) {
            await this.setTakeProfit(takeProfit);
        }
        await this.selectStrategy({
            strategy: automation.strategy,
            stakeMultiplier: automation.stakeMultiplier,
            stakeIncrement: automation.stakeIncrement,
        });
        if (automation.maxStake !== undefined) {
            await this.setMaxStake(automation.maxStake, stake);
        }
        await this.setProfitThreshold(automation.profitThreshold);
        await this.setLossThreshold(automation.lossThreshold);
        await this.startAutomateRun();
        await this.verifyAutomateBotIsRunning({
            market,
            stake,
            tradeType: 'Accumulators',
            growthRate,
            takeProfit,
            maxStake: automation.maxStake,
        });
        await this.verifyPauseAndResumeWhileRunning({
            market,
            stake,
            tradeType: 'Accumulators',
            currency: 'USD',
            growthRate,
            takeProfit,
            maxStake: automation.maxStake,
        });
        await this.stopAutomateRun();
        await this.verifyAutomateStoppedWithClosedContract({
            market,
            stake,
            tradeType: 'Accumulators',
            growthRate,
            takeProfit,
        });
    }

    /**
     * Matches/Differs automation lifecycle — last-digit prediction, tick duration, stake,
     * automation panel params, then Run → Stop.
     */
    async runMatchesDiffersAndVerify({
        accountType,
        market,
        tradeType,
        durationTicks,
        digit,
        stake,
        automation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        tradeType: 'Matches' | 'Differs';
        durationTicks: string;
        digit: string;
        stake: string;
        automation: {
            strategy: 'Martingale' | "D'Alembert";
            stakeMultiplier?: number;
            stakeIncrement?: number;
            maxStake?: string;
            profitThreshold: string;
            lossThreshold: string;
        };
    }): Promise<void> {
        await this.goToAutomatedTrading();
        await this.switchToAccountType(accountType);
        await this.selectMarketAndTradeType(market, 'Matches/Differs', { mode: 'automate' });
        await this.selectTradeTypeOption(tradeType, tradeType === 'Matches' ? 'top' : 'bottom');
        await this.openAndVerifyAutomateGuide('Matches/Differs');
        await this.verifyAutomationPanelFieldsVisible();
        await this.selectDigit(digit);
        await this.selectDuration('Ticks', durationTicks);
        await this.setStake(stake);
        await this.selectStrategy({
            strategy: automation.strategy,
            stakeMultiplier: automation.stakeMultiplier,
            stakeIncrement: automation.stakeIncrement,
        });
        if (automation.maxStake !== undefined) {
            await this.setMaxStake(automation.maxStake, stake);
        }
        await this.setProfitThreshold(automation.profitThreshold);
        await this.setLossThreshold(automation.lossThreshold);
        await this.startAutomateRun();
        await this.verifyAutomateRunningControls(tradeType);
        await this.verifyAutomateSequentialContractPurchase();
        await this.verifyAutomateOpenPositionAndContractDetails({
            market,
            stake,
            tradeType,
            maxStake: automation.maxStake,
        });
        await this.verifyPauseAndResumeWhileRunning({ market, stake, tradeType, maxStake: automation.maxStake });
        await this.stopAutomateRun();
        await this.verifyAutomateStoppedWithClosedContract({ market, stake, tradeType });
    }

    /**
     * Over/Under automation lifecycle — last-digit prediction, tick duration, stake,
     * automation panel params, then Run → Stop.
     */
    async runOverUnderAndVerify({
        accountType,
        market,
        tradeType,
        durationTicks,
        digit,
        stake,
        automation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        tradeType: 'Over' | 'Under';
        durationTicks: string;
        digit: string;
        stake: string;
        automation: {
            strategy: 'Martingale' | "D'Alembert";
            stakeMultiplier?: number;
            stakeIncrement?: number;
            maxStake?: string;
            profitThreshold: string;
            lossThreshold: string;
        };
    }): Promise<void> {
        await this.goToAutomatedTrading();
        await this.switchToAccountType(accountType);
        await this.selectMarketAndTradeType(market, 'Over/Under', { mode: 'automate' });
        await this.selectTradeTypeOption(tradeType, tradeType === 'Over' ? 'top' : 'bottom');
        await this.openAndVerifyAutomateGuide('Over/Under');
        await this.verifyAutomationPanelFieldsVisible();
        await this.selectDigit(digit);
        await this.selectDuration('Ticks', durationTicks);
        await this.setStake(stake);
        await this.selectStrategy({
            strategy: automation.strategy,
            stakeMultiplier: automation.stakeMultiplier,
            stakeIncrement: automation.stakeIncrement,
        });
        if (automation.maxStake !== undefined) {
            await this.setMaxStake(automation.maxStake, stake);
        }
        await this.setProfitThreshold(automation.profitThreshold);
        await this.setLossThreshold(automation.lossThreshold);
        await this.startAutomateRun();
        await this.verifyAutomateRunningControls(tradeType);
        await this.verifyAutomateSequentialContractPurchase();
        await this.verifyAutomateOpenPositionAndContractDetails({
            market,
            stake,
            tradeType,
            maxStake: automation.maxStake,
        });
        await this.verifyPauseAndResumeWhileRunning({ market, stake, tradeType, maxStake: automation.maxStake });
        await this.stopAutomateRun();
        await this.verifyAutomateStoppedWithClosedContract({ market, stake, tradeType });
    }

    /**
     * Even/Odd automation lifecycle — tick duration (no last-digit prediction), stake,
     * automation panel params, then Run → Stop.
     */
    async runEvenOddAndVerify({
        accountType,
        market,
        tradeType,
        durationTicks,
        stake,
        automation,
    }: {
        accountType: 'real' | 'demo';
        market: string;
        tradeType: 'Even' | 'Odd';
        durationTicks: string;
        stake: string;
        automation: {
            strategy: 'Martingale' | "D'Alembert";
            stakeMultiplier?: number;
            stakeIncrement?: number;
            maxStake?: string;
            profitThreshold: string;
            lossThreshold: string;
        };
    }): Promise<void> {
        await this.goToAutomatedTrading();
        await this.switchToAccountType(accountType);
        await this.selectMarketAndTradeType(market, 'Even/Odd', { mode: 'automate' });
        await this.selectTradeTypeOption(tradeType, tradeType === 'Even' ? 'top' : 'bottom');
        await this.openAndVerifyAutomateGuide('Even/Odd');
        await this.verifyAutomationPanelFieldsVisible();
        await this.selectDuration('Ticks', durationTicks);
        await this.setStake(stake);
        await this.selectStrategy({
            strategy: automation.strategy,
            stakeMultiplier: automation.stakeMultiplier,
            stakeIncrement: automation.stakeIncrement,
        });
        if (automation.maxStake !== undefined) {
            await this.setMaxStake(automation.maxStake, stake);
        }
        await this.setProfitThreshold(automation.profitThreshold);
        await this.setLossThreshold(automation.lossThreshold);
        await this.startAutomateRun();
        await this.verifyAutomateRunningControls(tradeType);
        await this.verifyAutomateSequentialContractPurchase();
        await this.verifyAutomateOpenPositionAndContractDetails({
            market,
            stake,
            tradeType,
            maxStake: automation.maxStake,
        });
        await this.verifyPauseAndResumeWhileRunning({ market, stake, tradeType, maxStake: automation.maxStake });
        await this.stopAutomateRun();
        await this.verifyAutomateStoppedWithClosedContract({ market, stake, tradeType });
    }

    /**
     * Assert the automation panel fields are visible with default Martingale config —
     * strategy parameters, risk management, and Run. Used in trade-type lifecycle flows
     * after the guide closes (headers/Run are not re-checked from earlier steps).
     */
    private async verifyAutomationPanelFieldsVisible(): Promise<void> {
        await expect(this.strategyParametersHeader, 'Strategy parameters header should be visible').toBeVisible();
        await expect(this.strategyField, 'Strategy field should be visible').toBeVisible();
        await expect(this.strategyField, 'Default strategy should be Martingale').toHaveValue('Martingale');
        await expect(
            this.stakeMultiplierField,
            'Stake multiplier field should be visible for Martingale'
        ).toBeVisible();

        await expect(this.riskManagementHeader, 'Risk management header should be visible').toBeVisible();
        await expect(this.profitThresholdField, 'Profit threshold field should be visible').toBeVisible();
        await expect(this.lossThresholdField, 'Loss threshold field should be visible').toBeVisible();
        await expect(this.maxStakeField, 'Max. stake field should be visible').toBeVisible();

        await expect(this.runButton, 'Run button should be visible on the automation panel').toBeVisible();
    }

    /**
     * Verify the automation panel loaded with its default state: both section headers, the
     * default Martingale strategy, strategy/risk fields, and an enabled Run button.
     *
     * @returns Promise that resolves once all default-state assertions pass.
     */
    async verifyPanelDefaultState(): Promise<void> {
        await this.verifyAutomationPanelFieldsVisible();
        await expect(this.runButton, 'Run button should be enabled in the default state').toBeEnabled();
    }

    /**
     * Verify running controls and locked params — fast check before sequential purchase timing.
     */
    private async verifyAutomateRunningControls(tradeType: string): Promise<void> {
        await expect(
            this.automationActionsStatus,
            'Automation status block should be visible while the bot is running'
        ).toBeVisible();
        await expect(this.statusRunning, 'Status line text should be "Status: Running"').toHaveText('Status: Running');
        await expect(
            this.automationStatusInfoIcon,
            'Status info icon should be visible beside the Running status'
        ).toBeVisible();
        await expect(this.automationStats, 'Stats line should read "Contracts: N | P/L: $X.XX"').toHaveText(
            /Contracts:\s*\d+\s*\|\s*P\/L:\s*-?\$[\d,]+\.\d{2}/
        );
        await expect(this.pauseButton, 'Pause button label should be "Pause"').toHaveText('Pause');
        await expect(this.pauseButton, 'Pause button should be enabled while running').toBeEnabled();
        await expect(this.stopButton, 'Stop button label should be "Stop"').toHaveText('Stop');
        await expect(this.stopButton, 'Stop button should be enabled while running').toBeEnabled();
        await expect(this.runButton, 'Run button should be hidden while the bot is running').not.toBeVisible();
        await this.verifyTradeAndAutomationParamsState(tradeType, 'disabled');
    }

    /**
     * Verify exactly one open automation position and its contract details overlay.
     * Retries when short-lived contracts settle between Positions and details.
     */
    private async verifyAutomateOpenPositionAndContractDetails({
        market,
        stake,
        tradeType,
        currency = 'USD',
        growthRate,
        takeProfit,
        maxStake,
    }: {
        market: string;
        stake: string;
        tradeType: string;
        currency?: string;
        growthRate?: string;
        takeProfit?: string;
        maxStake?: string;
    }): Promise<void> {
        await expect(async () => {
            if (/\/contract\//.test(this.page.url())) {
                if (await this.contractDetailsPage.isAutomationContractDetailsClosed()) {
                    await this.contractDetailsPage.closeContractDetails();
                }
            }
            await this.positionsPage.verifyAutomationOpenPositionVisible(market, tradeType, currency, stake, {
                allowStrategyAdjustedStake: true,
                maxStake,
            });
            await this.positionsPage.openFirstContract();
            if (!(await this.contractDetailsPage.isOpenAutomationContractDetails())) {
                await this.contractDetailsPage.closeContractDetails();
                throw new Error(ContractDetailsPage.AUTOMATION_CONTRACT_SETTLED_RETRY);
            }
            await this.contractDetailsPage.verifyAutomationOpenContractDetailsPage(market, tradeType, currency, stake, {
                growthRate,
                takeProfit,
                allowStrategyAdjustedStake: true,
                maxStake,
            });
        }).toPass({ timeout: 90_000 });
        await this.contractDetailsPage.closeContractDetails();
        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }
    }

    /**
     * Verify the run reached the Running state. Tolerates the transient "Starting..." — the
     * store only flips to running once the first contract is observed, which arrives async.
     *
     * Asserts the full running UI from automation-actions.tsx: status block, info icon, stats
     * line, Pause/Stop controls, trade-form + automation-panel params disabled per trade type,
     * an automation open position in Positions (exactly one — see
     * `verifyAutomationOpenPositionVisible`), open contract details verification, and Run hidden.
     *
     * Tick-duration lifecycles call `verifyAutomateRunningControls()` then
     * `verifyAutomateSequentialContractPurchase()` before open-position details so sequencing
     * is observed while the run is still active (short tick durations may already show
     * `Contracts` ≥ 2 by then — the sequential helper allows that).
     *
     * @param market - Market name from the spec, as shown on the Positions contract card
     * @param stake - Initial stake from the spec (formatted to two decimals on the card)
     * @param tradeType - Trade-type category from the spec, e.g. `'Accumulators'` or `'Rise/Fall'`
     * @param growthRate - Accumulators growth rate from the spec, e.g. `"5%"`.
     * @param takeProfit - Accumulators take profit when set in the spec.
     * @param maxStake - Automation max. stake cap; used to bound strategy-adjusted open stakes.
     * @returns Promise that resolves once the Running state + controls + stats are visible.
     */
    async verifyAutomateBotIsRunning({
        market,
        stake,
        tradeType,
        currency = 'USD',
        growthRate,
        takeProfit,
        maxStake,
    }: {
        market: string;
        stake: string;
        tradeType: string;
        currency?: string;
        growthRate?: string;
        takeProfit?: string;
        maxStake?: string;
    }): Promise<void> {
        await this.verifyAutomateRunningControls(tradeType);
        await this.verifyAutomateOpenPositionAndContractDetails({
            market,
            stake,
            tradeType,
            currency,
            growthRate,
            takeProfit,
            maxStake,
        });
    }

    /**
     * Parse the live `Contracts: N | P/L: …` stats line while a run is active.
     */
    async getAutomationContractsCount(): Promise<number> {
        await expect(this.automationStats, 'Automation stats line should be visible while running').toBeVisible();
        const statsText = (await this.automationStats.textContent()) ?? '';
        const match = statsText.match(/Contracts:\s*(\d+)/);
        if (!match) {
            throw new Error(`Could not parse contracts count from stats line: "${statsText}"`);
        }
        return Number.parseInt(match[1], 10);
    }

    /**
     * Verify the bot purchases contracts one at a time: exactly one open position while each
     * contract is live, that open settles (open count → 0), then exactly one open again once at
     * least a second contract has been purchased (`Contracts >= 2`; the cumulative counter may
     * already read 2–3+ on short tick durations before this helper starts — do not require
     * `Contracts === 1` up front).
     *
     * Call after `verifyAutomateRunningControls()` while the run is still active. Used for
     * tick-duration trade types where contracts expire on a predictable schedule. On mobile,
     * re-navigates to Automate before each stats read — Positions is a separate bottom-nav
     * route that unmounts `.automate-mobile__run-button`.
     */
    async verifyAutomateSequentialContractPurchase({ timeout = 120_000 }: { timeout?: number } = {}): Promise<void> {
        await this.goToAutomatedTrading();
        await expect(this.statusRunning, 'Bot should still be running during sequential contract checks').toHaveText(
            'Status: Running'
        );

        await expect(async () => {
            await this.goToAutomatedTrading();
            expect(
                await this.getAutomationContractsCount(),
                'At least one contract should be purchased while the bot is running'
            ).toBeGreaterThanOrEqual(1);
            await this.positionsPage.verifyExactlyOneOpenPosition();
        }).toPass({ timeout: 30_000 });

        let maxOpenCountSeen = 0;
        await expect
            .poll(
                async () => {
                    await this.goToAutomatedTrading();
                    const openCount = await this.positionsPage.getOpenPositionsCount();
                    maxOpenCountSeen = Math.max(maxOpenCountSeen, openCount);
                    return openCount;
                },
                {
                    message: 'First contract should close or expire (no open positions) before the bot purchases again',
                    timeout,
                }
            )
            .toBe(0);

        expect(maxOpenCountSeen, `Max open count seen: ${maxOpenCountSeen}`).toBeLessThanOrEqual(1);

        let contractsAtSecondOpen: number | null = null;
        await expect
            .poll(
                async () => {
                    await this.goToAutomatedTrading();
                    await expect(
                        this.statusRunning,
                        'Bot should still be running while waiting for the second purchase'
                    ).toHaveText('Status: Running');
                    const openCount = await this.positionsPage.getOpenPositionsCount();
                    const count = await this.getAutomationContractsCount();
                    if (openCount === 1 && count >= 2) {
                        contractsAtSecondOpen =
                            contractsAtSecondOpen === null ? count : Math.min(contractsAtSecondOpen, count);
                        return true;
                    }
                    return false;
                },
                {
                    message:
                        'A second contract should open (Contracts >= 2 with exactly one open position) while the bot is still running',
                    timeout: 60_000,
                    intervals: [250],
                }
            )
            .toBe(true);

        await this.positionsPage.verifyExactlyOneOpenPosition();
        expect(
            contractsAtSecondOpen,
            `At least two contracts should be purchased before the poll ends (first re-open seen at Contracts: ${contractsAtSecondOpen})`
        ).toBeGreaterThanOrEqual(2);

        await this.goToAutomatedTrading();
    }

    /**
     * After stopping an automation run, verify the settled contract in Positions (Closed tab)
     * and on the contract details overlay.
     */
    async verifyAutomateStoppedWithClosedContract({
        market,
        stake,
        tradeType,
        currency = 'USD',
        growthRate,
        takeProfit,
    }: {
        market: string;
        stake: string;
        tradeType: string;
        currency?: string;
        growthRate?: string;
        takeProfit?: string;
    }): Promise<void> {
        const profitLoss = await this.positionsPage.verifyAutomationClosedPositionVisible(
            market,
            tradeType,
            currency,
            stake
        );
        await this.positionsPage.openAutomationClosedContract(market, tradeType, stake, currency);
        await this.contractDetailsPage.verifyAutomationClosedContractDetailsPage(
            market,
            tradeType,
            currency,
            stake,
            profitLoss,
            { growthRate, takeProfit }
        );
        await this.contractDetailsPage.closeContractDetails();
        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }
    }

    /**
     * Assert trade-form params and automation-panel fields match the expected locked/unlocked state.
     * Trade-form checks follow `verifyParamsForTradeType`. Source: `is_automation_params_locked`.
     */
    private async verifyTradeAndAutomationParamsState(tradeType: string, state: 'disabled' | 'enabled'): Promise<void> {
        const locked = state === 'disabled';
        const assertField = async (field: Locator, label: string) => {
            if (locked) {
                await expect(field, `${label} should be disabled while automation is active`).toBeDisabled();
            } else {
                await expect(field, `${label} should be enabled after stopping`).toBeEnabled();
            }
        };

        await assertField(this.initialStakeField, 'Initial stake field');

        switch (tradeType) {
            case 'Rise/Fall':
            case 'Rise':
            case 'Fall':
                await assertField(this.durationField, 'Duration field');
                break;
            case 'Accumulators':
                await assertField(this.growthRateField, 'Growth rate field');
                // Take profit is disabled only while an open accu contract exists (`has_open_accu_contract`),
                // not via `is_automation_params_locked` — it stays enabled while the run is paused.
                break;
            case 'Matches/Differs':
            case 'Matches':
            case 'Differs':
                await this.assertLastDigitPredictionState(locked);
                await assertField(this.durationField, 'Duration field');
                break;
            case 'Over/Under':
            case 'Over':
            case 'Under':
                await this.assertLastDigitPredictionState(locked);
                await assertField(this.durationField, 'Duration field');
                break;
            case 'Even/Odd':
            case 'Even':
            case 'Odd':
                await assertField(this.durationField, 'Duration field');
                break;
            default:
                throw new Error(
                    `verifyTradeAndAutomationParamsState: no assertions defined for trade type '${tradeType}'. ` +
                        'Add a case before verifying param lock state for this type.'
                );
        }

        await expect(this.strategyParametersHeader, 'Strategy parameters header should remain visible').toBeVisible();
        await assertField(this.strategyField, 'Strategy field');
        if (await this.stakeMultiplierField.isVisible()) {
            await assertField(this.stakeMultiplierField, 'Stake multiplier field');
        } else {
            await assertField(this.stakeIncrementField, 'Stake increment field');
        }
        await assertField(this.maxStakeField, 'Max. stake field');

        await expect(this.riskManagementHeader, 'Risk management header should remain visible').toBeVisible();
        await assertField(this.profitThresholdField, 'Profit threshold field');
        await assertField(this.lossThresholdField, 'Loss threshold field');
    }

    /**
     * Last digit prediction lock state — mobile TextField vs desktop digit-button grid
     * (last-digit-prediction.tsx renders differently per viewport).
     */
    private async assertLastDigitPredictionState(locked: boolean): Promise<void> {
        const label = 'Last digit prediction';
        if (this.isMobile) {
            if (locked) {
                await expect(
                    this.digitPredictionField,
                    `${label} field should be disabled while running`
                ).toBeDisabled();
            } else {
                await expect(
                    this.digitPredictionField,
                    `${label} field should be enabled after stopping`
                ).toBeEnabled();
            }
            return;
        }

        await expect(this.lastDigitPredictionSection, `${label} selector should be visible`).toBeVisible();
        if (locked) {
            await expect(this.lastDigitPredictionSection, `${label} should be locked while running`).toHaveClass(
                /trade-params__field-locked/
            );
        } else {
            await expect(this.lastDigitPredictionSection, `${label} should be unlocked after stopping`).not.toHaveClass(
                /trade-params__field-locked/
            );
        }
    }

    /**
     * Verify the run is paused — full paused UI from automation-actions.tsx: status block,
     * info icon, stats line, Resume/Stop controls, Run hidden, trade-form + automation
     * panel params disabled, and no new contracts purchased during an observation window.
     */
    async verifyPaused({ tradeType }: { tradeType: string }): Promise<void> {
        await expect(
            this.automationActionsStatus,
            'Automation status block should be visible while the bot is paused'
        ).toBeVisible();
        await expect(this.statusPaused, 'Status line text should be "Status: Paused"').toHaveText('Status: Paused');
        await expect(
            this.automationStatusInfoIcon,
            'Status info icon should be visible beside the Paused status'
        ).toBeVisible();
        await expect(this.automationStats, 'Stats line should read "Contracts: N | P/L: $X.XX"').toHaveText(
            /Contracts:\s*\d+\s*\|\s*P\/L:\s*-?\$[\d,]+\.\d{2}/
        );
        await expect(this.resumeButton, 'Resume button label should be "Resume"').toHaveText('Resume');
        await expect(this.resumeButton, 'Resume button should be enabled while paused').toBeEnabled();
        await expect(this.stopButton, 'Stop button label should be "Stop"').toHaveText('Stop');
        await expect(this.stopButton, 'Stop button should be enabled while paused').toBeEnabled();
        await expect(this.pauseButton, 'Pause button should be hidden while paused').not.toBeVisible();
        await expect(this.runButton, 'Run button should be hidden while the bot is paused').not.toBeVisible();
        await this.verifyTradeAndAutomationParamsState(tradeType, 'disabled');
        await this.verifyNoNewContractsWhilePaused();
    }

    /**
     * While paused, poll for an observation window and assert the bot does not purchase new
     * contracts: stats `Contracts: N` stays fixed and open-positions count never exceeds the
     * count at pause time. An existing open contract may settle (count may drop to 0).
     */
    private async verifyNoNewContractsWhilePaused({
        observationMs = 15_000,
        pollIntervalMs = 2_000,
    }: { observationMs?: number; pollIntervalMs?: number } = {}): Promise<void> {
        await this.goToAutomatedTrading();
        await expect(this.statusPaused, 'Bot should be paused before observing contract activity').toHaveText(
            'Status: Paused'
        );

        const contractsBaseline = await this.getAutomationContractsCount();
        const openBaseline = await this.positionsPage.getOpenPositionsCount();
        const startedAt = Date.now();

        await expect
            .poll(
                async () => {
                    await this.goToAutomatedTrading();
                    await expect(this.statusPaused, 'Bot should remain paused during observation').toHaveText(
                        'Status: Paused'
                    );

                    const contractsCount = await this.getAutomationContractsCount();
                    const openCount = await this.positionsPage.getOpenPositionsCount();

                    if (contractsCount > contractsBaseline) {
                        throw new Error(
                            `Automation purchased a new contract while paused (Contracts: ${contractsBaseline} → ${contractsCount})`
                        );
                    }
                    if (openCount > openBaseline) {
                        throw new Error(`Open positions badge increased while paused (${openBaseline} → ${openCount})`);
                    }

                    return Date.now() - startedAt >= observationMs ? 'stable' : 'observing';
                },
                {
                    message:
                        `No new contracts should appear for ${observationMs}ms while paused ` +
                        `(baseline Contracts: ${contractsBaseline}, open badge: ${openBaseline})`,
                    timeout: observationMs + 30_000,
                    intervals: [pollIntervalMs],
                }
            )
            .toBe('stable');

        const openTabCount = await this.positionsPage.getOpenTabContractCount();
        expect(
            openTabCount,
            `Open tab should not list more contracts than at pause time (baseline ${openBaseline}, got ${openTabCount})`
        ).toBeLessThanOrEqual(openBaseline);

        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }
    }

    /**
     * Pause an active run, verify Paused, resume, and verify Running again (Flow 1).
     * Call after the bot has live contracts — e.g. after `verifyAutomateSequentialContractPurchase()`
     * on tick lifecycles, or after `verifyAutomateBotIsRunning()` on Accumulators.
     */
    async verifyPauseAndResumeWhileRunning({
        market,
        stake,
        tradeType,
        currency = 'USD',
        growthRate,
        takeProfit,
        maxStake,
    }: {
        market: string;
        stake: string;
        tradeType: string;
        currency?: string;
        growthRate?: string;
        takeProfit?: string;
        maxStake?: string;
    }): Promise<void> {
        await this.goToAutomatedTrading();
        await this.pauseRun();
        await this.verifyPaused({ tradeType });
        await this.resumeRun();
        await this.verifyAutomateBotIsRunning({
            market,
            stake,
            tradeType,
            currency,
            growthRate,
            takeProfit,
            maxStake,
        });
    }

    /**
     * Post-idle cleanup — close leftover open contracts, then assert Run is enabled and params unlock.
     * Accumulators keep Run disabled while an open accu contract exists (`has_open_accu_contract`).
     */
    private async verifyAutomatePostIdleState(tradeType: string): Promise<void> {
        await this.positionsPage.closeAllOpenContracts();
        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }
        await expect(this.runButton, 'Run button should be enabled once the run is idle').toBeEnabled();
        await this.verifyTradeAndAutomationParamsState(tradeType, 'enabled');
    }

    /**
     * Shared idle UI + param unlock checks after a loss- or profit-threshold auto-stop.
     */
    private async verifyThresholdAutoStopPostConditions(thresholdLabel: 'loss' | 'profit'): Promise<void> {
        const context = `after ${thresholdLabel}-threshold auto-stop`;

        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }
        await expect(
            this.automationActionsStatus,
            `Automation status block should be hidden ${context}`
        ).not.toBeVisible();
        await expect(this.statusRunning, `Running status should be hidden ${context}`).not.toBeVisible();
        await expect(this.statusPaused, `Paused status should be hidden ${context}`).not.toBeVisible();
        await expect(this.automationStatusInfoIcon, `Status info icon should be hidden ${context}`).not.toBeVisible();
        await expect(this.automationStats, `Automation stats line should be hidden ${context}`).not.toBeVisible();
        await expect(this.automationRunActions, `Pause/Stop action row should be hidden ${context}`).not.toBeVisible();
        await expect(this.pauseButton, `Pause button should be hidden ${context}`).not.toBeVisible();
        await expect(this.stopButton, `Stop button should be hidden ${context}`).not.toBeVisible();
        await expect(this.runButton, `Run button should be visible ${context}`).toBeVisible();
        await expect(this.runButton, `Run button should be enabled ${context}`).toBeEnabled();
        await this.verifyTradeAndAutomationParamsState(this.selectedTradeType, 'enabled');
    }

    /**
     * Verify the run auto-stopped once the loss threshold was reached — snackbar first, then idle
     * Run with no manual Stop click.
     *
     * Waits for the dismissible "Loss threshold reached. Automation stopped." snackbar, then
     * asserts the running status block, stats, info icon, and Pause/Stop are hidden, Run is
     * visible and enabled, and trade-form plus automation-panel params are unlocked again.
     *
     * @returns Promise that resolves once the auto-stop snackbar and idle state are confirmed.
     */
    async verifyLossThresholdAutoStop(): Promise<void> {
        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }

        await expect(
            this.lossThresholdAutoStopSnackbar,
            'Loss threshold auto-stop snackbar should appear when the threshold is reached'
        ).toBeVisible({ timeout: 120_000 });
        await expect(
            this.lossThresholdAutoStopSnackbar,
            'Loss threshold auto-stop snackbar should show the expected message'
        ).toHaveText(TradeAutomatePage.LOSS_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE);
        await expect(
            this.automationStopSnackbarCloseButton,
            'Loss threshold auto-stop snackbar should be dismissible'
        ).toBeVisible();

        await this.verifyThresholdAutoStopPostConditions('loss');
    }

    /**
     * Verify the run auto-stopped once the profit threshold was reached — snackbar first, then idle
     * Run with no manual Stop click.
     *
     * Waits for the dismissible "Profit threshold reached. Automation stopped." snackbar, then
     * asserts idle controls and re-enabled trade-form plus automation-panel params. Caller sets
     * loss threshold unreachable and profit threshold tiny so auto-stop can only mean profit threshold.
     *
     * @returns Promise that resolves once the auto-stop snackbar and idle state are confirmed.
     */
    async verifyProfitThresholdAutoStop(): Promise<void> {
        if (this.isMobile) {
            await this.goToAutomatedTrading();
        }

        await expect(
            this.profitThresholdAutoStopSnackbar,
            'Profit threshold auto-stop snackbar should appear when the threshold is reached'
        ).toBeVisible({ timeout: 120_000 });
        await expect(
            this.profitThresholdAutoStopSnackbar,
            'Profit threshold auto-stop snackbar should show the expected message'
        ).toHaveText(TradeAutomatePage.PROFIT_THRESHOLD_AUTO_STOP_SNACKBAR_MESSAGE);
        await expect(
            this.automationStopSnackbarCloseButton,
            'Profit threshold auto-stop snackbar should be dismissible'
        ).toBeVisible();

        await this.verifyThresholdAutoStopPostConditions('profit');
    }

    /** Max payout / Payout rows — desktop: `.stake-input-desktop__details`; mobile: stake sheet. */
    private get stakeDetailsRoot(): Locator {
        return this.isMobile
            ? this.stakeContainer.locator('.stake-content__details')
            : this.stakePopover.locator('.stake-input-desktop__details .stake-content__details');
    }

    private stakeDetailsRow(label: 'Max payout' | 'Payout'): Locator {
        // Mobile Rise/Fall appends the outcome — "Payout (Rise)" — desktop is plain "Payout".
        const labelLocator =
            label === 'Payout' ? this.page.getByText(/^Payout(\s|\(|$)/) : this.page.getByText(label, { exact: true });
        return this.stakeDetailsRoot.locator('.stake-content__details-row').filter({ has: labelLocator });
    }

    /** Parses a currency amount from a stake-details row (e.g. Max payout → 10000 from "$10,000.00"). */
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

    private get automationPopoverVisible(): Locator {
        return this.page.locator('.automation-popover:visible');
    }

    private maxStakeToggleHost(sheet: Locator): Locator {
        return this.isMobile ? sheet : this.automationPopoverVisible;
    }

    private async ensureToggleOn(toggle: Locator): Promise<void> {
        const isOn =
            (await toggle.getAttribute('aria-checked')) === 'true' ||
            (await toggle.getAttribute('aria-pressed')) === 'true';
        if (!isOn) {
            await toggle.click();
        }
    }

    /** Dismiss an open automation editor — reuses shared Manual/Automate dismiss helpers. */
    private async dismissAutomationEditor(sheet: Locator, popover: Locator, label = 'Editor'): Promise<void> {
        await this.dismissParameterEditor(sheet, popover, label);
    }

    override async dismissStakeEditor(): Promise<void> {
        await this.dismissParameterEditor(this.stakeContainer, this.stakePopover, 'Stake');
    }

    private async dismissAutomationSheet(sheet: Locator, label: string): Promise<void> {
        await this.dismissAutomationEditor(sheet, this.automationPopoverVisible, label);
    }

    /** Flow 15 — initial stake rejects below-min, empty, invalid format, max-payout, and above-balance drafts. */
    async verifyInitialStakeRejectsInvalidAmount(): Promise<void> {
        const priorValue = (await this.initialStakeField.inputValue()).trim();

        // Below market minimum — proposal validation blocks Save.
        await this.openStakeCustomInput();
        await this.fillStakeCustomDraft('0.01');
        await expect(
            this.stakeValidationMessage,
            'Stake editor should show a validation error after proposal validation'
        ).toHaveText(TradeParametersPage.STAKE_MIN_AMOUNT_ERROR, { timeout: 20_000 });
        await expect(
            this.stakeSaveButton,
            'Stake Save should stay disabled while the draft fails proposal validation'
        ).toBeDisabled();
        await this.dismissStakeEditor();
        await this.assertInitialStakeUnchanged(priorValue);

        // Empty draft — desktop: Save-click FE error; mobile: Save gated while empty.
        await this.openStakeCustomInput();
        await this.fillStakeCustomDraft('');
        if (this.isMobile) {
            await expect(
                this.stakeSaveButton,
                'Stake Save should stay disabled while the draft is empty'
            ).toBeDisabled();
        } else {
            await expect(this.stakeSaveButton, 'Stake Save should enable after clearing the draft').toBeEnabled();
            await this.stakeSaveButton.click();
            await expect(this.stakeValidationMessage, 'Stake editor should show required-field error').toHaveText(
                TradeParametersPage.STAKE_REQUIRED_ERROR
            );
        }
        await this.dismissStakeEditor();
        await this.assertInitialStakeUnchanged(priorValue);

        // Trailing decimal — FE format error (e.g. "1." ends with ".").
        await this.openStakeCustomInput();
        await this.fillStakeCustomDraft('1.');
        await expect(this.stakeValidationMessage, 'Stake editor should show invalid-number format error').toHaveText(
            TradeParametersPage.STAKE_INVALID_NUMBER_ERROR
        );
        await expect(
            this.stakeSaveButton,
            'Stake Save should stay disabled while the draft is not a valid number'
        ).toBeDisabled();
        await this.dismissStakeEditor();
        await this.assertInitialStakeUnchanged(priorValue);

        // Above max payout — read cap from stake details, then draft until Payout row errors.
        await this.openStakeCustomInput();
        const maxPayout = await this.readStakeDetailsAmount('Max payout');
        const stakeCandidates = [String(Math.ceil(maxPayout)), String(Math.ceil(maxPayout * 2))];
        let payoutExceeded = false;
        for (const stakeDraft of stakeCandidates) {
            await this.fillStakeCustomDraft(stakeDraft);
            try {
                await expect(
                    this.stakeDetailsRow('Payout'),
                    'Payout row should gain .error when payout exceeds max payout'
                ).toHaveClass(/error/, { timeout: 20_000 });
                await expect(
                    this.stakeValidationMessage,
                    'Stake input should show PayoutLimits validation after proposal'
                ).toHaveText(TradeParametersPage.STAKE_MAX_PAYOUT_ERROR, { timeout: 5_000 });
                payoutExceeded = true;
                break;
            } catch (error) {
                const isExpectTimeout =
                    error instanceof Error &&
                    (error.name === 'TimeoutError' ||
                        /timed out \d+ms/i.test(error.message) ||
                        /Timeout \d+ms exceeded/i.test(error.message));
                if (!isExpectTimeout) {
                    throw error;
                }
            }
        }
        expect(payoutExceeded, `Stake drafts ${stakeCandidates.join(', ')} should exceed max payout ${maxPayout}`).toBe(
            true
        );
        await expect(
            this.stakeSaveButton,
            'Stake Save should stay disabled while payout exceeds the maximum'
        ).toBeDisabled();
        await this.dismissStakeEditor();
        await this.assertInitialStakeUnchanged(priorValue);

        // Above current balance — balance hint (mobile also gates Save).
        const balanceHeader = (await this.balance.innerText()).replace(/,/g, '').trim();
        const balanceMatch = balanceHeader.match(/^([\d.]+)\s+([A-Z]+)$/);
        if (!balanceMatch) {
            throw new Error(`Could not parse balance header "${balanceHeader}"`);
        }
        const [, balanceAmount, currency] = balanceMatch;
        const expectedBalanceHint = TradeParametersPage.formatInsufficientBalanceHint(balanceAmount, currency);
        const stakeAboveBalance = (parseFloat(balanceAmount) + 0.01).toFixed(2);
        await this.openStakeCustomInput();
        await this.fillStakeCustomDraft(stakeAboveBalance);
        await expect(this.stakeValidationMessage, 'Stake editor should show insufficient-balance hint').toHaveText(
            expectedBalanceHint,
            { timeout: 20_000 }
        );
        if (this.isMobile) {
            await expect(
                this.stakeSaveButton,
                'Stake Save should stay disabled while the draft exceeds balance'
            ).toBeDisabled();
        }
        await this.dismissStakeEditor();
        await this.assertInitialStakeUnchanged(priorValue);
    }

    private async assertInitialStakeUnchanged(priorValue: string): Promise<void> {
        await expect(this.initialStakeField, 'Initial stake should keep its prior committed value').toHaveValue(
            priorValue
        );
    }

    /** Flow 15 — profit and loss threshold editors reject empty and zero (`ThresholdInput`). */
    async verifyAutomationThresholdsRejectInvalidAmount(): Promise<void> {
        const thresholds = [
            { field: this.profitThresholdField, sheetTitle: 'Profit threshold' as const },
            { field: this.lossThresholdField, sheetTitle: 'Loss threshold' as const },
        ];

        for (const { field, sheetTitle } of thresholds) {
            const priorValue = (await field.inputValue()).trim();
            const sheet = this.automationInputSheet(sheetTitle);
            const input = this.automationInputField(sheetTitle);
            const validationMessage = this.isMobile
                ? sheet.locator('.message__container__text')
                : this.page.locator('.automation-popover:visible .message__container__text');
            const saveButton = this.isMobile ? this.actionSheetSaveButton(sheet) : this.automationPopoverSaveButton;

            // Empty draft — desktop gates Save; mobile Save-click surfaces the same FE error as zero.
            await field.click();
            await expect(input, `${sheetTitle} input should be visible`).toBeVisible();
            await this.fillAutomationDraft(input, '');
            if (this.isMobile) {
                await expect(saveButton, `${sheetTitle} Save should enable for a cleared draft`).toBeEnabled();
                await saveButton.click();
                await expect(
                    validationMessage,
                    `${sheetTitle} should show positive-amount validation error`
                ).toHaveText(TradeAutomatePage.AUTOMATION_POSITIVE_AMOUNT_ERROR);
            } else {
                await expect(
                    saveButton,
                    `${sheetTitle} Save should stay disabled while the draft is empty`
                ).toBeDisabled();
            }
            await this.dismissAutomationSheet(sheet, sheetTitle);
            await expect(field, `${sheetTitle} should keep its prior committed value`).toHaveValue(priorValue);

            // Zero — Save-click surfaces positive-amount validation error.
            await field.click();
            await expect(input, `${sheetTitle} input should be visible`).toBeVisible();
            await this.fillAutomationDraft(input, '0');
            await expect(saveButton, `${sheetTitle} Save should enable for a changed draft`).toBeEnabled();
            await saveButton.click();
            await expect(validationMessage, `${sheetTitle} should show positive-amount validation error`).toHaveText(
                TradeAutomatePage.AUTOMATION_POSITIVE_AMOUNT_ERROR
            );
            if (!this.isMobile) {
                await expect(
                    saveButton,
                    `${sheetTitle} Save should stay disabled after validation error`
                ).toBeDisabled();
            }
            await this.dismissAutomationSheet(sheet, sheetTitle);
            await expect(field, `${sheetTitle} should keep its prior committed value`).toHaveValue(priorValue);
        }
    }

    /** Flow 15 — Martingale stake multiplier: range hint on open (#1369), then rejects empty / out-of-range drafts. */
    async verifyStakeMultiplierRejectsInvalidAmount(): Promise<void> {
        const priorValue = (await this.stakeMultiplierField.inputValue()).trim();
        const sheet = this.automationInputSheet('Stake multiplier');
        const input = this.automationInputField('Stake multiplier');
        const validationMessage = this.isMobile
            ? sheet.locator('.message__container__text')
            : this.page.locator('.automation-popover:visible .message__container__text');
        const saveButton = this.isMobile ? this.actionSheetSaveButton(sheet) : this.automationPopoverSaveButton;

        // Range hint under the Custom input (desktop was missing it pre-#1382).
        await this.stakeMultiplierField.click();
        if (!this.isMobile) {
            await this.automationPopoverCustomTab.click();
            await expect(input, 'Stake multiplier input should be visible').toBeVisible();
        }
        await expect(
            validationMessage,
            'Stake multiplier should show the Martingale range hint on open (#1369)'
        ).toHaveText(TradeAutomatePage.STAKE_MULTIPLIER_RANGE_ERROR);

        // Empty draft — Save gated while the field is empty (both viewports).
        await this.fillAutomationDraft(input, '');
        await expect(saveButton, 'Stake multiplier Save should stay disabled while the draft is empty').toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Stake multiplier');
        await expect(this.stakeMultiplierField, 'Stake multiplier should keep its prior committed value').toHaveValue(
            priorValue
        );

        // Below minimum — inline validation disables Save (both viewports).
        await this.stakeMultiplierField.click();
        if (!this.isMobile) {
            await this.automationPopoverCustomTab.click();
            await expect(input, 'Stake multiplier input should be visible').toBeVisible();
        }
        await this.fillAutomationDraft(input, '0');
        await expect(validationMessage, 'Stake multiplier should show range validation error').toHaveText(
            TradeAutomatePage.STAKE_MULTIPLIER_RANGE_ERROR
        );
        await expect(
            saveButton,
            'Stake multiplier Save should stay disabled while the draft is invalid'
        ).toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Stake multiplier');
        await expect(this.stakeMultiplierField, 'Stake multiplier should keep its prior committed value').toHaveValue(
            priorValue
        );

        // Exclusive lower bound — `1` fails because the range is > 1, not ≥ 1.
        await this.stakeMultiplierField.click();
        if (!this.isMobile) {
            await this.automationPopoverCustomTab.click();
            await expect(input, 'Stake multiplier input should be visible').toBeVisible();
        }
        await this.fillAutomationDraft(input, '1');
        await expect(
            validationMessage,
            'Stake multiplier should show range validation error at exclusive min'
        ).toHaveText(TradeAutomatePage.STAKE_MULTIPLIER_RANGE_ERROR);
        await expect(
            saveButton,
            'Stake multiplier Save should stay disabled at the exclusive lower bound'
        ).toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Stake multiplier');
        await expect(this.stakeMultiplierField, 'Stake multiplier should keep its prior committed value').toHaveValue(
            priorValue
        );

        // Above maximum — same inline gate (MULTIPLIER_MAX is 10).
        await this.stakeMultiplierField.click();
        if (!this.isMobile) {
            await this.automationPopoverCustomTab.click();
            await expect(input, 'Stake multiplier input should be visible').toBeVisible();
        }
        await this.fillAutomationDraft(input, '11');
        await expect(validationMessage, 'Stake multiplier should show range validation error').toHaveText(
            TradeAutomatePage.STAKE_MULTIPLIER_RANGE_ERROR
        );
        await expect(
            saveButton,
            'Stake multiplier Save should stay disabled while the draft is invalid'
        ).toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Stake multiplier');
        await expect(this.stakeMultiplierField, 'Stake multiplier should keep its prior committed value').toHaveValue(
            priorValue
        );
    }

    /** Flow 15 — D'Alembert stake increment: Minimum 1 hint on open (#1369), then rejects empty / zero drafts. */
    async verifyStakeIncrementRejectsInvalidAmount(): Promise<void> {
        const priorValue = (await this.stakeIncrementField.inputValue()).trim();
        const sheet = this.automationInputSheet('Stake increment');
        const input = this.automationInputField('Stake increment');
        const validationMessage = this.isMobile
            ? sheet.locator('.message__container__text')
            : this.page.locator('.automation-popover:visible .message__container__text');
        const saveButton = this.isMobile ? this.actionSheetSaveButton(sheet) : this.automationPopoverSaveButton;

        // Range hint under the Custom input (parity with mobile — #1369 / PR #1382).
        await this.stakeIncrementField.click();
        if (!this.isMobile) {
            await this.automationPopoverCustomTab.click();
            await expect(input, 'Stake increment input should be visible').toBeVisible();
        }
        await expect(
            validationMessage,
            'Stake increment should show the Minimum 1 range hint on open (#1369)'
        ).toHaveText(TradeAutomatePage.STAKE_INCREMENT_RANGE_HINT);

        // Empty draft — Save gated while the field is empty (both viewports).
        await this.fillAutomationDraft(input, '');
        await expect(saveButton, 'Stake increment Save should stay disabled while the draft is empty').toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Stake increment');
        await expect(this.stakeIncrementField, 'Stake increment should keep its prior committed value').toHaveValue(
            priorValue
        );

        // Below minimum — inline validation disables Save (both viewports).
        await this.stakeIncrementField.click();
        if (!this.isMobile) {
            await this.automationPopoverCustomTab.click();
            await expect(input, 'Stake increment input should be visible').toBeVisible();
        }
        await this.fillAutomationDraft(input, '0');
        await expect(validationMessage, 'Stake increment should show minimum validation error').toHaveText(
            TradeAutomatePage.STAKE_INCREMENT_MIN_ERROR
        );
        await expect(saveButton, 'Stake increment Save should stay disabled while the draft is invalid').toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Stake increment');
        await expect(this.stakeIncrementField, 'Stake increment should keep its prior committed value').toHaveValue(
            priorValue
        );
    }

    /**
     * Flow 15 — Max. stake rejects empty, zero, and a cap below the trade-form initial stake (`MaxTradeStake`).
     * Expects initial stake `1` (set in the spec before this call).
     */
    async verifyMaxStakeRejectsInvalidAmount(): Promise<void> {
        const priorValue = (await this.maxStakeField.inputValue()).trim();
        const sheet = this.automationInputSheet('Max. stake');
        const input = this.automationInputField('Max. stake');
        const validationMessage = this.isMobile
            ? sheet.locator('.message__container__text')
            : this.page.locator('.automation-popover:visible .message__container__text');
        const saveButton = this.isMobile ? this.actionSheetSaveButton(sheet) : this.automationPopoverSaveButton;

        // Empty draft — toggle on, Save gated while the amount field is empty.
        await this.maxStakeField.click();
        await expect(input, 'Max. stake input should be visible').toBeVisible();
        await this.ensureToggleOn(this.maxStakeToggle(this.maxStakeToggleHost(sheet)));
        await this.fillAutomationDraft(input, '');
        await expect(saveButton, 'Max. stake Save should stay disabled while the draft is empty').toBeDisabled();
        await this.dismissAutomationSheet(sheet, 'Max. stake');
        await expect(this.maxStakeField, 'Max. stake should keep its prior committed value').toHaveValue(priorValue);

        // Zero — Save-click surfaces positive-amount validation error.
        await this.maxStakeField.click();
        await expect(input, 'Max. stake input should be visible').toBeVisible();
        await this.ensureToggleOn(this.maxStakeToggle(this.maxStakeToggleHost(sheet)));
        await this.fillAutomationDraft(input, '0');
        await expect(saveButton, 'Max. stake Save should enable for a changed draft').toBeEnabled();
        await saveButton.click();
        await expect(validationMessage, 'Max. stake should show positive-amount validation error').toHaveText(
            TradeAutomatePage.AUTOMATION_POSITIVE_AMOUNT_ERROR
        );
        if (!this.isMobile) {
            await expect(saveButton, 'Max. stake Save should stay disabled after validation error').toBeDisabled();
        }
        await this.dismissAutomationSheet(sheet, 'Max. stake');
        await expect(this.maxStakeField, 'Max. stake should keep its prior committed value').toHaveValue(priorValue);

        // Below initial stake — cap must be ≥ trade-form initial stake.
        await this.maxStakeField.click();
        await expect(input, 'Max. stake input should be visible').toBeVisible();
        await this.ensureToggleOn(this.maxStakeToggle(this.maxStakeToggleHost(sheet)));
        await this.fillAutomationDraft(input, '0.5');
        await expect(saveButton, 'Max. stake Save should enable for a changed draft').toBeEnabled();
        await saveButton.click();
        await expect(validationMessage, 'Max. stake should show below-initial validation error').toHaveText(
            TradeAutomatePage.MAX_STAKE_BELOW_INITIAL_ERROR
        );
        if (!this.isMobile) {
            await expect(saveButton, 'Max. stake Save should stay disabled after validation error').toBeDisabled();
        }
        await this.dismissAutomationSheet(sheet, 'Max. stake');
        await expect(this.maxStakeField, 'Max. stake should keep its prior committed value').toHaveValue(priorValue);
    }

    /** Flow 15 — automation panel stays idle after rejected param drafts (Run visible, no active run). */
    async verifyAutomatePanelIdleAfterParamValidation(): Promise<void> {
        await expect(this.runButton, 'Run button should remain visible after param validation').toBeVisible();
        await expect(this.runButton, 'Run button should stay enabled after param validation').toBeEnabled();
        await expect(this.statusRunning, 'Automation should not be running after param validation').not.toBeVisible();
    }

    /**
     * Select a market in Automate and assert multiplier-only vs automatable handling.
     * Flow 16 — issues #916 (Range Break / multiplier-only snackbar) and #917 (Crash/Boom + Accumulators).
     */
    async verifyAutomateMarketCompatibility(options: {
        market: string;
        tradeType: string;
        expectAutomatable: boolean;
    }): Promise<void> {
        const { market, tradeType, expectAutomatable } = options;

        await this.goToAutomatedTrading();
        await this.selectMarketAndTradeType(market, tradeType, { mode: 'automate' });

        await expect(this.activeMarketTab, `Active tab should show market '${market}' in Automate`).toContainText(
            market
        );
        await expect(
            this.activeMarketTab,
            `Active tab should keep trade type '${tradeType}' after switching to Automate`
        ).toContainText(tradeType);
        await expect(
            this.strategyParametersHeader,
            'Automation panel should finish loading instead of hanging on trade-type spinner'
        ).toBeVisible();

        if (expectAutomatable) {
            await expect(
                this.automateGuideTrigger(tradeType),
                `Automate guide trigger for '${tradeType}' should be visible when the market is supported`
            ).toBeVisible();
            await expect(this.runButton, 'Run should stay enabled for automatable markets').toBeEnabled();
        } else {
            await expect(
                this.nonAutomatableSymbolSnackbar(market),
                `A snackbar should explain that '${market}' is unavailable for automated trading`
            ).toBeVisible();
            await expect(this.runButton, 'Run should be disabled for non-automatable markets').toBeDisabled();
        }
    }

    /** Authored tooltip copy for automation-panel parameter info icons (automation-config.ts). */
    static readonly AUTOMATE_PARAM_INFO_DESCRIPTIONS = {
        strategyMartingale:
            'Multiplies the stake by a configurable factor after each loss and resets to the initial stake after a win.',
        stakeMultiplier: [/Factor applied to the stake after each loss/],
        maxStakeMartingale:
            'Upper limit for stake multiplying. Must be at least your stake amount. If empty, there is no upper limit.',
        profitThreshold: 'Stop when total payout minus total stake reaches or exceeds this value. Must be > 0.',
        lossThreshold: 'Stop when total stake minus total payout reaches or exceeds this value. Must be > 0.',
    } as const;

    private static readonly MARTINGALE_STRATEGY_INFO_DESKTOP_PARAMS: ReadonlyArray<{
        label: AutomateParamInfoIconLabel;
        descriptions: ReadonlyArray<string | RegExp>;
    }> = [
        {
            label: 'Strategy',
            descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.strategyMartingale],
        },
        {
            label: 'Stake multiplier',
            descriptions: TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.stakeMultiplier,
        },
        {
            label: 'Max. stake',
            descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.maxStakeMartingale],
        },
        {
            label: 'Profit threshold',
            descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.profitThreshold],
        },
        {
            label: 'Loss threshold',
            descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.lossThreshold],
        },
    ];

    private static readonly MARTINGALE_STRATEGY_INFO_MOBILE_CHECKS: ReadonlyArray<{
        openField: string;
        icons: ReadonlyArray<{
            ariaLabel: string;
            descriptions: ReadonlyArray<string | RegExp>;
        }>;
    }> = [
        {
            openField: 'Strategy',
            icons: [
                {
                    ariaLabel: 'Strategy',
                    descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.strategyMartingale],
                },
            ],
        },
        {
            openField: 'Stake multiplier',
            icons: [
                {
                    ariaLabel: 'Stake multiplier',
                    descriptions: TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.stakeMultiplier,
                },
            ],
        },
        {
            openField: 'Max. stake',
            icons: [
                {
                    ariaLabel: 'Max. stake',
                    descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.maxStakeMartingale],
                },
            ],
        },
        {
            openField: 'Profit threshold',
            icons: [
                {
                    ariaLabel: 'Profit threshold',
                    descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.profitThreshold],
                },
            ],
        },
        {
            openField: 'Loss threshold',
            icons: [
                {
                    ariaLabel: 'Loss threshold',
                    descriptions: [TradeAutomatePage.AUTOMATE_PARAM_INFO_DESCRIPTIONS.lossThreshold],
                },
            ],
        },
    ];

    /**
     * Automate parameter info-icon coverage per market/trade type.
     * Strategy-panel params use automation-config copy; Accumulators also checks the shared
     * trade-form Growth rate / Take profit rows (same components as manual Flow 19).
     */
    static readonly AUTOMATE_PARAM_INFO_ICON_CASES: ReadonlyArray<{
        market: string;
        tradeType: string;
        strategyDesktopParams: ReadonlyArray<{
            label: AutomateParamInfoIconLabel;
            descriptions: ReadonlyArray<string | RegExp>;
        }>;
        strategyMobileChecks: ReadonlyArray<{
            openField: string;
            icons: ReadonlyArray<{
                ariaLabel: string;
                descriptions: ReadonlyArray<string | RegExp>;
            }>;
        }>;
        tradeFormDesktopParams?: ReadonlyArray<{
            label: 'Growth rate' | 'Take profit';
            descriptions: ReadonlyArray<string | RegExp>;
        }>;
        tradeFormMobileChecks?: ReadonlyArray<{
            openField: string;
            icons: ReadonlyArray<{
                ariaLabel: string;
                descriptions: ReadonlyArray<string | RegExp>;
            }>;
        }>;
    }> = [
        {
            market: 'Volatility 100 Index',
            tradeType: 'Rise/Fall',
            strategyDesktopParams: TradeAutomatePage.MARTINGALE_STRATEGY_INFO_DESKTOP_PARAMS,
            strategyMobileChecks: TradeAutomatePage.MARTINGALE_STRATEGY_INFO_MOBILE_CHECKS,
        },
        {
            market: 'Volatility 100 Index',
            tradeType: 'Accumulators',
            strategyDesktopParams: TradeAutomatePage.MARTINGALE_STRATEGY_INFO_DESKTOP_PARAMS,
            strategyMobileChecks: TradeAutomatePage.MARTINGALE_STRATEGY_INFO_MOBILE_CHECKS,
            tradeFormDesktopParams: [
                {
                    label: 'Growth rate',
                    descriptions: [TradeParametersPage.TRADE_PARAM_INFO_DESCRIPTIONS.growthRate],
                },
                {
                    label: 'Take profit',
                    descriptions: [TradeParametersPage.TRADE_PARAM_INFO_DESCRIPTIONS.takeProfit],
                },
            ],
            tradeFormMobileChecks: [
                {
                    openField: 'Growth rate',
                    icons: [
                        {
                            ariaLabel: 'Growth rate',
                            descriptions: [TradeParametersPage.TRADE_PARAM_INFO_DESCRIPTIONS.growthRate],
                        },
                    ],
                },
                {
                    openField: 'Take profit',
                    icons: [
                        {
                            ariaLabel: 'Take profit',
                            descriptions: [TradeParametersPage.TRADE_PARAM_INFO_DESCRIPTIONS.takeProfit],
                        },
                    ],
                },
            ],
        },
    ];

    private automateParamLabelByName(name: AutomateParamInfoIconLabel): Locator {
        switch (name) {
            case 'Strategy':
                return this.strategyLabel;
            case 'Stake multiplier':
                return this.stakeMultiplierLabel;
            case 'Max. stake':
                return this.maxStakeLabel;
            case 'Profit threshold':
                return this.profitThresholdLabel;
            case 'Loss threshold':
                return this.lossThresholdLabel;
            default:
                throw new Error(`Unknown automate param label: ${name}`);
        }
    }

    /**
     * Desktop automation-panel info icons stay hidden until the field is hovered, then reveal
     * authored copy in a TooltipPortal (shared TradeParameterPopover — issue #995).
     */
    async verifyAutomateParamInfoIconOnDesktop(
        labelName: AutomateParamInfoIconLabel,
        descriptions: ReadonlyArray<string | RegExp>
    ): Promise<void> {
        const labelLocator = this.automateParamLabelByName(labelName);
        const field = this.tradeParamFieldWithInfo(labelLocator);
        const iconWrapper = this.tradeParamInfoIconWrapper(labelLocator);
        const icon = iconWrapper.locator('.trade-params__info-icon');

        await expect(iconWrapper, `${labelName} info icon should be hidden before the field is hovered`).toHaveCSS(
            'opacity',
            '0'
        );
        await field.hover();
        await expect(iconWrapper, `${labelName} info icon should become visible when the field is hovered`).toHaveCSS(
            'opacity',
            '1'
        );

        for (const description of descriptions) {
            await icon.hover();
            await expect(this.tradeParamInfoTooltip, `${labelName} info tooltip should be visible`).toBeVisible();
            await expect(
                this.tradeParamInfoTooltip,
                `${labelName} info tooltip should include the authored description`
            ).toContainText(description);
        }
    }
}

type AutomateParamInfoIconLabel =
    | 'Strategy'
    | 'Stake multiplier'
    | 'Max. stake'
    | 'Profit threshold'
    | 'Loss threshold';
