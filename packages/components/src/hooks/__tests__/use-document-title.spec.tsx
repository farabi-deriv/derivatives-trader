import { act, render, renderHook } from '@testing-library/react';

import { useDocumentTitle } from '../use-document-title';

// `requireActual` resolves through moduleNameMapper to __mocks__/translation.mock.js — the very
// module the hook under test consumes — whereas `requireMock` would auto-mock it away.
const translations_mock = jest.requireActual('@deriv-com/translations') as {
    fireLanguageChanged: (lang?: string) => void;
    resetTranslationMock: () => void;
    useTranslations: () => { instance: { language: string; on: jest.Mock; off: jest.Mock } };
};
const { fireLanguageChanged, resetTranslationMock } = translations_mock;
const { instance } = translations_mock.useTranslations();

describe('useDocumentTitle', () => {
    beforeEach(() => {
        document.title = '';
        // `instance` is shared across the whole mock module, so its call log outlives each test.
        instance.on.mockClear();
        instance.off.mockClear();
    });

    it('composes the title as "<page title> | <brand name>"', () => {
        renderHook(() => useDocumentTitle(() => 'Statement'));

        expect(document.title).toBe('Statement | Deriv');
    });

    it('falls back to the brand name alone when getTitle is omitted', () => {
        renderHook(() => useDocumentTitle());

        expect(document.title).toBe('Deriv');
    });

    it('falls back to the brand name alone when getTitle returns an empty string', () => {
        renderHook(() => useDocumentTitle(() => ''));

        expect(document.title).toBe('Deriv');
    });

    it('re-derives the title when a language change completes', () => {
        const getTitle = jest.fn(() => 'Statement');
        renderHook(() => useDocumentTitle(getTitle));

        expect(document.title).toBe('Statement | Deriv');

        getTitle.mockReturnValue('Relevé de compte');
        act(() => fireLanguageChanged('FR'));

        expect(document.title).toBe('Relevé de compte | Deriv');
    });

    it('leaves document.title alone when a re-render derives the same title', () => {
        const writes: string[] = [];
        const { get, set } = Object.getOwnPropertyDescriptor(Document.prototype, 'title') as {
            get: () => string;
            set: (value: string) => void;
        };
        // Shadow the prototype accessor so every assignment is recorded, not just the final value.
        Object.defineProperty(document, 'title', {
            configurable: true,
            get: () => get.call(document),
            set: (value: string) => {
                writes.push(value);
                set.call(document, value);
            },
        });

        try {
            const { rerender } = renderHook(() => useDocumentTitle(() => 'Statement'));
            expect(writes).toEqual(['Statement | Deriv']);

            rerender();

            expect(writes).toEqual(['Statement | Deriv']);
        } finally {
            delete (document as Partial<Document>).title;
        }
    });

    it('drops listeners left behind by a consumer that was never unmounted', () => {
        const leaked = jest.fn();
        instance.on('languageChanged', leaked);
        instance.language = 'FR';

        resetTranslationMock();
        fireLanguageChanged();

        expect(leaked).not.toHaveBeenCalled();
        expect(instance.language).toBe('EN');
    });

    it('removes its languageChanged listener on unmount', () => {
        const { unmount } = renderHook(() => useDocumentTitle(() => 'Statement'));

        const registered = instance.on.mock.calls.filter(([event]) => event === 'languageChanged');
        expect(registered).toHaveLength(1);

        unmount();

        expect(instance.off).toHaveBeenCalledWith('languageChanged', registered[0][1]);
    });

    it('still writes the title when the i18next instance is unavailable', () => {
        jest.spyOn(translations_mock, 'useTranslations').mockReturnValueOnce(
            {} as ReturnType<typeof translations_mock.useTranslations>
        );

        expect(() => renderHook(() => useDocumentTitle(() => 'Statement'))).not.toThrow();
        expect(document.title).toBe('Statement | Deriv');
    });

    it('resolves nested writers to the innermost title, before and after a language change', () => {
        const getOuterTitle = jest.fn(() => 'Reports');
        const getInnerTitle = jest.fn(() => 'Statement');

        const Inner = () => {
            useDocumentTitle(getInnerTitle);
            return null;
        };
        const Outer = () => {
            useDocumentTitle(getOuterTitle);
            return <Inner />;
        };

        render(<Outer />);

        expect(document.title).toBe('Statement | Deriv');

        getOuterTitle.mockReturnValue('Rapports');
        getInnerTitle.mockReturnValue('Relevé de compte');
        act(() => fireLanguageChanged('FR'));

        expect(document.title).toBe('Relevé de compte | Deriv');
    });
});
