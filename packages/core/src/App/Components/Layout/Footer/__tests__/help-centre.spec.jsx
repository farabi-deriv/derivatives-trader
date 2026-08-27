import React from 'react';

import { render, screen } from '@testing-library/react';

import { HelpCentre } from '../help-centre';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getHelpCentreUrl: jest.fn(() => 'https://help.deriv.com'),
}));

jest.mock('@deriv/quill-icons', () => ({
    ...jest.requireActual('@deriv/quill-icons'),
    LegacyHelpCentreIcon: () => 'LegacyHelpCentreIcon',
}));

jest.mock('@deriv-com/translations', () => ({
    localize: key => key,
    useTranslations: jest.fn(() => ({
        localize: key => key,
        currentLang: 'EN',
    })),
}));

describe('<HelpCentre />', () => {
    it('should link to the shared help centre URL with protected new-tab attributes', () => {
        render(<HelpCentre />);

        const link = screen.getByRole('link', { name: 'Help centre' });
        expect(link).toHaveAttribute('href', 'https://help.deriv.com');
        expect(link).toHaveAttribute('id', 'dt_help_centre');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should keep the same link attributes when rendered with the tooltip popover', () => {
        render(<HelpCentre showPopover />);

        const link = screen.getByRole('link', { name: 'Help centre' });
        expect(link).toHaveAttribute('href', 'https://help.deriv.com');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
