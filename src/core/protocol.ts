/**
 * Client mirror of the core-api quiz protocol (src/games/quiz/protocol.ts).
 * The server is authoritative — the client never sees `answerIndex` until a
 * `reveal`. Keep these types in sync with the backend.
 */

export type MatchPhase = "lobby" | "question" | "reveal" | "finished";

export interface PlayerView {
  id: string;
  name: string;
  pos: number;
  streak: number;
  answered: boolean;
}

export interface RankingEntry {
  rank: number;
  id: string;
  name: string;
  pos: number;
}

export type QuizClientMsg =
  | { k: "hello"; name: string }
  | { k: "start"; themeId: string }
  | { k: "answer"; questionId: string; choiceIndex: number };

export type QuizServerMsg =
  | { k: "lobby"; code: string; hostId: string; selfId: string; players: PlayerView[] }
  | {
      k: "question";
      questionId: string;
      index: number;
      total: number;
      prompt: string;
      choices: string[];
      durationMs: number;
      startedAt: number;
    }
  | { k: "reveal"; questionId: string; answerIndex: number; explanation?: string; players: PlayerView[] }
  | { k: "state"; phase: MatchPhase; players: PlayerView[] }
  | { k: "finish"; ranking: RankingEntry[] }
  | { k: "error"; message: string };

export const GOAL_CASES = 30;
