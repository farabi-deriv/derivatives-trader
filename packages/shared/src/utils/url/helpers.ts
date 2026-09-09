/**
 * Appends a language parameter to a URL
 * @param url - The base URL to append the language parameter to
 * @param language - The language code (e.g., 'EN', 'FR', 'ES')
 * @returns The URL with the language parameter appended
 */
export const appendLangParam = (url: string, language?: string): string => {
    if (!language || !url) return url;

    try {
        const urlObj = new URL(url);

        // Only add lang param if it doesn't already exist
        if (!urlObj.searchParams.has('lang')) {
            urlObj.searchParams.set('lang', language.toUpperCase());
        }

        return urlObj.toString();
    } catch (error) {
        // If URL parsing fails, fallback to simple string concatenation
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}lang=${language.toUpperCase()}`;
    }
};
