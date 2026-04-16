/**
 * Safely extract a single string value from Express query/params
 * which may be `string | string[] | undefined`.
 */
export function str(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}
