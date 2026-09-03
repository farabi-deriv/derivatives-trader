import { action, computed, makeObservable } from 'mobx';

import { getPlatformName, isProduction } from '@deriv/shared';
import { getInitialLanguage } from '@deriv-com/translations';

import BaseStore from './base-store';

import BinarySocket from '_common/base/socket_base';

export default class GTMStore extends BaseStore {
    is_gtm_applicable = isProduction();

    constructor(root_store) {
        super({ root_store });

        makeObservable(this, {
            visitorId: computed,
            common_variables: computed,
            pushDataLayer: action.bound,
        });
    }

    get visitorId() {
        return this.root_store.client.loginid;
    }

    /**
     * Contains common data that will be passed to GTM on each datalayer push
     *
     * @returns {object}
     */
    get common_variables() {
        return {
            language: getInitialLanguage(),
            ...(this.root_store.client.is_logged_in && {
                visitorId: this.visitorId,
                currency: this.root_store.client.currency,
                userId: this.root_store.client.user_id,
                email: this.root_store.client.email,
            }),
            loggedIn: this.root_store.client.is_logged_in,
            theme: this.root_store.ui.is_dark_mode_on ? 'dark' : 'light',
            platform: getPlatformName(),
        };
    }

    /**
     * Pushes provided data as GTM DataLayer
     *
     * @param {object} data
     */
    async pushDataLayer(data) {
        if (this.is_gtm_applicable && this.root_store?.client?.is_logged_in) {
            // Gate on auth confirmation (is_authorize) — reconnect-proof, unlike the old
            // expectResponse('balance') which was pinned to one connection instance.
            BinarySocket?.waitForAuth?.().then(() => {
                const gtm_object = { ...this.common_variables, ...data };
                if (!gtm_object.event) return;

                dataLayer.push(gtm_object);
            });
        }
    }
}
