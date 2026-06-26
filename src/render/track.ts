const AVATARS = ["🦊", "🐼", "🐯", "🐸", "🐵", "🦁", "🐶", "🐱"];

/** Stable per-player avatar emoji (same id → same face on board & ranking). */
export function avatarFor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % AVATARS.length;
  return AVATARS[n]!;
}
