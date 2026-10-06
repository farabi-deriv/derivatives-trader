import { useState } from 'react';

import { VideoPlayer } from '@deriv/components';
import { LabelPairedPlayMdFillIcon } from '@deriv/quill-icons';
import { CaptionText } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';
import { getVideoMp4Url } from 'AppV2/Utils/video-config';

type TVideoPreview = {
    contract_type: string;
    toggleVideoPlayer?: () => void;
    video_src: string;
};

const VideoPreview = ({ contract_type, toggleVideoPlayer, video_src }: TVideoPreview) => {
    // Viewport, not width: landscape gets the thumbnail row, not the desktop's inline player.
    const is_phone_viewport = useIsPhoneViewport();
    const [is_started, setIsStarted] = useState(false);

    if (!is_phone_viewport) {
        if (is_started) {
            return (
                <div className='guide-video__wrapper'>
                    <div className='guide-video__player' data-testid='dt_video_player'>
                        <VideoPlayer
                            src={getVideoMp4Url(video_src)}
                            is_mobile={false}
                            should_show_controls
                            autoplay
                            height='252px'
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className='guide-video__wrapper'>
                <div
                    className='guide-video__preview'
                    data-testid='dt_video_preview'
                    role='button'
                    tabIndex={0}
                    onClick={() => setIsStarted(true)}
                    onKeyDown={e => e.key === 'Enter' && setIsStarted(true)}
                >
                    <video
                        src={`${getVideoMp4Url(video_src)}#t=0.1`}
                        preload='metadata'
                        muted
                        playsInline
                        className='guide-video__preview__thumbnail'
                        data-testid='dt_video_preview_thumbnail'
                    />
                    <div className='guide-video__preview__icon__wrapper'>
                        <LabelPairedPlayMdFillIcon className='guide-video__preview__icon' />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='guide-video__wrapper'>
            <div
                className='guide-video__preview'
                data-testid='dt_video_preview'
                onClick={toggleVideoPlayer}
                onKeyDown={toggleVideoPlayer}
            >
                <video
                    src={`${getVideoMp4Url(video_src)}#t=0.1`}
                    preload='metadata'
                    muted
                    playsInline
                    width='112'
                    height='73'
                    className='guide-video__preview__thumbnail'
                    data-testid='dt_video_preview_thumbnail'
                />
                <div className='guide-video__preview__icon__wrapper'>
                    <LabelPairedPlayMdFillIcon className='guide-video__preview__icon' />
                </div>
            </div>
            <div className='guide-video__description'>
                <CaptionText bold className='guide-video__description-title'>
                    <Localize i18n_default_text='How to trade {{contract_type}}?' values={{ contract_type }} />
                </CaptionText>
                <CaptionText className='guide-video__description-copy'>
                    <Localize i18n_default_text='Watch this video to learn about this trade type.' />
                </CaptionText>
            </div>
        </div>
    );
};

export default VideoPreview;
