/**
 * Contract-related utility functions
 */

/**
 * Extracts the underlying symbol from a contract shortcode.
 * The shortcode format is typically: "CONTRACT_UNDERLYING_..." where the underlying
 * symbol is the second part after splitting by underscore.
 *
 * @param shortcode - The contract shortcode (format: "CONTRACT_UNDERLYING_...")
 * @returns The underlying symbol extracted from shortcode or null if not found
 *
 * @example
 * // Extract from shortcode
 * getUnderlyingFromShortcode('CALL_1HZ100V_123456') // returns '1HZ100V'
 *
 * // Invalid or missing shortcode
 * getUnderlyingFromShortcode(null) // returns null
 * getUnderlyingFromShortcode('INVALID') // returns null
 */
export const getUnderlyingFromShortcode = (shortcode?: string | null): string | null => {
    if (shortcode) {
        const parts = shortcode.split('_');
        if (parts.length >= 2) {
            return parts[1];
        }
    }
    return null;
};
