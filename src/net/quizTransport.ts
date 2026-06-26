import type { QuizClientMsg, QuizServerMsg } from "../core/protocol.ts";

type Handlers = {
  [M in QuizServerMsg as M["k"]]?: (msg: M) => void;
};

/**
 * Thin typed wrapper over the quiz websocket: routes each server message to a
 * handler and exposes the two client actions. The server is authoritative, so
 * this class holds no game logic — it just sends intents and surfaces state.
 */
export class QuizClient {
  private ws: WebSocket;
  private handlers: Handlers = {};
  onClose?: () => void;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (e) => this.dispatch(String(e.data)));
    ws.addEventListener("close", () => this.onClose?.());
  }

  on<K extends QuizServerMsg["k"]>(k: K, fn: (msg: Extract<QuizServerMsg, { k: K }>) => void) {
    (this.handlers as Record<string, unknown>)[k] = fn;
    return this;
  }

  start(themeId: string) { this.send({ k: "start", themeId }); }
  answer(questionId: string, choiceIndex: number) { this.send({ k: "answer", questionId, choiceIndex }); }
  close() { try { this.ws.close(); } catch { /* */ } }

  private send(m: QuizClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private dispatch(raw: string) {
    let msg: QuizServerMsg;
    try { msg = JSON.parse(raw); } catch { return; }
    const fn = (this.handlers as Record<string, ((m: QuizServerMsg) => void) | undefined>)[msg.k];
    fn?.(msg);
  }
}
