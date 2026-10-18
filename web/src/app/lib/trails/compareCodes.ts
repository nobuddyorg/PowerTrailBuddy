/** Code-unit order of cache codes and trail ids: unlike localeCompare, the same in every locale. */
export function compareCodes(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
