'use strict';

module.exports = {
    verifyConditions: async () => {
        throw new Error(
            '@semantic-release/npm is replaced by a security stub in this repo; use system npm / a dedicated release pipeline instead.'
        );
    },
    prepare: async () => {},
    publish: async () => {
        throw new Error(
            '@semantic-release/npm is replaced by a security stub in this repo; use system npm / a dedicated release pipeline instead.'
        );
    },
    addChannel: async () => {},
};
