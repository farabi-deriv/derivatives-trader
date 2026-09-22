/**
 * @name     Multiple trade tabs — core mechanics
 * @id       flow-14, flow-15, flow-16, flow-17, flow-18, flow-19, flow-20, flow-23
 * @flow     playwright/flows/market-selection/flow.md#flow-14--switch-between-existing-tabs
 * @coverage playwright/flows/market-selection/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Market Selection', { tag: ['@desktop', '@mobile', '@market-selection', '@smoke'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test.beforeEach(async ({ page, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await tradeParametersPage.gotoTradePage();
    });

    test('VERIFY selecting markets manages tabs correctly — switch, dedupe, and independent trade types', async ({
        tradeParametersPage,
        marketSelectionPage,
    }) => {
        // Volatility 100 Index supports Accumulators (needed in Part 3); Bull Market Index does not.
        // Part 1 — switch between existing tabs.
        const firstTabText = (await tradeParametersPage.activeMarketTab.textContent()) ?? '';

        await tradeParametersPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', {
            openInNewTab: true,
        });
        await expect(marketSelectionPage.marketTabs, 'A second tab should be open').toHaveCount(2);
        await expect(tradeParametersPage.activeMarketTab, 'New tab should be active').toContainText(
            'Volatility 100 Index'
        );

        // Clicking an already-active tab opens the picker (replace semantics) — switch away first.
        const firstTab = marketSelectionPage.marketTabs.first();
        await firstTab.click();
        await expect(tradeParametersPage.activeMarketTab, 'Switching to the first tab should activate it').toHaveText(
            firstTabText
        );

        await marketSelectionPage.switchToMarketTab('Volatility 100 Index', 'Rise/Fall');
        await expect(
            tradeParametersPage.activeMarketTab,
            'Switching back should restore Volatility 100 Index'
        ).toContainText('Volatility 100 Index');

        // Part 2 — re-selecting an already-open pair focuses it (no duplicate).
        await tradeParametersPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', {
            openInNewTab: true,
        });
        await expect(
            marketSelectionPage.marketTabs,
            'Re-selecting the same pair should not create a duplicate tab'
        ).toHaveCount(2);
        await expect(tradeParametersPage.activeMarketTab, 'The existing tab should be active').toContainText(
            'Volatility 100 Index'
        );

        // Part 3 — same market under a different trade type is an independent tab.
        await tradeParametersPage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators', {
            openInNewTab: true,
        });
        await expect(
            marketSelectionPage.marketTabs,
            'A third, independent tab should be created for the same market under a different trade type'
        ).toHaveCount(3);

        await marketSelectionPage.switchToMarketTab('Volatility 100 Index', 'Rise/Fall');
        await expect(
            tradeParametersPage.activeMarketTab,
            'The Rise/Fall tab should still be independently selectable'
        ).toContainText('Rise/Fall');

        await marketSelectionPage.switchToMarketTab('Volatility 100 Index', 'Accumulators');
        await expect(
            tradeParametersPage.activeMarketTab,
            'The Accumulators tab should still be independently selectable'
        ).toContainText('Accumulators');
    });

    test('VERIFY tab removal mechanics — non-active, active, and last-tab blocked', async ({
        tradeParametersPage,
        marketSelectionPage,
    }) => {
        // Part 1 — remove a non-active tab.
        await tradeParametersPage.selectMarketAndTradeType('Bull Market Index', 'Rise/Fall', {
            openInNewTab: true,
        });
        await tradeParametersPage.selectMarketAndTradeType('Jump 75 Index', 'Rise/Fall', { openInNewTab: true });
        await expect(marketSelectionPage.marketTabs, 'Three tabs should be open').toHaveCount(3);

        await marketSelectionPage.removeMarketTab('Bull Market Index', 'Rise/Fall');

        await expect(marketSelectionPage.marketTabs, 'One tab should have been removed').toHaveCount(2);
        await expect(
            marketSelectionPage.marketTab('Bull Market Index', 'Rise/Fall'),
            'The removed tab should no longer exist'
        ).toHaveCount(0);
        await expect(
            tradeParametersPage.activeMarketTab,
            'The active tab (Jump 75 Index) should be unaffected by removing a different tab'
        ).toContainText('Jump 75 Index');

        // Part 2 — remove the active tab → falls back to an adjacent tab.
        await marketSelectionPage.removeMarketTab('Jump 75 Index', 'Rise/Fall');

        await expect(marketSelectionPage.marketTabs, 'One tab should remain').toHaveCount(1);
        await expect(
            tradeParametersPage.activeMarketTab,
            'Removing the active tab should fall back to the only remaining tab'
        ).not.toContainText('Jump 75 Index');

        // Part 3 — last remaining tab cannot be removed.
        await expect(
            tradeParametersPage.activeMarketTab.getByRole('button', { name: 'Remove market' }),
            'No close control should render when only one tab is open'
        ).not.toBeVisible();
    });

    test('VERIFY tab strip visuals — distinct icons and scroll/expand behavior', async ({
        tradeParametersPage,
        marketSelectionPage,
    }, testInfo) => {
        // Part 1 — each tab icon reflects its own market.
        await tradeParametersPage.selectMarketAndTradeType('Jump 75 Index', 'Rise/Fall', { openInNewTab: true });
        await tradeParametersPage.selectMarketAndTradeType('EUR/USD', 'Rise/Fall', { openInNewTab: true });
        await expect(marketSelectionPage.marketTabs, 'Three tabs should be open').toHaveCount(3);

        const iconHtmls = await marketSelectionPage.marketTabs.evaluateAll(tabs =>
            tabs.map(tab => tab.querySelector('svg')?.outerHTML ?? '')
        );

        expect(iconHtmls, 'Every tab should render its own icon markup').toHaveLength(3);
        expect(
            iconHtmls.every(html => html.length > 0),
            'Every tab icon should be non-empty'
        ).toBe(true);
        expect(new Set(iconHtmls).size, 'All three tabs should show visually distinct icons').toBe(3);

        // Part 2 — open to the platform cap, then assert strip overflow behavior.
        // Mobile scrolls horizontally; desktop shrinks tabs to fit (no scroll).
        const additionalMarkets = [
            'Bull Market Index',
            'Volatility 10 Index',
            'Volatility 25 Index',
            'Volatility 50 Index',
        ];
        const tabsNeeded = marketSelectionPage.maxOpenMarkets - (await marketSelectionPage.marketTabs.count());
        for (const market of additionalMarkets.slice(0, tabsNeeded)) {
            await tradeParametersPage.selectMarketAndTradeType(market, 'Rise/Fall', { openInNewTab: true });
        }

        await expect(
            tradeParametersPage.activeMarketTab,
            'The active tab should expand to show its trade-type subtitle'
        ).toContainText('Rise/Fall');

        const isMobile = testInfo.project.name.includes('mobile');
        if (isMobile) {
            // At the cap the strip overflows; activating an edge tab auto-scrolls it into view.
            const list = tradeParametersPage.page.locator('[data-testid="dt_market_tabs_list"]');
            await expect(
                await list.evaluate(el => el.scrollWidth > el.clientWidth),
                'Mobile tab strip should overflow once the platform cap is reached'
            ).toBe(true);

            const firstTab = marketSelectionPage.marketTabs.first();
            // Edge tab must start out of view; dispatchEvent bypasses Playwright's own
            // actionability scroll so only the app's activation-driven scroll can bring it in.
            await expect(firstTab, 'Edge tab should start scrolled out of view').not.toBeInViewport();
            await firstTab.dispatchEvent('click');
            await expect(firstTab, 'Activating an edge tab should auto-scroll it into view').toBeInViewport();
        } else {
            // Desktop — tabs shrink to fit; the active (expanded) tab stays in view.
            await expect(
                tradeParametersPage.activeMarketTab,
                'The active (expanded) tab should be in view on desktop'
            ).toBeInViewport();
        }
    });
});
