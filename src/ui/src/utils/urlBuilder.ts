export type ViewType = 'artist' | 'genre' | 'home' | 'favourited';

export function buildEditUrl(
  currentSearch: string,
  viewType: ViewType,
  pathParams: {
    genreAll?: string;
    genreAny?: string;
    artistAny?: string;
  } = {},
): string {
  const params = new URLSearchParams(currentSearch);
  params.delete('edit');
  params.delete('page');
  params.delete('limit');
  params.delete('sort');
  params.delete('sortDirection');
  params.delete('shuffle');
  params.set('fromViewType', viewType);
  if (pathParams.artistAny && !params.has('artist.any')) {
    params.set('artist.any', pathParams.artistAny);
  }
  if (pathParams.genreAll && !params.has('genre.all')) {
    params.set('genre.all', pathParams.genreAll);
  }
  if (pathParams.genreAny && !params.has('genre.any')) {
    params.set('genre.any', pathParams.genreAny);
  }
  return `/edit-metadata?${params.toString()}`;
}

export function buildViewUrl(editSearch: string): string {
  const params = new URLSearchParams(editSearch);
  let viewType = params.get('fromViewType');
  viewType = viewType?.toLowerCase() ?? null;

  if (!viewType || !['artist', 'genre', 'home', 'favourited'].includes(viewType)) {
    if (params.has('artist.any')) viewType = 'artist';
    else if (params.has('genre.all') || params.has('genre.any')) viewType = 'genre';
    else viewType = 'home';
  }

  params.delete('fromViewType');
  params.delete('edit');

  let path: string;
  switch (viewType) {
    case 'artist': {
      const artist = params.get('artist.any');
      path = artist ? `/artist/${encodeURIComponent(artist)}` : '/';
      break;
    }
    case 'genre': {
      const genreAll = params.get('genre.all');
      const genreAny = params.get('genre.any');
      if (genreAll) {
        path = `/genre/${genreAll.split(',').join('+')}`;
      } else if (genreAny) {
        path = `/genre/${genreAny}`;
      } else {
        path = '/';
      }
      break;
    }
    case 'favourited':
      path = '/favourited';
      params.delete('favorite');
      break;
    default:
      path = '/';
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
