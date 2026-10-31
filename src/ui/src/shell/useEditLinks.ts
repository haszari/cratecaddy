import { useContext } from 'react';
import { EditLinksContext } from './editLinksContext';

export function useEditLinks(): boolean {
  return useContext(EditLinksContext);
}
