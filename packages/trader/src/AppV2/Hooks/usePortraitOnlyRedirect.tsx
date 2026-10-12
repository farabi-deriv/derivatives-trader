import React from 'react';
import { createPortal } from 'react-dom';

import { Localize } from '@deriv-com/translations';

import RotatePrompt from 'AppV2/Components/RotatePrompt';
import { cancelPortraitRedirect, redirectOnPortrait } from 'AppV2/Utils/portrait-redirect-utils';

import useIsPhoneLandscape from './useIsPhoneLandscape';

/** Opens a portrait-only page; in phone landscape, asks to rotate and goes once rotated. */
const usePortraitOnlyRedirect = () => {
    const is_phone_landscape = useIsPhoneLandscape();
    const [is_prompt_open, setIsPromptOpen] = React.useState(false);

    React.useEffect(() => {
        if (!is_phone_landscape) setIsPromptOpen(false);
    }, [is_phone_landscape]);

    const redirect = (url: string) => {
        if (!is_phone_landscape) {
            window.location.href = url;
            return;
        }
        setIsPromptOpen(true);
        redirectOnPortrait(url);
    };

    // Portalled: callers sit in stacking contexts that would cap it under the chart.
    const rotate_prompt = is_prompt_open
        ? createPortal(
              <RotatePrompt
                  message={<Localize i18n_default_text='Please rotate your device to portrait view.' />}
                  onDismiss={() => {
                      setIsPromptOpen(false);
                      cancelPortraitRedirect();
                  }}
              />,
              document.body
          )
        : null;

    return { redirect, rotate_prompt };
};

export default usePortraitOnlyRedirect;
