import React from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { routes } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';

import Sidebar from 'AppV2/Components/Layout/Sidebar/sidebar';
import useIsPortraitPromptBlocking from 'AppV2/Hooks/useIsPortraitPromptBlocking';

import Router from '../../Routes/router';

import './app-shell.scss';

const AppShell = observer(() => {
    const { ui } = useStore();
    const { active_sidebar_flyout, closeSidebarFlyout, is_landscape_chrome_hidden } = ui;
    const { isMobile } = useDevice();
    // PortraitPrompt blocks the whole page, and the rail sits outside the routed content it covers —
    // so it has to go the same way the trade surface does: not rendered at all.
    const is_prompt_blocking = useIsPortraitPromptBlocking();
    const location = useLocation();

    // The flyout hangs off the rail, which only renders on the trade page, so leaving it open while
    // routing away would strand it. `closeSidebarFlyout` is `action.bound`, hence a stable dep.
    React.useEffect(() => {
        if (active_sidebar_flyout && location.pathname !== routes.index) {
            closeSidebarFlyout();
        }
    }, [active_sidebar_flyout, closeSidebarFlyout, location.pathname]);

    return (
        <div className={clsx('app-shell', { 'app-shell--chrome-hidden': is_landscape_chrome_hidden })}>
            {!isMobile && !is_prompt_blocking && <Sidebar />}
            <div className='app-shell__main-content'>
                <Router />
            </div>
        </div>
    );
});

export default AppShell;
