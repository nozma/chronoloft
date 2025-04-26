import React, { createContext, useContext } from 'react';
import { initialUIState, uiReducer } from '../reducers/uiReducer';
import usePersistentReducer from '../hooks/usePersistentReducer';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  // UI状態はlocalstorageに保存する
  const [state, dispatch] = usePersistentReducer(
    uiReducer,
    initialUIState,
    'uiState'
  );
  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);