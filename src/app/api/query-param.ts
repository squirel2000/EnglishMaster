/** Extract the trimmed `q` search param; empty string when absent. */
export function getTrimmedQuery(request: Request): string {
  return new URL(request.url).searchParams.get('q')?.trim() ?? '';
}
