import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
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

UIProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useUI = () => useContext(UIContext);

