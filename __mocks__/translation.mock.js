import React from 'react';

const replaceValue = (text, values) => {
    return text.replace(/{{(\w+)}}/g, (match, key) => {
        // If the value is an empty string, return an empty fragment to render nothing
        if (values[key] === '') {
            return '';
        }
        return values[key] || match;
    });
};

const Localize = ({ i18n_default_text, components = [], values = {} }) => {
    if (!i18n_default_text) return null;

    // For simple cases with no components or complex processing, return the text directly
    if (components.length === 0 && Object.keys(values).length === 0) {
        return i18n_default_text;
    }

    let processedText = i18n_default_text;
    const elementsToRender = [];
    let elementIndex = 0;

    // First, handle value placeholders
    processedText = replaceValue(processedText, values);

    // Then handle opening/closing tags like <0>text</0>
    processedText = processedText.replace(/<(\d+)>(.*?)<\/\1>/g, (match, index, content) => {
        const componentIndex = parseInt(index);
        const Component = components[componentIndex];

        if (Component && React.isValidElement(Component)) {
            // Clone the component with the content as children, preserving all original props
            const clonedComponent = React.cloneElement(Component, {
                key: elementIndex,
                children: content,
            });
            elementsToRender.push(clonedComponent);
            return `__ELEMENT_${elementIndex++}__`;
        }

        return content;
    });

    // Handle self-closing tags like <0/>
    processedText = processedText.replace(/<(\d+)\/>/g, (match, index) => {
        const componentIndex = parseInt(index);
        const Component = components[componentIndex];

        if (Component && React.isValidElement(Component)) {
            const clonedComponent = React.cloneElement(Component, {
                key: elementIndex,
            });
            elementsToRender.push(clonedComponent);
            return `__ELEMENT_${elementIndex++}__`;
        }

        return '';
    });

    // Split the text by element placeholders and reconstruct with React elements
    const textParts = processedText.split(/(__ELEMENT_\d+__)/g);
    const finalElements = [];

    textParts.forEach(part => {
        const elementMatch = part.match(/__ELEMENT_(\d+)__/);
        if (elementMatch) {
            const elementIdx = parseInt(elementMatch[1]);
            finalElements.push(elementsToRender[elementIdx]);
        } else if (part) {
            finalElements.push(part);
        }
    });

    return React.createElement(React.Fragment, null, ...finalElements);
};

const mockFn = jest.fn((text, args) => {
    return text.replace(/{{(.*?)}}/g, (_, match) => args[match.trim()]);
});

// Registered i18next event listeners, keyed by event name, so specs can fire them.
const i18n_listeners = {};

// Minimal i18next-shaped stub returned as `instance` by the mocked useTranslations hook.
const instance = {
    language: 'EN',
    t: mockFn,
    on: jest.fn((event, listener) => {
        i18n_listeners[event] = [...(i18n_listeners[event] || []), listener];
    }),
    off: jest.fn((event, listener) => {
        i18n_listeners[event] = (i18n_listeners[event] || []).filter(l => l !== listener);
    }),
};

/**
 * Fires the i18next `languageChanged` event on the stubbed `instance`, the same way
 * i18next does once a translation bundle has finished loading. Use it in specs to
 * assert what happens after a language switch completes.
 */
const fireLanguageChanged = (lang = instance.language) => {
    instance.language = lang;
    (i18n_listeners.languageChanged || []).forEach(listener => listener(lang));
};

/**
 * Drops every registered listener and restores the default language. `instance` is a module-level
 * singleton shared by all tests in a spec file, so without this the isolation between them rests
 * entirely on RTL's unmount cleanup calling the hook's `instance.off()`. Wired into a global
 * `afterEach` in `setupTests.js`.
 */
const resetTranslationMock = () => {
    Object.keys(i18n_listeners).forEach(event => delete i18n_listeners[event]);
    instance.language = 'EN';
};

const switchLanguage = jest.fn();

// Mock for useTranslations hook
const useTranslations = () => ({
    localize: mockFn,
    currentLang: 'EN',
    instance,
    switchLanguage,
    ready: true,
});

const localize = mockFn;

const getAllowedLanguages = jest.fn(() => {
    return { EN: 'English', VI: 'Tiếng Việt' };
});

const getInitialLanguage = jest.fn(() => 'EN');

export {
    Localize,
    localize,
    useTranslations,
    getAllowedLanguages,
    getInitialLanguage,
    fireLanguageChanged,
    resetTranslationMock,
    switchLanguage,
};
