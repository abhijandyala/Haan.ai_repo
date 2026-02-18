import { useContext } from 'react';
import { AppContext, type AppContextValue } from '../context/app-context.js';

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return ctx;
}
