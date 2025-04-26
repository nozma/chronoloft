import React, { createContext, useContext } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';

const FilterContext = createContext();

export function FilterProvider({ children }) {
    // filterの選択状態はlocalStorage に保存・復元
    const [filterState, setFilterState] = useLocalStorageState('filterState', {
        groupFilter: '',
        activityNameFilter: '',
        tagFilter: '',
    });

    return (
        <FilterContext.Provider value={{ filterState, setFilterState }}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilter() {
    return useContext(FilterContext);
}