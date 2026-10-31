import { createContext } from 'react';

/**
 * Edit affordances are provided by the API shell, not by a feature flag.
 * The static site has no edit route, so it renders no provider and the edit
 * link stays undefined.
 */
export const EditLinksContext = createContext(false);

export const EditLinksProvider = EditLinksContext.Provider;
