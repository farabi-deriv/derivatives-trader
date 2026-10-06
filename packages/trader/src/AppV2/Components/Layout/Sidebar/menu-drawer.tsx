import React from 'react';
import classNames from 'classnames';

import { Button, Text } from '@deriv/components';
import {
    LabelPairedChevronRightSmRegularIcon,
    StandaloneArrowLeftRegularIcon,
    StandaloneCircleQuestionRegularIcon,
    StandaloneFileRegularIcon,
    StandaloneGlobeRegularIcon,
    StandaloneMobileNotchRegularIcon,
    StandaloneMoonRegularIcon,
    StandaloneRightFromBracketRegularIcon,
    StandaloneSunBrightRegularIcon,
} from '@deriv/quill-icons';
import { observer, useStore } from '@deriv/stores';
import { Localize, useTranslations } from '@deriv-com/translations';

import LanguageSelector from './language-selector';

import './menu-drawer.scss';

type TMenuDrawer = {
    onReports: () => void;
    onHelpCentre: () => void;
    onLogout: () => void;
};

type TRow = {
    id: string;
    icon: React.ReactNode;
    label: React.ReactNode;
    onClick: () => void;
    /** Rows that lead somewhere carry a chevron; a row that just acts does not. */
    has_chevron?: boolean;
};

/** Theme and Language are nested states of this same panel, not separate flyouts. */
type TView = 'root' | 'theme' | 'language';

const Row = ({ icon, label, onClick, has_chevron, id }: TRow) => (
    <button type='button' className='menu-drawer__row' onClick={onClick} data-testid={`dt_menu_${id}`}>
        <span className='menu-drawer__row-icon'>{icon}</span>
        <span className='menu-drawer__row-label'>{label}</span>
        {has_chevron && (
            <LabelPairedChevronRightSmRegularIcon
                className='menu-drawer__row-chevron'
                fill='var(--color-text-secondary)'
            />
        )}
    </button>
);

/**
 * The landscape rail's Menu panel — what the mobile bottom nav puts behind its Menu tab.
 *
 * Theme cannot be a toggle: `theme_preference` is tri-state, so a flip reaches neither 'system' nor
 * back out of an explicit choice.
 */
const MenuDrawer = observer(({ onReports, onHelpCentre, onLogout }: TMenuDrawer) => {
    const { localize } = useTranslations();
    const { ui, client } = useStore();
    const { theme_preference, setThemePreference } = ui;
    const { is_logged_in } = client;
    const [view, setView] = React.useState<TView>('root');

    const theme_options = [
        {
            value: 'light',
            label: localize('Light'),
            icon: <StandaloneSunBrightRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
        },
        {
            value: 'dark',
            label: localize('Dark'),
            icon: <StandaloneMoonRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
        },
        {
            value: 'system',
            label: localize('System'),
            icon: <StandaloneMobileNotchRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
        },
    ] as const;

    if (view !== 'root') {
        return (
            <div className='menu-drawer'>
                <div className='menu-drawer__header'>
                    <button
                        type='button'
                        className='menu-drawer__back'
                        onClick={() => setView('root')}
                        aria-label={localize('Back')}
                        data-testid='dt_menu_back'
                    >
                        <StandaloneArrowLeftRegularIcon iconSize='xs' fill='var(--color-text-primary)' />
                    </button>
                    <Text as='h2' className='menu-drawer__title'>
                        {view === 'theme' ? (
                            <Localize i18n_default_text='Theme' />
                        ) : (
                            <Localize i18n_default_text='Language' />
                        )}
                    </Text>
                </div>
                {view === 'theme' ? (
                    // LanguageSelector's markup, so both nested views share one selected treatment.
                    <div className='flyout-selector'>
                        {theme_options.map(({ value, label, icon }) => {
                            const is_active = theme_preference === value;
                            return (
                                <Button
                                    key={value}
                                    className={classNames('flyout-selector__option', {
                                        'flyout-selector__option--active': is_active,
                                    })}
                                    onClick={() => setThemePreference(value)}
                                    disabled={is_active}
                                    aria-pressed={is_active}
                                    type='button'
                                    data-testid={`dt_menu_theme_${value}`}
                                >
                                    {icon}
                                    <Text>{label}</Text>
                                </Button>
                            );
                        })}
                    </div>
                ) : (
                    // No onLanguageChange: picking a language leaves the drawer open, as with theme.
                    <LanguageSelector />
                )}
            </div>
        );
    }

    const rows: TRow[] = [
        // Reports is the one row a public user does not get: it leads to a protected route.
        ...(is_logged_in
            ? [
                  {
                      id: 'reports',
                      icon: <StandaloneFileRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
                      label: <Localize i18n_default_text='Reports' />,
                      onClick: onReports,
                      has_chevron: true,
                  },
              ]
            : []),
        {
            id: 'language',
            icon: <StandaloneGlobeRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
            label: <Localize i18n_default_text='Language' />,
            onClick: () => setView('language'),
            has_chevron: true,
        },
        {
            id: 'theme',
            icon: <StandaloneSunBrightRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
            label: <Localize i18n_default_text='Theme' />,
            onClick: () => setView('theme'),
            has_chevron: true,
        },
        {
            id: 'help',
            icon: <StandaloneCircleQuestionRegularIcon iconSize='sm' fill='var(--color-text-primary)' />,
            label: <Localize i18n_default_text='Help centre' />,
            onClick: onHelpCentre,
            has_chevron: true,
        },
    ];

    return (
        <div className='menu-drawer'>
            <div className='menu-drawer__list'>
                {rows.map(row => (
                    <Row key={row.id} {...row} />
                ))}
            </div>
            {is_logged_in && (
                <Row
                    id='logout'
                    icon={<StandaloneRightFromBracketRegularIcon iconSize='sm' fill='var(--color-text-primary)' />}
                    label={<Localize i18n_default_text='Log out' />}
                    onClick={onLogout}
                />
            )}
        </div>
    );
});

export default MenuDrawer;
