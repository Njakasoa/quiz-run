import { h, type El } from "./dom.ts";
import { THEMES } from "../core/theme.ts";
import { avatarFor } from "../render/track.ts";
import { Board } from "../render/board.ts";
import { GOAL_CASES } from "../core/protocol.ts";
import type { MatchMode, RankingEntry, CoopResult, QuizServerMsg } from "../core/protocol.ts";

type LobbyMsg = Extract<QuizServerMsg, { k: "lobby" }>;
type QuestionMsg = Extract<QuizServerMsg, { k: "question" }>;
type RevealMsg = Extract<QuizServerMsg, { k: "reveal" }>;

export class UI {
  private screen?: El;
  private controls?: El;   // swappable area below the persistent board
  private boardObj?: Board;
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
  showLobby(o: { selfId: string; onStart: () => void; onLeave: () => void; onSetMode: (m: MatchMode) => void }) {
    const list = h("div", { class: "players" });
    const startBtn = h("button", { class: "btn big", onclick: o.onStart }, "Lancer la partie") as HTMLButtonElement;
    const codeEl = h("div", { class: "code" }, "····");
    const hint = h("div", { class: "tag" }, "");
    const modeBtn = (mode: MatchMode, label: string, desc: string) =>
      h("button", { class: "mode-opt", "data-mode": mode, title: desc, onclick: () => o.onSetMode(mode) },
        h("b", {}, label), h("small", {}, desc));
    const modeRow = h("div", { class: "modes" },
      modeBtn("classic", "Course", "Chacun pour soi"),
      modeBtn("coop", "Coop / école", "On gagne ensemble"),
    );
    this.mount(h("div", { class: "screen" },
      h("div", { class: "card" },
        h("div", { class: "brand small" }, "SALON"),
        h("div", { class: "tag" }, "Partage ce code avec tes amis :"),
        codeEl,
        h("label", { class: "lbl" }, "Mode de jeu"),
        modeRow,
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
      // reflect the selected mode; only the host can change it
      modeRow.querySelectorAll<HTMLButtonElement>(".mode-opt").forEach((b) => {
        b.classList.toggle("on", b.getAttribute("data-mode") === m.mode);
        b.disabled = !isHost;
      });
      startBtn.style.display = isHost ? "" : "none";
      hint.textContent = isHost
        ? (m.players.length < 2 ? "Tu peux lancer seul pour tester, ou attendre des joueurs." : "")
        : "En attente que l'hôte lance la partie…";
    };
    return { render };
  }

  // ── match (persistent animated board + swappable controls) ──
  get board() { return this.boardObj; }

  enterMatch(): Board {
    const boardHost = h("div", { class: "board-host" });
    const controls = h("div", { class: "controls" });
    this.controls = controls;
    this.mount(h("div", { class: "match" }, boardHost, controls));
    const board = new Board();
    this.boardObj = board;
    void board.mount(boardHost);
    return board;
  }

  leaveMatch() {
    this.boardObj?.destroy();
    this.boardObj = undefined;
    this.controls = undefined;
  }

  questionControls(m: QuestionMsg, onAnswer: (choiceIndex: number) => void) {
    const controls = this.controls;
    if (!controls) return;
    const bar = h("div", { class: "timer-fill" });
    const choices = h("div", { class: "choices" });
    controls.innerHTML = "";
    controls.append(
      h("div", { class: "q-head" }, `Question ${m.index} / ${m.total}`),
      h("div", { class: "timer" }, bar),
      h("div", { class: "q-prompt" }, m.prompt),
      choices,
      h("div", { class: "explain" }), // reserved slot → no layout jump on reveal
    );
    const C = ["a", "b", "c", "d"];
    let answered = false;
    m.choices.forEach((c, i) => {
      const b = h("button", { class: `choice c-${C[i % 4]}`, onclick: () => {
        if (answered) return;
        answered = true;
        b.classList.add("picked");
        choices.querySelectorAll("button").forEach((x) => ((x as HTMLButtonElement).disabled = true));
        onAnswer(i);
      } }, c);
      choices.append(b);
    });
    const remain = Math.max(0, m.durationMs - (Date.now() - m.startedAt));
    bar.style.transition = "none"; bar.style.width = `${(remain / m.durationMs) * 100}%`;
    requestAnimationFrame(() => { bar.style.transition = `width ${remain}ms linear`; bar.style.width = "0%"; });
  }

  revealControls(m: RevealMsg, chosen: number | null) {
    const controls = this.controls;
    if (!controls) return;
    controls.querySelectorAll<HTMLButtonElement>(".choice").forEach((b, i) => {
      b.disabled = true;
      if (i === m.answerIndex) b.classList.add("correct");
      else if (i === chosen) b.classList.add("wrong");
    });
    if (m.explanation) {
      const slot = controls.querySelector(".explain");
      if (slot) { slot.textContent = m.explanation; slot.classList.add("show"); }
    }
  }

  finishControls(o: {
    mode: MatchMode; ranking: RankingEntry[]; coop?: CoopResult;
    selfId: string; isHost: boolean; onRematch: () => void; onMenu: () => void;
  }) {
    const controls = this.controls;
    if (!controls) return;
    let title: string, sub: string;
    if (o.mode === "coop") {
      const c = o.coop;
      title = c?.allFinished ? "🎉 Bravo l'équipe !" : "Bien joué l'équipe !";
      sub = c?.allFinished ? "Tout le monde est arrivé au bout !"
          : c ? `${c.arrived}/${c.total} arrivés — réessayez pour finir tous ensemble !` : "";
    } else {
      const mine = o.ranking.find((r) => r.id === o.selfId);
      title = mine?.rank === 1 ? "🏆 GAGNÉ !" : "Terminé !";
      sub = mine ? `Tu finis #${mine.rank} / ${o.ranking.length}.` : "";
    }
    controls.innerHTML = "";
    controls.append(
      h("div", { class: "brand small" }, title),
      sub ? h("div", { class: "tag" }, sub) : "",
      h("div", { class: "ranking" },
        ...o.ranking.slice(0, 8).map((r) => h("div", { class: "rank-row" + (r.id === o.selfId ? " me" : "") },
          h("span", {}, o.mode === "coop" ? (r.pos >= GOAL_CASES ? "✅" : "🏃") : `#${r.rank}`),
          h("span", { class: "pa" }, avatarFor(r.id)),
          h("span", { class: "grow" }, r.name),
          h("span", { class: "muted" }, `${r.pos} cases`),
        )),
      ),
      h("div", { class: "row center" },
        o.isHost
          ? h("button", { class: "btn big", onclick: o.onRematch }, "Rejouer")
          : h("div", { class: "tag" }, "L'hôte peut relancer…"),
        h("button", { class: "btn ghost", onclick: o.onMenu }, "Menu"),
      ),
    );
  }

  toast(msg: string) {
    const t = h("div", { class: "toast" }, msg);
    this.root.append(t);
    setTimeout(() => t.remove(), 2600);
  }
}
