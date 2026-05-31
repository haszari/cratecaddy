const STAGE_VALUES = new Set(['Warmup', 'Peak', 'Later']);
const SET_VALUES = new Set(['Deep', 'BAM', 'Ambient']);
const NZ = 'NZ';

export interface DecomposedGenres {
  stage: string;
  set: string;
  locationNz: boolean;
  styles: string[];
}

export function decomposeGenres(genres: string[]): DecomposedGenres {
  let stage = '';
  let set = '';
  let locationNz = false;
  const styles: string[] = [];

  for (const g of genres) {
    if (STAGE_VALUES.has(g)) {
      stage = g;
    } else if (SET_VALUES.has(g)) {
      set = g;
    } else if (g === NZ) {
      locationNz = true;
    } else {
      styles.push(g);
    }
  }

  return { stage, set, locationNz, styles };
}

export function reassembleGenres(
  stage: string,
  set: string,
  locationNz: boolean,
  styles: string[],
): string[] {
  const sorted = styles.slice().sort();
  const parts: string[] = [
    ...sorted,
    ...(locationNz ? [NZ] : []),
    ...(set ? [set] : []),
    ...(stage ? [stage] : []),
  ];
  return parts;
}
