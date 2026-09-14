import { action, makeObservable, observable, override } from 'mobx';

import { BaseStore } from '@deriv/stores';

import { getFilteredContractTypes } from 'AppV2/Utils/positions-utils';
import { TRootStore } from 'Types';

export default class PositionsStore extends BaseStore<TRootStore> {
    openContractTypeFilter: string[] | [] = [];
    closedContractTypeFilter: string[] | [] = [];
    filteredContractTypes: string[] | [] = [];
    timeFilter = '';
    customTimeRangeFilter = '';
    tradeModeFilter = '';
    dateFrom: number | null = null;
    dateTo: number | null = null;

    constructor({ root_store }: { root_store: TRootStore }) {
        super({ root_store });

        makeObservable(this, {
            openContractTypeFilter: observable,
            closedContractTypeFilter: observable,
            timeFilter: observable,
            customTimeRangeFilter: observable,
            tradeModeFilter: observable,
            dateFrom: observable,
            dateTo: observable,
            setClosedContractTypeFilter: action.bound,
            setOpenContractTypeFilter: action.bound,
            setTimeFilter: action.bound,
            setCustomTimeRangeFilter: action.bound,
            setTradeModeFilter: action.bound,
            setDateFrom: action.bound,
            setDateTo: action.bound,
            onUnmount: override,
        });
    }

    setClosedContractTypeFilter(contractTypes: string[] | []) {
        this.closedContractTypeFilter = [...contractTypes];
        this.filteredContractTypes = getFilteredContractTypes(contractTypes);
    }

    setOpenContractTypeFilter(contractTypes: string[] | []) {
        this.openContractTypeFilter = [...contractTypes];
    }

    setTimeFilter(newTimeFilter?: string) {
        this.timeFilter = newTimeFilter || '';
    }

    setCustomTimeRangeFilter(newCustomTimeFilter?: string) {
        this.customTimeRangeFilter = newCustomTimeFilter || '';
    }

    setTradeModeFilter(newTradeModeFilter?: string) {
        this.tradeModeFilter = newTradeModeFilter || '';
    }

    setDateFrom(newDateFrom: number | null) {
        this.dateFrom = newDateFrom;
    }

    setDateTo(newDateTo: number | null) {
        this.dateTo = newDateTo;
    }

    onUnmount() {
        this.setClosedContractTypeFilter([]);
        this.setOpenContractTypeFilter([]);
        this.setTimeFilter('');
        this.setCustomTimeRangeFilter('');
        this.setTradeModeFilter('');
        this.setDateFrom(null);
        this.setDateTo(null);
    }
}
