import pkg from '../../package.json';

describe('@deriv/stores dependencies', () => {
    it('[DCR-014] should no longer declare mobx-persist-store', () => {
        expect(pkg.dependencies).not.toHaveProperty('mobx-persist-store');
    });

    it('[DCR-014] should keep mobx, the peer dependency of mobx-react-lite', () => {
        expect(pkg.dependencies).toHaveProperty('mobx');
    });
});
