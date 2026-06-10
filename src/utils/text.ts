export function normalizeText(value: string): string {
  return value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function snippet(text: string, pattern: RegExp, fallback = ""): string {
  const match = text.match(pattern);
  if (!match?.index && match?.index !== 0) return fallback;
  const start = Math.max(0, match.index - 80);
  const end = Math.min(text.length, match.index + match[0].length + 120);
  return normalizeText(text.slice(start, end));
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}
