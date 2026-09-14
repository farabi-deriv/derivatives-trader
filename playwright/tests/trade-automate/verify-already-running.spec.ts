/**
 * @name     Automate — "Automation is already running" adoption snackbar (G1)
 * @id       trade-automate-g1
 * @flow     playwright/flows/trade-automate/flow.md#gap-flows
 * @coverage playwright/flows/trade-automate/coverage.md (Section 2 — G1)
 *
 * Flow G1: "With a run active, click Run again (or open in a second context)"
 * → Snackbar: "Automation is already running for this account."; no duplicate run started.
 *
 * Reachability (from source): the Run button only renders while the store thinks it is
 * idle (`automation-actions.tsx`), and the store auto-adopts any server-side run on
 * mount/loginid change (`useAutomationStore.tsx recover()`) and on visibility/focus
 * (`resync()`). The snackbar is therefore only reachable from a STALE tab — one whose
 * store was initialised while no run existed and which never re-synced afterwards —
 * which is exactly the scenario the guard's source comment describes ("Another device
 * may have started a run for this account while this screen was parked").
 *
 * This spec models that with a second tab in the SAME browser context:
 * - a second tab shares the login session (no second login) but runs its own JS
 *   runtime, so its automation store is independent — same staleness semantics as a
 *   second device;
 * - it is opened BEFORE the run starts, so its mount `recover()` finds nothing and
 *   its Run button stays visible;
 * - it is never `bringToFront()`-ed after the run starts, so no visibility/focus
 *   resync can adopt the run before the Run click;
 * - when its Run button is clicked, `handleRunClick` runs its own `await resync()`
 *   (useRunControls.ts) which finds the other tab's run → snackbar + early return,
 *   so no duplicate `auto_start` is ever sent.
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { TradeAutomatePage } from '../../pages/TradeAutomatePage';
import { createAccountV2viaJS } from '../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Automate — Already-running guard', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';

        const account = await createAccountV2viaJS('real', {
            currency: 'USD',
            trading: true,
            backupAccount: process.env[backupEmailVar],
        });
        accountEmail = account.email;
        accountPassword = account.password;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    test.afterEach(async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.stopAutomateRunIfActive();
    });

    test('VERIFY Run click from a stale tab shows the already-running snackbar and starts no duplicate', async ({
        tradeAutomatePage,
        page,
    }) => {
        // Tab A (the fixture page): configure the run but do not start it yet.
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', {
            mode: 'automate',
        });
        await tradeAutomatePage.verifyPanelDefaultState();
        // Low stake so the live bot cannot burn much before it is stopped.
        await tradeAutomatePage.setStake('1');
        await tradeAutomatePage.selectDuration('Ticks', '10 ticks');

        // Tab B: a second tab in the same browser context. It shares the login session
        // (same origin storage) but is an independent app instance with its own store.
        // It must load BEFORE the run starts so its mount recover() finds no run —
        // that is what keeps its Run button visible (the staleness the guard protects).
        // Fixtures can only bind POMs to the fixture page, so tab B's POMs are built
        // directly on the new page — every locator still lives in the POM.
        const secondPage = await page.context().newPage();
        try {
            const secondTradeBasePage = new TradeBasePage(secondPage);
            const secondAutomatePage = new TradeAutomatePage(secondPage);
            await secondTradeBasePage.gotoTradePage();
            await secondAutomatePage.goToAutomatedTrading();
            await secondAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', {
                mode: 'automate',
            });
            // Tab B sits idle with Run visible — proves its store has not adopted any run.
            await secondAutomatePage.verifyPanelDefaultState();

            // Tab A: start the run. Tab B never learns about it (auto_list is not
            // subscribable and tab B gets no visibility/focus events), so its store goes
            // stale exactly like the "parked screen" in the guard's source comment.
            await tradeAutomatePage.startAutomateRun();
            await expect(
                tradeAutomatePage.statusRunning,
                'Tab A: run should reach Status: Running before the stale-tab click'
            ).toBeVisible({ timeout: 60_000 });

            // Tab B: still showing Run (stale) — assert the premise right before clicking.
            await expect(
                secondAutomatePage.runButton,
                'Tab B: Run should still be visible (stale store)'
            ).toBeVisible();
            await expect(
                secondAutomatePage.runButton,
                'Tab B: Run should still be enabled (stale store)'
            ).toBeEnabled();
            await secondAutomatePage.runButton.click();

            // The guard fires: the resync inside handleRunClick finds tab A's run and
            // shows the adoption snackbar instead of starting a duplicate.
            await expect(
                secondAutomatePage.alreadyRunningSnackbar,
                'Tab B: the already-running snackbar should appear after the Run click'
            ).toBeVisible();
            await expect(
                secondAutomatePage.alreadyRunningSnackbar,
                'Tab B: the already-running snackbar should show the expected message'
            ).toHaveText('Automation is already running for this account.');

            // No duplicate run started: tab B slides into the EXISTING run's Pause/Stop
            // state (the resync adopts run instead of a Starting… → new-run state).
            await expect(
                secondAutomatePage.runButton,
                'Tab B: Run should be gone after adopting the existing run'
            ).not.toBeVisible();
            await expect(
                secondAutomatePage.pauseButton,
                'Tab B: Pause should appear (adopted the existing run)'
            ).toBeVisible();
            await expect(
                secondAutomatePage.stopButton,
                'Tab B: Stop should appear (adopted the existing run)'
            ).toBeVisible();
            await expect(
                secondAutomatePage.statusRunning,
                'Tab B: the adopted run should report Status: Running'
            ).toBeVisible();

            // Tab A: its run was untouched by tab B's click — still the same single run.
            await expect(
                tradeAutomatePage.statusRunning,
                'Tab A: the original run should still be Running after tab B clicked Run'
            ).toBeVisible();
        } finally {
            // Close tab B even when an assertion above fails mid-test. The fixture
            // context is torn down per test anyway, but closing here makes the
            // cleanup intent explicit and releases the tab promptly on failure.
            await secondPage.close();
        }
    });
});
