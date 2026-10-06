import { StandaloneRotateDeviceFillIcon, StandaloneXmarkRegularIcon } from '@deriv/quill-icons';
import { useTranslations } from '@deriv-com/translations';

import './rotate-prompt.scss';

const MESSAGE_ID = 'rotate-prompt-message';

type TRotatePrompt = {
    message: React.ReactNode;
    /** Omitted, the prompt has no way out — for the cases where the other orientation is unusable. */
    onDismiss?: () => void;
};

// Shell for both rotate overlays: a dim over the page with a phone-rotate illustration and a line of
// static light-on-dark copy. Which orientation is being asked for, and whether it can be waved away,
// is the caller's business — see LandscapePrompt and PortraitPrompt.
const RotatePrompt = ({ message, onDismiss }: TRotatePrompt) => {
    const { localize } = useTranslations();

    return (
        <div
            className='rotate-prompt'
            role='dialog'
            aria-modal='true'
            aria-labelledby={MESSAGE_ID}
            data-testid='dt_rotate_prompt'
        >
            <div className='rotate-prompt__content'>
                <StandaloneRotateDeviceFillIcon iconSize='2xl' fill='var(--color-text-white)' />
                <div className='rotate-prompt__message-block'>
                    <p className='rotate-prompt__message' id={MESSAGE_ID}>
                        {message}
                    </p>
                    {onDismiss && (
                        <button
                            type='button'
                            className='rotate-prompt__dismiss'
                            aria-label={localize('Dismiss')}
                            data-testid='dt_rotate_prompt_dismiss'
                            onClick={onDismiss}
                        >
                            <StandaloneXmarkRegularIcon width={20} height={20} fill='var(--color-text-black)' />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RotatePrompt;
