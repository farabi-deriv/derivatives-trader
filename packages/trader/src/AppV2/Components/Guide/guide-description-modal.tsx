import React from 'react';
import ReactDOM from 'react-dom';

import { VideoPlayer } from '@deriv/components';
import { LabelPairedXmarkMdRegularIcon } from '@deriv/quill-icons';
import { clickAndKeyEventHandler } from '@deriv/shared';
import { ActionSheet, Heading, Modal } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';
import { getDescriptionVideoIds } from 'AppV2/Utils/contract-description-utils';
import { getVideoMp4Url } from 'AppV2/Utils/video-config';

import GuideContent from './guide-content';

import './guide-description-modal.scss';

type TGuideDescriptionModal = {
    contract_list: { tradeType: React.ReactNode; id: string; show_fire_icon?: boolean }[];
    is_dark_mode_on?: boolean;
    is_open?: boolean;
    onChipSelect: (id: string) => void;
    onClose: () => void;
    onTermClick: (term: string) => void;
    selected_contract_type: string;
    show_guide_for_selected_contract?: boolean;
    show_description_in_a_modal?: boolean;
    show_all_trade_types_in_guide?: boolean;
};

const PortalModal = ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className='modal-player' aria-modal='true'>
            <div
                className='modal-player__container'
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body
    );
};

const GuideDescriptionModal = ({
    contract_list,
    is_dark_mode_on,
    is_open,
    onChipSelect,
    onClose,
    onTermClick,
    selected_contract_type,
    show_guide_for_selected_contract,
    show_description_in_a_modal = true,
    show_all_trade_types_in_guide,
}: TGuideDescriptionModal) => {
    const [is_video_player_opened, setIsVideoPlayerOpened] = React.useState(false);
    // Viewport, not width: landscape would take the desktop Modal and never mount the video player.
    const is_phone_viewport = useIsPhoneViewport();

    const video_src = getDescriptionVideoIds(selected_contract_type, is_dark_mode_on);

    const toggleVideoPlayer = (e?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
        clickAndKeyEventHandler(() => setIsVideoPlayerOpened(!is_video_player_opened), e);
    };

    const guide_content_props = {
        contract_list,
        onChipSelect,
        onTermClick,
        selected_contract_type,
        show_guide_for_selected_contract,
        show_description_in_a_modal,
        show_all_trade_types_in_guide,
        toggleVideoPlayer,
        video_src,
    };

    const title = (
        <Heading.H4 className='guide__title'>
            {show_guide_for_selected_contract && !show_all_trade_types_in_guide ? (
                selected_contract_type
            ) : (
                <Localize i18n_default_text='Trade types' />
            )}
        </Heading.H4>
    );

    return (
        <React.Fragment>
            {show_description_in_a_modal ? (
                !is_phone_viewport ? (
                    <Modal
                        isOpened={is_open}
                        showHandleBar={false}
                        showSecondaryButton={false}
                        showCrossIcon={false}
                        isMobile={false}
                        primaryButtonLabel={<Localize i18n_default_text='Got it' />}
                        primaryButtonCallback={onClose}
                        toggleModal={onClose}
                        className='guide-desktop-modal'
                    >
                        <div className='guide-desktop-modal__header'>
                            {title}
                            <button className='guide-desktop-modal__close' onClick={onClose} aria-label='Close'>
                                <LabelPairedXmarkMdRegularIcon />
                            </button>
                        </div>
                        <div className='guide-desktop-modal__content'>
                            <GuideContent {...guide_content_props} />
                        </div>
                    </Modal>
                ) : (
                    <ActionSheet.Root isOpen={is_open} onClose={onClose} position='left' expandable={false}>
                        <ActionSheet.Portal shouldCloseOnDrag>
                            <ActionSheet.Content className='guide__wrapper__content'>
                                {title}
                                <GuideContent {...guide_content_props} />
                            </ActionSheet.Content>
                            <ActionSheet.Footer
                                alignment='vertical'
                                primaryAction={{
                                    content: <Localize i18n_default_text='Got it' />,
                                    onAction: onClose,
                                }}
                                className='guide__button'
                            />
                        </ActionSheet.Portal>
                    </ActionSheet.Root>
                )
            ) : (
                <div className='guide__wrapper__content--separate'>
                    {title}
                    <GuideContent {...guide_content_props} />
                </div>
            )}
            {is_phone_viewport && (
                <PortalModal isOpen={is_video_player_opened}>
                    <VideoPlayer
                        className='modal-player__wrapper'
                        data_testid='dt_video_player'
                        src={getVideoMp4Url(video_src)}
                        onModalClose={toggleVideoPlayer}
                        muted={true}
                        is_mobile={true}
                        is_v2={true}
                        should_show_controls={true}
                    />
                </PortalModal>
            )}
        </React.Fragment>
    );
};

export default React.memo(GuideDescriptionModal);
