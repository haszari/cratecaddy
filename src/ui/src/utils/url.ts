export function withSearch(pathname: string): string {
  return `${pathname}${window.location.search}`;
}
