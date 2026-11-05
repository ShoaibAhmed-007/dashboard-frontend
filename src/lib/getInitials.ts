/**
 * Returns initials for a user's full name.
 * - Two or more words: first letter of first word + first letter of last word → "John Michael Doe" → "JD"
 * - Single word: first two letters → "Abbas" → "AB"
 * - Empty / undefined: "U"
 */
export function getInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return "U";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
