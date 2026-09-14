import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
import { mockStore, StoreProvider } from '@deriv/stores';
import { ThemedScrollbars } from '@deriv/components';
import AppContents from '../app-contents';

let child_ref;

const MockComp = props => {
    child_ref = React.useRef();
    return (
        <div {...props} ref={child_ref}>
            {props.children}
        </div>
    );
};

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isMobile: jest.fn().mockReturnValue(true),
    WS: {
        wait: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('@deriv/components', () => ({
    ...jest.requireActual('@deriv/components'),
    ThemedScrollbars: props => <MockComp {...props}>{props.children}</MockComp>,
}));

describe('<AppContents/>', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const mock = {
        common: {
            platform: 'dtrader',
        },
        gtm: {
            pushDataLayer: jest.fn(),
        },
    };

    const store = mockStore(mock);

    const renderComponent = (store_config = store) => {
        const new_store = {
            ...store_config,
        };
        return render(
            <BrowserRouter>
                <StoreProvider store={new_store}>
                    <AppContents />
                </StoreProvider>
            </BrowserRouter>
        );
    };

    it('should move scroll to top', async () => {
        renderComponent();

        await waitFor(() => {
            expect(child_ref.current.scrollTop).toBe(0);
        });
    });
});
