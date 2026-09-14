import * as Helpers from '../helpers';
import getRoutesConfig from '../../../Constants/routes-config';

describe('Helpers', () => {
    describe('normalizePath', () => {
        it('should return / as if path is empty', () => {
            expect(Helpers.normalizePath('')).toBe('/');
        });
        it('should return / + path as if path does not have /', () => {
            expect(Helpers.normalizePath('trade')).toBe('/trade');
        });
        it('should return / + path as if path does have /', () => {
            expect(Helpers.normalizePath('/trade')).toBe('/trade');
        });
    });

    describe('findRouteByPath', () => {
        it('should return undefined when path is not in routes_config', () => {
            expect(Helpers.findRouteByPath('invalidRoute', getRoutesConfig())).toBeUndefined();
        });
    });
});
