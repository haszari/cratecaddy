import { createContext, useContext } from 'react';

/**
 * Edit affordances are provided by the API shell, not by a feature flag.
 * The static shell has no edit route, so it renders no provider and the edit
 * link stays undefined.
 */
const EditLinksContext = createContext(false);

export const EditLinksProvider = EditLinksContext.Provider;

export function useEditLinks(): boolean {
  return useContext(EditLinksContext);
}
