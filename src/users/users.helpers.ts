export function getUsernamePrefixUpperBound(query: string): string | null {
  const lastChar = query.at(-1);

  if (!lastChar) {
    return null;
  }

  return `${query.slice(0, -1)}${String.fromCharCode(
    lastChar.charCodeAt(0) + 1,
  )}`;
}
