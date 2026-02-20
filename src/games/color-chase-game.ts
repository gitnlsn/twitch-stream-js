import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";
import { drawTopBar, drawLeaderboard } from "../ui/hud";

const SQUARE_SIZE = 40;
const COLORS = ["#e94560", "#0f3460", "#16c79a", "#f5a623", "#8b5cf6", "#ec4899", "#06b6d4"];
const MAX_PARTICLES = 50;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class ColorChaseGame implements Game {
  readonly displayName = "Color Chase";

  private width = 0;
  private height = 0;
  private squareX = 0;
  private squareY = 0;
  private color = COLORS[0];
  private catches: Map<string, number> = new Map();
  private lastCatcher = "";
  private pulsePhase = 0;
  private particles: Particle[] = [];

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.catches.clear();
    this.lastCatcher = "";
    this.particles = [];
    this.pulsePhase = 0;
    this.teleport();
  }

  update(deltaMs: number): void {
    // Pulse animation
    this.pulsePhase += (deltaMs / 1000) * Math.PI * 2;

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * (deltaMs / 1000);
      p.y += p.vy * (deltaMs / 1000);
      p.vy += 200 * (deltaMs / 1000); // gravity
      p.life -= deltaMs;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, this.width, this.height);

    // Particles (behind square)
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Target square with pulse
    const scale = 1 + 0.1 * Math.sin(this.pulsePhase);
    const size = SQUARE_SIZE * scale;
    const offset = (size - SQUARE_SIZE) / 2;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.squareX - offset, this.squareY - offset, size, size);

    // HUD
    drawTopBar(ctx, this.width, "Color Chase", "!catch");

    // Last catcher
    if (this.lastCatcher) {
      ctx.font = "15px sans-serif";
      ctx.fillStyle = "#16c79a";
      ctx.fillText(`Last catch: ${this.lastCatcher}`, 16, 72);
    }

    // Leaderboard
    const sorted = [...this.catches.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({ name, score }));
    drawLeaderboard(ctx, 16, 90, "Leaderboard", sorted);
  }

  handleChatCommand(cmd: ChatCommand): void {
    if (cmd.command !== "catch") return;

    // Spawn particles at old square position
    this.spawnParticles(this.squareX + SQUARE_SIZE / 2, this.squareY + SQUARE_SIZE / 2);

    const prev = this.catches.get(cmd.username) || 0;
    this.catches.set(cmd.username, prev + 1);
    this.lastCatcher = cmd.username;
    this.teleport();
  }

  private teleport(): void {
    this.squareX = Math.floor(Math.random() * (this.width - SQUARE_SIZE));
    this.squareY = Math.floor(Math.random() * (this.height - SQUARE_SIZE));
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  private spawnParticles(cx: number, cy: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 4,
      });
    }
  }
}
