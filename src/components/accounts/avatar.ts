// Deterministic avatar styling for names that have no server-side logo/colour
// (clients and bank accounts). Extracted from ClientsView so the balances grid
// can reuse the same palette.

const AVATAR_BG = ["#e2e7ff", "#dcfce7", "#fef3c7", "#fce7f3", "#dbeafe", "#ede9fe"];
const AVATAR_FG = ["#4f46e5", "#15803d", "#b45309", "#be185d", "#1d4ed8", "#7e22ce"];

/** First + last word initials, e.g. "Acme Corp Inc" → "AI". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? words.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

/** Stable palette index so a given name always renders the same colours. */
export function avatarIndex(name: string): number {
  return (
    name.split("").reduce((total, letter) => total + letter.charCodeAt(0), 0) %
    AVATAR_BG.length
  );
}

export function avatarColors(name: string): { background: string; color: string } {
  const index = avatarIndex(name);
  return { background: AVATAR_BG[index], color: AVATAR_FG[index] };
}
