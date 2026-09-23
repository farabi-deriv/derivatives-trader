/**
 * @name     Market selection — browse, discovery, and picker entry mechanics
 * @id       flow-1, flow-2, flow-3, flow-4, flow-5, flow-6, flow-12, flow-13
 * @flow     playwright/flows/market-selection/flow.md#flow-1--add-market-opens-the-picker-as-a-new-tab-flow
 * @coverage playwright/flows/market-selection/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

const EXPECTED_TRADE_TYPES = [
    'Rise/Fall',
    'Touch/No Touch',
    'Higher/Lower',
    'Accumulators',
    'Multipliers',
    'Turbos',
    'Vanillas',
    'Matches/Differs',
    'Over/Under',
    'Even/Odd',
];

test.describe('Market Selection', { tag: ['@desktop', '@mobile', '@market-selection'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test.beforeEach(async ({ page, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await tradeParametersPage.gotoTradePage();
    });

    test('VERIFY market selection mechanics — new tab, replace active tab, and close without selecting', async ({
        tradeParametersPage,
        marketSelectionPage,
    }) => {
        // Part 1 — Add market opens the picker as a new-tab flow (Flow 1).
        const tabCountBefore = await marketSelectionPage.marketTabs.count();

        await marketSelectionPage.addMarketButton.click();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should open').toBeVisible();
        await expect(
            marketSelectionPage.marketChangesDropdownTrigger,
            'Picker should open directly into a category list, not a blank/loading state'
        ).toBeVisible();
        // Close before selectMarketAndTradeType() re-opens the picker itself.
        await marketSelectionPage.closeMarketSelectionPicker();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should close').not.toBeVisible();

        await tradeParametersPage.selectMarketAndTradeType('Jump 75 Index', 'Rise/Fall', { openInNewTab: true });
        await expect(
            marketSelectionPage.marketTabs,
            'A new tab should be appended, not replacing an existing one'
        ).toHaveCount(tabCountBefore + 1);
        await expect(tradeParametersPage.activeMarketTab, 'New tab should be active').toContainText('Jump 75 Index');

        // Part 2 — clicking the active tab replaces it instead of adding a new one (Flow 2).
        const tabCountAfterNewTab = await marketSelectionPage.marketTabs.count();

        await tradeParametersPage.activeMarketTab.click();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should open').toBeVisible();
        await marketSelectionPage.closeMarketSelectionPicker();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should close').not.toBeVisible();

        await tradeParametersPage.selectMarketAndTradeType('EUR/USD', 'Rise/Fall');
        await expect(
            marketSelectionPage.marketTabs,
            'Tab count should be unchanged — the active tab was replaced, not duplicated'
        ).toHaveCount(tabCountAfterNewTab);
        await expect(tradeParametersPage.activeMarketTab, 'Active tab should now show EUR/USD').toContainText(
            'EUR/USD'
        );

        // Part 3 — closing the picker without selecting leaves the active tab unchanged (Flow 13).
        const activeTabTextBefore = (await tradeParametersPage.activeMarketTab.textContent()) ?? '';

        await marketSelectionPage.addMarketButton.click();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should open').toBeVisible();

        await marketSelectionPage.closeMarketSelectionPicker();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should close').not.toBeVisible();
        await expect(
            tradeParametersPage.activeMarketTab,
            'Active tab should be unchanged from before the picker was opened'
        ).toHaveText(activeTabTextBefore);
    });

    test('VERIFY picker browsing — trade types, category chips, time window, and Guide', async ({
        marketSelectionPage,
    }) => {
        await marketSelectionPage.addMarketButton.click();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should open').toBeVisible();

        // Part 1 — trade-type navigation lists the expected set (Flow 3).
        const labels = (await marketSelectionPage.tradeTypeNavItems.allTextContents()).map(label =>
            label.replace(/x\d+$/, '').trim()
        );
        for (const tradeType of EXPECTED_TRADE_TYPES) {
            expect(
                labels.some(label => label.includes(tradeType)),
                `Trade-type list should include ${tradeType}`
            ).toBe(true);
        }

        // Part 2 — asset-class category filter chips scope the list (Flow 5). Must run before Part 4
        // switches away from Rise/Fall, and ends back on "Derived" to leave state unaffected.
        await expect(
            marketSelectionPage.marketCategoryChip('Derived'),
            'Derived should be the auto-selected default category for Rise/Fall'
        ).toHaveAttribute('data-state', 'selected');

        await marketSelectionPage.selectMarketCategory('Forex');
        await expect(
            marketSelectionPage.marketCategoryChip('Forex'),
            'Forex chip should become selected'
        ).toHaveAttribute('data-state', 'selected');
        await expect(
            marketSelectionPage.marketCategoryChip('Derived'),
            'Derived chip should no longer be selected'
        ).not.toHaveAttribute('data-state', 'selected');

        await marketSelectionPage.selectMarketCategory('Derived');
        await expect(
            marketSelectionPage.marketCategoryChip('Derived'),
            'Derived chip should be selected again'
        ).toHaveAttribute('data-state', 'selected');
        await expect(
            marketSelectionPage.marketCategoryChip('Forex'),
            'Forex chip should no longer be selected'
        ).not.toHaveAttribute('data-state', 'selected');
        await marketSelectionPage.verifyDerivedSubmarketOrder();

        // Part 3 — time-window dropdown is present by default and absent on Favourites (Flow 6).
        await expect(
            marketSelectionPage.marketChangesDropdownTrigger,
            'The Changes dropdown should be visible immediately on open'
        ).toBeVisible();
        await expect(
            marketSelectionPage.marketChangesDropdownTrigger,
            'Default window should be 5 minutes'
        ).toContainText('5 minutes');

        await marketSelectionPage.marketChangesDropdownTrigger.click();
        await marketSelectionPage.marketChangesDropdownOption('15 minutes').click();
        await expect(
            marketSelectionPage.marketChangesDropdownTrigger,
            'Trigger should update to reflect the newly-selected window'
        ).toContainText('15 minutes');

        await marketSelectionPage.favouritesTab.click();
        await expect(
            marketSelectionPage.marketChangesDropdownTrigger,
            'The Changes dropdown should not appear on the Favourite tab'
        ).not.toBeVisible();

        // Part 4 — switching trade type reloads the picker without error (Flow 4).
        await marketSelectionPage.selectTradeTypeInPicker('Accumulators');
        await marketSelectionPage.verifyTradeTypeSelectedInPicker('Accumulators');
        await expect(
            marketSelectionPage.marketChangesDropdownTrigger,
            'The category list should still render for the new trade type, with no error state'
        ).toBeVisible();

        // Part 5 — the Guide affordance opens the trade-type description modal (Flow 12).
        await marketSelectionPage.openGuide();
        await expect(
            marketSelectionPage.guideDescriptionModal,
            'Guide description modal should open explaining how to trade the current trade type'
        ).toBeVisible();

        // Switching a chip inside the Guide only changes its own description — it doesn't close
        // the modal or affect the underlying picker's own selected trade type (still Accumulators
        // from Part 4 above).
        await marketSelectionPage.selectTradeTypeInGuide('Rise/Fall');
        await expect(
            marketSelectionPage.guideDescriptionModal,
            'Guide modal should stay open after switching its chip'
        ).toBeVisible();
        await expect(
            marketSelectionPage.guideContent,
            "Guide content should update to Rise/Fall's description"
        ).toContainText('Rise/Fall');
        await marketSelectionPage.verifyTradeTypeSelectedInPicker('Accumulators');
    });
});
