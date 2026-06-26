import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { GOAL_CASES, type PlayerView } from "../core/protocol.ts";
import { avatarFor } from "./track.ts";

const SPACING = 86;        // px between platforms
const MARGIN = 60;
const PLAT_W = 56;
const PLAT_H = 18;
const AMPL = 26;           // vertical wave amplitude
const JUMP_MS = 480;

const LANE_COLORS = [0xff6b6b, 0x4dabf7, 0x51cf66, 0xcc5de8, 0xffa94d, 0x22b8cf, 0xf06595, 0x94d82d];

interface Avatar {
  node: Container;
  pos: number;
  // jump tween
  fromX: number; fromY: number; toX: number; toY: number; t: number; jumping: boolean;
  slot: number;
}
interface Confetti { g: Graphics; vx: number; vy: number; life: number; }

function platformXY(i: number): { x: number; y: number } {
  return { x: MARGIN + i * SPACING, y: Math.sin(i * 0.6) * AMPL };
}

/**
 * Animated quiz parcours: a winding line of floating platforms, one avatar per
 * player hopping case to case as the server advances them, a camera that tracks
 * the pack, and confetti on the finish.
 */
export class Board {
  private app = new Application();
  private world = new Container();
  private platforms = new Container();
  private avatarsLayer = new Container();
  private fx = new Container();
  private avatars = new Map<string, Avatar>();
  private confetti: Confetti[] = [];
  private selfId = "";
  private ready = false;
  private pending?: { players: PlayerView[]; selfId: string };
  private camX = 0;
  private onResize = () => this.resize();

  async mount(parent: HTMLElement) {
    await this.app.init({ background: "#bfe3ff", antialias: true, resizeTo: parent, resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true });
    parent.appendChild(this.app.canvas);
    window.addEventListener("resize", this.onResize);
    this.world.addChild(this.platforms, this.avatarsLayer);
    this.app.stage.addChild(this.world, this.fx);
    this.drawPlatforms();
    this.app.ticker.add(() => this.tick(this.app.ticker.deltaMS));
    this.ready = true;
    if (this.pending) { this.setPlayers(this.pending.players, this.pending.selfId); this.pending = undefined; }
  }

  private get baseY() { return this.app.renderer.height * 0.62; }

  private drawPlatforms() {
    const g = this.platforms;
    g.removeChildren();
    const base = this.baseY;
    for (let i = 0; i <= GOAL_CASES; i++) {
      const { x, y } = platformXY(i);
      const isGoal = i === GOAL_CASES;
      const p = new Graphics();
      p.roundRect(-PLAT_W / 2, -PLAT_H / 2, PLAT_W, PLAT_H, 9).fill(isGoal ? 0xffd23f : 0xffffff);
      p.roundRect(-PLAT_W / 2, PLAT_H / 2 - 5, PLAT_W, 7, 5).fill(0x9bd07a); // grassy underside
      p.position.set(x, base + y);
      g.addChild(p);
      if (isGoal) {
        const flag = new Text({ text: "🏁", style: new TextStyle({ fontSize: 26 }) });
        flag.anchor.set(0.5, 1); flag.position.set(x, base + y - PLAT_H);
        g.addChild(flag);
      }
    }
  }

  /** (Re)create avatars from the roster. */
  setPlayers(players: PlayerView[], selfId: string) {
    if (!this.ready) { this.pending = { players, selfId }; return; }
    this.selfId = selfId;
    const seen = new Set<string>();
    players.forEach((p, slot) => {
      seen.add(p.id);
      let a = this.avatars.get(p.id);
      if (!a) { a = this.spawnAvatar(p, slot); this.avatars.set(p.id, a); }
      a.slot = slot;
      this.moveTo(a, p.pos, true); // snap on first placement
    });
    for (const [id, a] of this.avatars) if (!seen.has(id)) { a.node.destroy(); this.avatars.delete(id); }
  }

