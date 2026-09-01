import { Locator } from '@playwright/test';
import { TradeBasePage } from './TradeBasePage';

/**
 * Page Object for Notifications (both trade banners and notification centre dialog).
 */
export class NotificationsPage extends TradeBasePage {
    // ============================================
    // TRADE BANNER LOCATORS (AppV2 Trade Route `/`)
    // ============================================

    /**
     * Trade notification banner container (purchase/sell popups on mobile trade screen).
     * Source: Quill-UI NotificationBanners .trade-notification
     */
    get tradeBanner(): Locator {
        return this.page.locator(
            '.trade-notification, .trade-notification--purchase, .trade-notification--success, .trade-notification--error'
        );
    }

    /**
     * Purchase banner icon or banner element.
     * Rendered with className 'trade-notification--purchase' on the stopwatch icon.
     * Source: purchase-button.tsx addNotificationBannerCallback
     */
    get purchaseBanner(): Locator {
        return this.page.locator('.trade-notification--purchase');
    }

    /**
     * Sell / contract closed banner icon or banner element.
     * Rendered with className 'trade-notification--success' (profit/won) or 'trade-notification--error' (loss) on the checkered flag icon.
     * Source: notifications.tsx addNotificationBannerCallback
     */
    get sellBanner(): Locator {
        return this.page.locator('.trade-notification--success, .trade-notification--error');
    }

    // ============================================
    // NOTIFICATION CENTRE DIALOG LOCATORS
    // ============================================

    /**
     * Traders Hub header show notifications wrapper containing the bell icon.
     * Source: data-testid="dt_traders_hub_show_notifications"
     */
    get tradersHubShowNotifications(): Locator {
        return this.page.getByTestId('dt_traders_hub_show_notifications');
    }

    /**
     * Bell icon toggle wrapper button.
     * Source: .notifications-toggle__icon-wrapper
     */
    get bellIconWrapper(): Locator {
        return this.page
            .getByTestId('dt_traders_hub_show_notifications')
            .locator('.notifications-toggle__icon-wrapper')
            .or(this.page.locator('.notifications-toggle__icon-wrapper'));
    }

    /**
     * Counter badge on the bell icon showing number of unread notifications.
     * Source: .notifications-toggle__step
     */
    get bellCounterBadge(): Locator {
        return this.page.locator('.notifications-toggle__step');
    }

    /**
     * Notification centre dialog / modal list wrapper.
     * Source: data-testid="dt_notifications_list_wrapper"
     */
    get notificationsListWrapper(): Locator {
        return this.page.getByTestId('dt_notifications_list_wrapper');
    }

    /**
     * Notification centre dialog header text ("Notifications").
     * Source: .notifications-dialog__header-text
     */
    get dialogHeaderText(): Locator {
        return this.page.locator('.notifications-dialog__header-text');
    }

    /**
     * Empty state cardboard box icon.
     * Source: data-testid="dt_ic_box_icon"
     */
    get emptyStateIcon(): Locator {
        return this.page.getByTestId('dt_ic_box_icon');
    }

    /**
     * "No notifications" empty state message heading.
     * Source: .notifications-empty__header
     */
    get emptyStateHeader(): Locator {
        return this.page.locator('.notifications-empty__header');
    }

    /**
     * Clear All footer button in the notifications dialog.
     * Source: data-testid="dt_clear_all_footer_button"
     */
    get clearAllButton(): Locator {
        return this.page.getByTestId('dt_clear_all_footer_button').locator('button');
    }

    /**
     * Notification list items.
     * Source: .notifications-item
     */
    get notificationItems(): Locator {
        return this.page.locator('.notifications-item');
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Navigate to a surface that renders the notification centre bell (e.g. Traders Hub).
     */
    async gotoNotificationCentreSurface(): Promise<void> {
        await this.page.goto('/');
    }

    /**
     * Open notification centre by clicking the bell icon.
     */
    async openNotificationCentre(): Promise<void> {
        await this.bellIconWrapper.first().click();
    }

    /**
     * Click outside the notification centre dialog to close it (desktop).
     */
    async clickOutsideDialog(): Promise<void> {
        await this.page.mouse.click(10, 10);
    }

    /**
     * Clear all notifications if Clear All button is enabled.
     */
    async clearAllIfEnabled(): Promise<void> {
        const isEnabled = await this.clearAllButton.isEnabled().catch(() => false);
        if (isEnabled) {
            await this.clearAllButton.click();
        }
    }
}
