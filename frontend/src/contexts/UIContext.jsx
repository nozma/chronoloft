import React, { createContext, useContext, useReducer } from 'react';
import { initialUIState, uiReducer } from '../reducers/uiReducer';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);
  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);