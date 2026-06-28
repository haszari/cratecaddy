const STAGE_VALUES = new Set(['Warmup', 'Peak', 'Later']);
const SET_VALUES = new Set(['Deep', 'BAM', 'Ambient']);
const LISTENING_VALUES = new Set([
  'Jazz', 'Funk', 'Classical', 'Contemporary',
  'Electronic', 'Dance', 'Hip Hop', 'Pop',
  'Rock', 'Country', 'Indie', 'Reggae',
]);
const NZ = 'NZ';

export interface DecomposedGenres {
  stage: string[];
  set: string[];
  locationNz: boolean;
  listening: string[];
  styles: string[];
}

export function decomposeGenres(genres: string[]): DecomposedGenres {
  const stage: string[] = [];
  const set: string[] = [];
  const listening: string[] = [];
  let locationNz = false;
  const styles: string[] = [];

  for (const g of genres) {
    if (STAGE_VALUES.has(g)) {
      stage.push(g);
    } else if (SET_VALUES.has(g)) {
      set.push(g);
    } else if (g === NZ) {
      locationNz = true;
    } else if (LISTENING_VALUES.has(g)) {
      listening.push(g);
    } else {
      styles.push(g);
    }
  }

  return { stage, set, locationNz, listening, styles };
}

export function reassembleGenres(
  stage: string[],
  set: string[],
  locationNz: boolean,
  listening: string[],
  styles: string[],
): string[] {
  const sortedListening = listening.slice().sort();
  const sortedStyles = styles.slice().sort();
  const parts: string[] = [
    ...sortedListening,
    ...sortedStyles,
    ...(locationNz ? [NZ] : []),
    ...set,
    ...stage,
  ];
  return parts;
}
