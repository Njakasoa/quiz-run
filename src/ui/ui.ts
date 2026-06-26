import { h, type El } from "./dom.ts";
import { THEMES } from "../core/theme.ts";
import { trackEl, avatarFor } from "../render/track.ts";
import type { PlayerView, RankingEntry, QuizServerMsg } from "../core/protocol.ts";

type LobbyMsg = Extract<QuizServerMsg, { k: "lobby" }>;
type QuestionMsg = Extract<QuizServerMsg, { k: "question" }>;
type RevealMsg = Extract<QuizServerMsg, { k: "reveal" }>;

export class UI {
  private screen?: El;
  constructor(private root: El) {}

  private mount(el: El) { this.screen?.remove(); this.screen = el; this.root.append(el); }

  private name(): string { return (localStorage.getItem("qr_name") || "").trim(); }
  private saveName(n: string) { localStorage.setItem("qr_name", n); }

  // ── menu ──
  showMenu(onPlay: (name: string, themeId: string, room: string | null) => void) {
    const nameInput = h("input", { class: "field", placeholder: "Ton pseudo", maxlength: "16", value: this.name() }) as HTMLInputElement;
    const codeInput = h("input", { class: "field", placeholder: "Code (ex: AB12)", maxlength: "8", style: "text-transform:uppercase" }) as HTMLInputElement;
    let themeId = THEMES[0]!.id;

    const go = (room: string | null) => {
      const n = nameInput.value.trim() || "Joueur";
      this.saveName(n);
      onPlay(n, themeId, room);
    };

    this.mount(h("div", { class: "screen" },
      h("div", { class: "card" },
        h("div", { class: "brand" }, "QUIZ ", h("b", {}, "RUN")),
        h("div", { class: "tag" }, "Réponds vite, réponds juste — avance et gagne la course !"),
        h("label", { class: "lbl" }, "Pseudo"),
        nameInput,
        h("label", { class: "lbl" }, "Thème"),
        h("div", { class: "theme" },
          ...THEMES.map((t) => h("button", {
            class: "chip on",
            onclick: () => { themeId = t.id; },
            title: t.description,
          }, t.name)),
        ),
        h("button", { class: "btn big", onclick: () => go(null) }, "Créer une partie"),
        h("div", { class: "or" }, "ou rejoindre avec un code"),
        h("div", { class: "row" },
          codeInput,
          h("button", { class: "btn ghost", onclick: () => go(codeInput.value.trim().toUpperCase() || null) }, "Rejoindre"),
        ),
        h("div", { class: "foot" }, "Famille · amis · école — dès 7 ans"),
      ),
    ));
  }

  // ── lobby ──
  showLobby(o: { selfId: string; onStart: () => void; onLeave: () => void }) {
    const list = h("div", { class: "players" });
    const startBtn = h("button", { class: "btn big", onclick: o.onStart }, "Lancer la partie") as HTMLButtonElement;
    const codeEl = h("div", { class: "code" }, "····");
    const hint = h("div", { class: "tag" }, "");
    this.mount(h("div", { class: "screen" },
      h("div", { class: "card" },
        h("div", { class: "brand small" }, "SALON"),
        h("div", { class: "tag" }, "Partage ce code avec tes amis :"),
        codeEl,
        list,
        hint,
        h("div", { class: "row center" }, startBtn, h("button", { class: "btn ghost", onclick: o.onLeave }, "Quitter")),
      ),
    ));
    const render = (m: LobbyMsg) => {
      codeEl.textContent = m.code;
      list.innerHTML = "";
      m.players.forEach((p) => list.append(h("div", { class: "player" },
        h("span", { class: "pa" }, avatarFor(p.id)),
        h("span", {}, p.name + (p.id === o.selfId ? " (toi)" : "")),
        p.id === m.hostId ? h("span", { class: "host" }, "👑 hôte") : "",
      )));
      const isHost = m.selfId === m.hostId;
      startBtn.style.display = isHost ? "" : "none";
      hint.textContent = isHost
        ? (m.players.length < 2 ? "Tu peux lancer seul pour tester, ou attendre des joueurs." : "")
        : "En attente que l'hôte lance la partie…";
    };
    return { render };
  }

