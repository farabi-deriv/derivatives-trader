import { configure, isObservableProp, reaction } from 'mobx';

import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import PositionsStore from '../positions-store';

configure({ safeDescriptors: false });

let mockedPositionsStore: PositionsStore;

beforeAll(async () => {
    mockedPositionsStore = new PositionsStore({
        root_store: mockStore({}) as unknown as TRootStore,
    });
});

describe('PositionsStore', () => {
    describe('setClosedContractTypeFilter', () => {
        it('should set closedContractTypeFilter', () => {
            mockedPositionsStore.setClosedContractTypeFilter(['Accumulators']);
            expect(mockedPositionsStore.closedContractTypeFilter).toEqual(['Accumulators']);
            expect(mockedPositionsStore.filteredContractTypes).toEqual(['ACCU']);
            mockedPositionsStore.setClosedContractTypeFilter([]);
            expect(mockedPositionsStore.closedContractTypeFilter).toEqual([]);
            expect(mockedPositionsStore.filteredContractTypes).toEqual([]);
        });
    });
    describe('filteredContractTypes observability', () => {
        it('[ABF-005] registers filteredContractTypes as a MobX observable', () => {
            expect(isObservableProp(mockedPositionsStore, 'filteredContractTypes')).toBe(true);
        });
        it('[ABF-005] notifies reactions when filteredContractTypes changes via setClosedContractTypeFilter', () => {
            mockedPositionsStore.setClosedContractTypeFilter([]);
            const spy = jest.fn();
            const dispose = reaction(() => mockedPositionsStore.filteredContractTypes, spy);

            mockedPositionsStore.setClosedContractTypeFilter(['Accumulators']);

            expect(spy).toHaveBeenCalled();
            dispose();
            mockedPositionsStore.setClosedContractTypeFilter([]);
        });
    });
    describe('setOpenContractTypeFilter', () => {
        it('should set openContractTypeFilter', () => {
            mockedPositionsStore.setOpenContractTypeFilter(['Rise/Fall']);
            expect(mockedPositionsStore.openContractTypeFilter).toEqual(['Rise/Fall']);
            mockedPositionsStore.setOpenContractTypeFilter([]);
            expect(mockedPositionsStore.openContractTypeFilter).toEqual([]);
        });
    });
    describe('setTimeFilter', () => {
        it('should set timeFilter', () => {
            mockedPositionsStore.setTimeFilter('All time');
            expect(mockedPositionsStore.timeFilter).toEqual('All time');
            mockedPositionsStore.setTimeFilter();
            expect(mockedPositionsStore.timeFilter).toEqual('');
        });
    });
    describe('setCustomTimeRangeFilter', () => {
        it('should set customTimeRangeFilter', () => {
            mockedPositionsStore.setCustomTimeRangeFilter('25 May 2024');
            expect(mockedPositionsStore.customTimeRangeFilter).toEqual('25 May 2024');
            mockedPositionsStore.setCustomTimeRangeFilter();
            expect(mockedPositionsStore.customTimeRangeFilter).toEqual('');
        });
    });
    describe('setDateFrom', () => {
        it('should set dateFrom', () => {
            mockedPositionsStore.setDateFrom(123424262);
            expect(mockedPositionsStore.dateFrom).toEqual(123424262);
            mockedPositionsStore.setDateFrom(null);
            expect(mockedPositionsStore.dateFrom).toEqual(null);
        });
    });
    describe('setDateTo', () => {
        it('should set dateTo', () => {
            mockedPositionsStore.setDateTo(12346779);
            expect(mockedPositionsStore.dateTo).toEqual(12346779);
            mockedPositionsStore.setDateTo(null);
            expect(mockedPositionsStore.dateTo).toEqual(null);
        });
    });
    describe('onUnmount', () => {
        it('should reset all filters, when onUnmount is called', () => {
            mockedPositionsStore.setDateTo(12346779);
            mockedPositionsStore.setDateFrom(123424262);
            mockedPositionsStore.setCustomTimeRangeFilter('25 May 2024');
            mockedPositionsStore.setTimeFilter('All time');
            mockedPositionsStore.setOpenContractTypeFilter(['Rise/Fall']);
            mockedPositionsStore.setClosedContractTypeFilter(['Accumulators']);

            mockedPositionsStore.onUnmount();

            expect(mockedPositionsStore.dateTo).toEqual(null);
            expect(mockedPositionsStore.dateFrom).toEqual(null);
            expect(mockedPositionsStore.customTimeRangeFilter).toEqual('');
            expect(mockedPositionsStore.timeFilter).toEqual('');
            expect(mockedPositionsStore.openContractTypeFilter).toEqual([]);
            expect(mockedPositionsStore.closedContractTypeFilter).toEqual([]);
        });
    });
});
