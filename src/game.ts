import { UI } from "./ui/ui.ts";
import { connectQuiz } from "./net/online.ts";
import { QuizClient } from "./net/quizTransport.ts";
import type { Board } from "./render/board.ts";
import type { PlayerView } from "./core/protocol.ts";

type View = "menu" | "lobby" | "question" | "finished";

export class Game {
  private ui = new UI(document.getElementById("app")!);
  private client?: QuizClient;
  private view: View = "menu";
  private selfId = "";
  private themeId = "classic-family-school";
  private players: PlayerView[] = [];
  private chosen: number | null = null;
  private lobby?: ReturnType<UI["showLobby"]>;
  private board?: Board;
  private leaving = false;

  start() { this.menu(); }

  private menu() {
    this.leaving = true;
    this.client?.close();
    this.client = undefined;
    this.ui.leaveMatch();
    this.board = undefined;
    this.view = "menu";
    this.ui.showMenu((name, themeId, room) => {
      this.themeId = themeId;
      void this.connect(name, room ?? randomCode());
    });
  }

  private async connect(name: string, room: string) {
    this.leaving = false;
    this.ui.toast("Connexion…");
    try {
      const ws = await connectQuiz({ room, name });
      const client = new QuizClient(ws);
      this.client = client;

      client.on("lobby", (m) => {
        this.selfId = m.selfId;
        this.players = m.players;
        if (this.view !== "lobby") {
          this.view = "lobby";
          this.lobby = this.ui.showLobby({
            selfId: m.selfId,
            onStart: () => client.start(this.themeId),
            onLeave: () => this.menu(),
          });
        }
        this.lobby!.render(m);
      });

      client.on("question", (m) => {
        this.chosen = null;
        if (!this.board) { // first question → build the animated board
          this.board = this.ui.enterMatch();
          this.board.setPlayers(this.players, this.selfId);
        }
        this.view = "question";
        this.ui.questionControls(m, (i) => { this.chosen = i; client.answer(m.questionId, i); });
      });

      client.on("state", (m) => { this.players = m.players; });

      client.on("reveal", (m) => {
        this.players = m.players;
        this.board?.update(m.players); // animate the hops
        this.ui.revealControls(m, this.chosen);
      });

      client.on("finish", (m) => {
        this.view = "finished";
        this.ui.finishControls(m.ranking, this.selfId, () => this.menu());
        this.board?.celebrate();
      });

      client.on("error", (m) => this.ui.toast(m.message));

      client.onClose = () => {
        if (this.leaving) return;
        this.ui.toast("Déconnecté du serveur");
        this.menu();
      };
    } catch (e) {
      console.error(e);
      this.ui.toast("Connexion impossible — réessaie");
      this.menu();
    }
  }
}

function randomCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => a[(Math.random() * a.length) | 0]).join("");
}
