export function sanitizeString(str: string, maxLength: number): string {
  if (!str) return "";
  return str.slice(0, maxLength);
}
