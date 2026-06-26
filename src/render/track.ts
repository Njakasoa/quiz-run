import { h, type El } from "../ui/dom.ts";
import { GOAL_CASES, type PlayerView } from "../core/protocol.ts";

const AVATARS = ["🦊", "🐼", "🐯", "🐸", "🐵", "🦁", "🐶", "🐱"];
export function avatarFor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % AVATARS.length;
  return AVATARS[n]!;
}

/**
 * The "parcours" : one lane per player, the avatar sliding from start to the
 * finish flag as `pos` grows toward GOAL_CASES. Pure CSS (the animated PixiJS
 * board is the next milestone).
 */
export function trackEl(players: PlayerView[], selfId: string): El {
  const lanes = [...players]
    .sort((a, b) => b.pos - a.pos)
    .map((p) => {
      const pct = Math.min(100, (p.pos / GOAL_CASES) * 100);
      const avatar = h("div", { class: "avatar", style: `left:${pct}%` }, avatarFor(p.id));
      return h("div", { class: "lane" + (p.id === selfId ? " me" : "") },
        h("div", { class: "lane-name" }, `${p.name}${p.id === selfId ? " (toi)" : ""}`),
        h("div", { class: "lane-rail" }, avatar, h("div", { class: "flag" }, "🏁")),
        h("div", { class: "lane-pos" }, `${p.pos}/${GOAL_CASES}`),
      );
    });
  return h("div", { class: "track" }, ...lanes);
}
