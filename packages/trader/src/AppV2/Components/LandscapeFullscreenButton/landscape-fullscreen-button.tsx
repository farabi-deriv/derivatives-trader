import React from 'react';

import { isPhoneLandscape } from '@deriv/shared';
import { useTranslations } from '@deriv-com/translations';

import ChartCompressIcon from 'Assets/SvgComponents/ic-chart-compress.svg';
import ChartExpandIcon from 'Assets/SvgComponents/ic-chart-expand.svg';

import '../ChartMaximizeButton/chart-maximize-button.scss';

/**
 * Browser fullscreen for the landscape trade page, styled like portrait's chart maximize button.
 * Renders only where the Fullscreen API exists: iPhone WebKit has none, so this is Android only.
 */
const LandscapeFullscreenButton = () => {
    const { localize } = useTranslations();
    const [is_fullscreen, setIsFullscreen] = React.useState(() => !!document.fullscreenElement);

    React.useEffect(() => {
        const sync = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', sync);
        return () => {
            document.removeEventListener('fullscreenchange', sync);
            // Only when unmounted by a rotation: portrait has no way out. Navigating away (e.g. to
            // Reports) unmounts this too, and must keep the user in fullscreen.
            if (document.fullscreenElement && !isPhoneLandscape()) document.exitFullscreen().catch(() => undefined);
        };
    }, []);

    if (!document.fullscreenEnabled) return null;

    // Called straight from the tap: Chrome refuses fullscreen without a user gesture.
    const toggle = () => {
        const request = is_fullscreen
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        request.catch(() => undefined);
    };

    return (
        <button
            type='button'
            className='chart-maximize-button landscape-fullscreen-button'
            aria-label={is_fullscreen ? localize('Exit full screen') : localize('Full screen')}
            data-testid='dt_landscape_fullscreen_toggle'
            onClick={toggle}
        >
            {is_fullscreen ? <ChartCompressIcon width={20} height={20} /> : <ChartExpandIcon width={20} height={20} />}
        </button>
    );
};

export default LandscapeFullscreenButton;
