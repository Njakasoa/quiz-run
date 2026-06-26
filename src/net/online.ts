const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "https://api.njakasoa.xyz";

/**
 * Open a Quiz Run websocket to core-api's `/quiz/rt` gateway as an anonymous
 * guest. The guest token is cached (sessionStorage) and reused so a reconnect
 * keeps the same id. The player's name and room are passed in the URL so the
 * server can register them during the (async) upgrade — no first-message race.
 */
export async function connectQuiz(opts: { room: string; name: string }): Promise<WebSocket> {
  const token = await guestToken();
  const q = new URLSearchParams({ token, room: opts.room, name: opts.name });
  const wsUrl = `${API_BASE.replace(/^http/, "ws")}/quiz/rt?${q.toString()}`;
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("ws timeout")), 8000);
    ws.addEventListener("open", () => { clearTimeout(to); resolve(); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(to); reject(new Error("ws error")); }, { once: true });
  });
  return ws;
}

async function guestToken(): Promise<string> {
  try {
    const raw = sessionStorage.getItem("qr_guest");
    if (raw) {
      const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
      if (token && exp > Date.now() + 10_000) return token;
    }
  } catch { /* ignore */ }

  const res = await fetch(`${API_BASE}/v1/auth/guest`, { method: "POST" });
  if (!res.ok) throw new Error(`guest auth failed: ${res.status}`);
  const { accessToken, expiresIn } = (await res.json()) as { accessToken: string; expiresIn?: number };
  try {
    sessionStorage.setItem("qr_guest", JSON.stringify({ token: accessToken, exp: Date.now() + (expiresIn ?? 900) * 1000 }));
  } catch { /* ignore */ }
  return accessToken;
}
