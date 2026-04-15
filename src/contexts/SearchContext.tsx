import React, { createContext, useContext, useState, useCallback } from 'react';

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  listSearchVisible: boolean;
  setListSearchVisible: (v: boolean) => void;
}

const SearchContext = createContext<SearchContextValue>({
  query: '',
  setQuery: () => {},
  listSearchVisible: false,
  setListSearchVisible: () => {},
});

export const useSearch = () => useContext(SearchContext);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [query, setQueryRaw] = useState('');
  const [listSearchVisible, setListSearchVisible] = useState(false);

  const setQuery = useCallback((q: string) => setQueryRaw(q), []);

  return (
    <SearchContext.Provider value={{ query, setQuery, listSearchVisible, setListSearchVisible }}>
      {children}
    </SearchContext.Provider>
  );
};
