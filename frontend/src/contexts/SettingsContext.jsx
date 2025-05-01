import React, { createContext, useContext, useMemo } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';

const SettingsContext = createContext();

/**
 * SettingsProvider
 *   - autoFilterOnSelect: bool
 *   - setAutoFilterOnSelect: (bool) => void
 */
export function SettingsProvider({ children }) {
  const [autoFilterOnSelect, setAutoFilterOnSelect] =
    useLocalStorageState('settings.autoFilterOnSelect', true);

  const value = useMemo(
    () => ({ autoFilterOnSelect, setAutoFilterOnSelect }),
    [autoFilterOnSelect]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
