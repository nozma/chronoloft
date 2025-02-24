import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchTags } from '../services/api';

const TagContext = createContext();

export function TagProvider({ children }) {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    fetchTags()
      .then(data => setTags(data))
      .catch(err => console.error("Failed to fetch tags:", err));
  }, []);

  return (
    <TagContext.Provider value={{ tags, setTags }}>
      {children}
    </TagContext.Provider>
  );
}

export function useTags() {
  return useContext(TagContext);
}