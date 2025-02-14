import React, { createContext, useContext, useState } from 'react';

const ActiveActivityContext = createContext();

export function ActiveActivityProvider({ children }) {
  const [activeActivity, setActiveActivity] = useState(null);
  return (
    <ActiveActivityContext.Provider value={{ activeActivity, setActiveActivity }}>
      {children}
    </ActiveActivityContext.Provider>
  );
}

export function useActiveActivity() {
  return useContext(ActiveActivityContext);
}