module.exports = {
    // Local storage functions
    safeParse: jest.fn(value => {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }),
    getLocalStorage: jest.fn(key => localStorage.getItem(key)),

    // URL and link functions
    isExternalLink: jest.fn(url => {
        if (!url) return false;
        return /^https?:\/\//.test(url) || url.startsWith('//');
    }),
};