  /** Animate avatars toward authoritative positions (called on reveal). */
  update(players: PlayerView[]) {
    if (!this.ready) { if (this.pending) this.pending.players = players; return; }
    for (const p of players) {
      const a = this.avatars.get(p.id);
      if (a && p.pos !== a.pos) this.moveTo(a, p.pos, false);
    }
  }

  celebrate() {
    if (!this.ready) return;
    for (let i = 0; i < 90; i++) this.spawnConfetti();
  }

  resize() { if (this.ready) { this.drawPlatforms(); for (const a of this.avatars.values()) this.moveTo(a, a.pos, true); } }

  destroy() {
    window.removeEventListener("resize", this.onResize);
    try { this.app.destroy(true, { children: true }); } catch { /* */ }
    this.avatars.clear(); this.ready = false;
  }

  // ── internals ──
  private spawnAvatar(p: PlayerView, slot: number): Avatar {
    const node = new Container();
    const disc = new Graphics();
    disc.circle(0, 0, 17).fill(LANE_COLORS[slot % LANE_COLORS.length]!);
    disc.circle(0, 0, 17).stroke({ color: 0xffffff, width: 3 });
    const face = new Text({ text: avatarFor(p.id), style: new TextStyle({ fontSize: 20 }) });
    face.anchor.set(0.5);
    node.addChild(disc, face);
    if (p.id === this.selfId) {
      const ring = new Graphics();
      ring.circle(0, 0, 22).stroke({ color: 0xff6b3d, width: 3 });
      node.addChildAt(ring, 0);
    }
    this.avatarsLayer.addChild(node);
    return { node, pos: p.pos, fromX: 0, fromY: 0, toX: 0, toY: 0, t: JUMP_MS, jumping: false, slot };
  }

  private slotOffset(slot: number) { return (slot % 2 ? 1 : -1) * (10 + Math.floor(slot / 2) * 9); }

  private moveTo(a: Avatar, pos: number, snap: boolean) {
    a.pos = pos;
    const { x, y } = platformXY(pos);
    const tx = x + this.slotOffset(a.slot);
    const ty = this.baseY + y - PLAT_H / 2 - 17;
    if (snap) { a.node.position.set(tx, ty); a.jumping = false; return; }
    a.fromX = a.node.x; a.fromY = a.node.y; a.toX = tx; a.toY = ty; a.t = 0; a.jumping = true;
  }

  private spawnConfetti() {
    const g = new Graphics();
    const col = LANE_COLORS[(Math.random() * LANE_COLORS.length) | 0]!;
    g.rect(-3, -5, 6, 10).fill(col);
    g.position.set(this.app.renderer.width / 2 + (Math.random() - 0.5) * 220, -20);
    this.fx.addChild(g);
    this.confetti.push({ g, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 3, life: 1.6 });
  }

  private tick(dtMs: number) {
    const dt = dtMs / 1000;
    // avatar jumps
    for (const a of this.avatars.values()) {
      if (!a.jumping) continue;
      a.t = Math.min(JUMP_MS, a.t + dtMs);
      const k = a.t / JUMP_MS;
      a.node.x = a.fromX + (a.toX - a.fromX) * k;
      a.node.y = a.fromY + (a.toY - a.fromY) * k - Math.sin(Math.PI * k) * 46;
      a.node.scale.set(1 + Math.sin(Math.PI * k) * 0.12);
      if (k >= 1) { a.jumping = false; a.node.scale.set(1); }
    }
    // camera: follow the pack (average position), smoothed
    if (this.avatars.size) {
      let avg = 0;
      for (const a of this.avatars.values()) avg += a.pos;
      avg /= this.avatars.size;
      const target = -(platformXY(avg).x - this.app.renderer.width / 2);
      this.camX += (target - this.camX) * Math.min(1, dt * 4);
      this.world.x = this.camX;
    }
    // confetti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i]!;
      c.life -= dt; c.vy += dt * 9;
      c.g.x += c.vx; c.g.y += c.vy; c.g.rotation += 0.2;
      if (c.life <= 0 || c.g.y > this.app.renderer.height + 30) { c.g.destroy(); this.confetti.splice(i, 1); }
    }
  }
}
