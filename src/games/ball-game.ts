import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";

interface Impulse {
  dx: number;
  dy: number;
  remaining: number;
}

const IMPULSE_SPEED = 200; // pixels per second
const IMPULSE_DURATION = 300; // ms
const BALL_RADIUS = 20;

const DIRECTION_MAP: Record<string, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export class BallGame implements Game {
  private width = 0;
  private height = 0;
  private x = 0;
  private y = 0;
  private impulses: Impulse[] = [];

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.x = width / 2;
    this.y = height / 2;
  }

  update(deltaMs: number): void {
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

    // Ball
    ctx.beginPath();
    ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#e94560";
    ctx.fill();

    // Ball highlight
    ctx.beginPath();
    ctx.arc(this.x - 5, this.y - 5, BALL_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fill();

    // HUD - Instructions
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Chat Commands: !up !down !left !right", 20, 40);

    // HUD - Ball position
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`Ball: (${Math.round(this.x)}, ${Math.round(this.y)})`, 20, 70);

    // HUD - Active impulses
    if (this.impulses.length > 0) {
      ctx.fillText(`Active impulses: ${this.impulses.length}`, 20, 95);
    }
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
