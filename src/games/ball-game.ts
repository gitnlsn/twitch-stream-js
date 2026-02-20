import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";
import { drawTopBar } from "../ui/hud";

interface Impulse {
  dx: number;
  dy: number;
  remaining: number;
}

const IMPULSE_SPEED = 200;
const IMPULSE_DURATION = 300;
const BALL_RADIUS = 20;
const TRAIL_LENGTH = 15;

const DIRECTION_MAP: Record<string, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

interface TrailPoint {
  x: number;
  y: number;
}

export class BallGame implements Game {
  readonly displayName = "Ball Game";

  private width = 0;
  private height = 0;
  private x = 0;
  private y = 0;
  private impulses: Impulse[] = [];
  private trail: TrailPoint[] = [];

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.x = width / 2;
    this.y = height / 2;
    this.trail = [];
  }

  update(deltaMs: number): void {
    // Store trail position
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.shift();
    }

    // Process impulse queue
    const toRemove: number[] = [];

    for (let i = 0; i < this.impulses.length; i++) {
      const imp = this.impulses[i];
      const step = Math.min(deltaMs, imp.remaining);
      const dist = (IMPULSE_SPEED * step) / 1000;

      this.x += imp.dx * dist;
      this.y += imp.dy * dist;

      imp.remaining -= step;
      if (imp.remaining <= 0) {
        toRemove.push(i);
      }
    }

    // Remove expired impulses (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.impulses.splice(toRemove[i], 1);
    }

    // Clamp to bounds
    this.x = Math.max(BALL_RADIUS, Math.min(this.width - BALL_RADIUS, this.x));
    this.y = Math.max(BALL_RADIUS, Math.min(this.height - BALL_RADIUS, this.y));
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, this.width, this.height);

    // Trail effect — fading circles
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = (i / this.trail.length) * 0.35;
      const radius = BALL_RADIUS * (0.4 + 0.6 * (i / this.trail.length));
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
      ctx.fill();
    }

    // Glow effect — larger semi-transparent circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, BALL_RADIUS * 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(233, 69, 96, 0.15)";
    ctx.fill();

    // Ball shadow bloom
    ctx.save();
    ctx.shadowColor = "#e94560";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#e94560";
    ctx.fill();
    ctx.restore();

    // Ball highlight
    ctx.beginPath();
    ctx.arc(this.x - 5, this.y - 5, BALL_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fill();

    // HUD
    drawTopBar(ctx, this.width, "Ball Game", "!up  !down  !left  !right");

    // Ball position info
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`(${Math.round(this.x)}, ${Math.round(this.y)})`, 16, this.height - 16);
  }

  handleChatCommand(cmd: ChatCommand): void {
    const dir = DIRECTION_MAP[cmd.command];
    if (!dir) return;

    this.impulses.push({
      dx: dir.dx,
      dy: dir.dy,
      remaining: IMPULSE_DURATION,
    });
  }
}
