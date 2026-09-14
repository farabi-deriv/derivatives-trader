import { getLogoutURL } from '@deriv/shared';

/**
 * Request logout via REST API endpoint
 * @returns Promise with logout response
 */
export const requestRestLogout = async () => {
    try {
        const logoutUrl = getLogoutURL();

        // Step 1: Get logout URL and token
        const response = await fetch(logoutUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            // Step 2: Call the logout_url to complete logout
            if (data.logout_url) {
                await fetch(data.logout_url, {
                    method: 'GET',
                    credentials: 'include',
                });
            }
        }

        // Return success response - cleanup is handled by client-store.js
        return { logout: 1 };
    } catch (error) {
        // Return success response even if REST call fails - cleanup is handled by client-store.js
        return { logout: 1 };
    }
};