  // ── question ──
  showQuestion(o: { onAnswer: (choiceIndex: number) => void }) {
    const head = h("div", { class: "q-head" });
    const prompt = h("div", { class: "q-prompt" });
    const choices = h("div", { class: "choices" });
    const bar = h("div", { class: "timer-fill" });
    const board = h("div", { class: "board" });
    this.mount(h("div", { class: "screen" },
      h("div", { class: "q-wrap" },
        head,
        h("div", { class: "timer" }, bar),
        prompt,
        choices,
        board,
      ),
    ));
    const C = ["a", "b", "c", "d"];
    const render = (m: QuestionMsg, players: PlayerView[], selfId: string) => {
      head.textContent = `Question ${m.index} / ${m.total}`;
      prompt.textContent = m.prompt;
      board.innerHTML = ""; board.append(trackEl(players, selfId));
      choices.innerHTML = "";
      let answered = false;
      m.choices.forEach((c, i) => {
        const b = h("button", { class: `choice c-${C[i % 4]}`, onclick: () => {
          if (answered) return;
          answered = true;
          (b as HTMLButtonElement).classList.add("picked");
          choices.querySelectorAll("button").forEach((x) => ((x as HTMLButtonElement).disabled = true));
          o.onAnswer(i);
        } }, c);
        choices.append(b);
      });
      // timer animation
      const remain = Math.max(0, m.durationMs - (Date.now() - m.startedAt));
      bar.style.transition = "none"; bar.style.width = `${(remain / m.durationMs) * 100}%`;
      requestAnimationFrame(() => { bar.style.transition = `width ${remain}ms linear`; bar.style.width = "0%"; });
    };
    return { render };
  }

  // ── reveal (overlay on the question screen) ──
  showReveal(m: RevealMsg, chosen: number | null, players: PlayerView[], selfId: string) {
    const choices = this.root.querySelectorAll<HTMLButtonElement>(".choice");
    choices.forEach((b, i) => {
      b.disabled = true;
      if (i === m.answerIndex) b.classList.add("correct");
      else if (i === chosen) b.classList.add("wrong");
    });
    const board = this.root.querySelector(".board");
    if (board) { board.innerHTML = ""; board.append(trackEl(players, selfId)); }
    const expl = m.explanation ? h("div", { class: "explain" }, m.explanation) : null;
    const wrap = this.root.querySelector(".q-wrap");
    if (wrap && expl) { wrap.querySelector(".explain")?.remove(); wrap.append(expl); }
  }

  // ── finish ──
  showFinish(ranking: RankingEntry[], selfId: string, onMenu: () => void) {
    const mine = ranking.find((r) => r.id === selfId);
    const won = mine?.rank === 1;
    this.mount(h("div", { class: "screen" },
      h("div", { class: "card" },
        h("div", { class: "brand" }, won ? "🏆 GAGNÉ !" : "Terminé !"),
        h("div", { class: "tag" }, mine ? `Tu finis #${mine.rank} sur ${ranking.length}.` : "Partie terminée."),
        h("div", { class: "ranking" },
          ...ranking.slice(0, 8).map((r) => h("div", { class: "rank-row" + (r.id === selfId ? " me" : "") },
            h("span", {}, `#${r.rank}`),
            h("span", { class: "pa" }, avatarFor(r.id)),
            h("span", { class: "grow" }, r.name),
            h("span", { class: "muted" }, `${r.pos} cases`),
          )),
        ),
        h("button", { class: "btn big", onclick: onMenu }, "Retour au menu"),
      ),
    ));
  }

  toast(msg: string) {
    const t = h("div", { class: "toast" }, msg);
    this.root.append(t);
    setTimeout(() => t.remove(), 2600);
  }
}
