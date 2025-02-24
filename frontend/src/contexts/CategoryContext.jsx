import React, { createContext, useContext } from 'react';

const CategoryContext = createContext();

export function CategoryProvider({ children }) {
    // {categories: []}を返すだけ
    return (
      <CategoryContext.Provider value={{ categories: [] }}>
        {children}
      </CategoryContext.Provider>
    );
  }

export function useCategories() {
  return useContext(CategoryContext);
}