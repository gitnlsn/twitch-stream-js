import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";
import { drawTopBar, drawLeaderboard } from "../ui/hud";
import { easeOut, clamp01 } from "../ui/easing";

const WORDS = [
  "stream", "twitch", "gaming", "chat", "emote", "pixel", "score",
  "combo", "turbo", "quest", "loot", "spawn", "ninja", "clutch",
  "hype", "glitch", "boost", "flame", "frost", "blade",
];

const WORD_POP_DURATION = 300;
const FLASH_DURATION = 500;
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

export class TypingGame implements Game {
  readonly displayName = "Typing Game";

  private width = 0;
  private height = 0;
  private currentWord = "";
  private scores: Map<string, number> = new Map();
  private lastWinner = "";
  private wordAge = 0;
  private flashTimer = 0;
  private particles: Particle[] = [];

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.scores.clear();
    this.lastWinner = "";
    this.flashTimer = 0;
    this.particles = [];
    this.pickNewWord();
  }

  update(deltaMs: number): void {
    this.wordAge += deltaMs;
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - deltaMs);
    }

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * (deltaMs / 1000);
      p.y += p.vy * (deltaMs / 1000);
      p.vy += 150 * (deltaMs / 1000);
      p.life -= deltaMs;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#1b1b3a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Flash overlay on correct answer
    if (this.flashTimer > 0) {
      const alpha = 0.15 * (this.flashTimer / FLASH_DURATION);
      ctx.fillStyle = `rgba(22, 199, 154, ${alpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Particles
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Current word with pop-in animation
    const popT = clamp01(this.wordAge / WORD_POP_DURATION);
    const scale = easeOut(popT);

    ctx.save();
    const wordX = this.width / 2;
    const wordY = this.height / 2;
    ctx.translate(wordX, wordY);
    ctx.scale(scale, scale);

    ctx.font = "bold 64px sans-serif";
    ctx.fillStyle = "#06b6d4";
    ctx.textAlign = "center";
    ctx.fillText(this.currentWord, 0, 0);

    ctx.restore();
    ctx.textAlign = "left";

    // Last winner
    if (this.lastWinner) {
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#16c79a";
      const winText = `${this.lastWinner} got it!`;
      ctx.textAlign = "center";
      ctx.fillText(winText, this.width / 2, this.height / 2 + 40);
      ctx.textAlign = "left";
    }

    // HUD
    drawTopBar(ctx, this.width, "Typing Game", "!type <word>");

    // Scoreboard
    const sorted = [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({ name, score }));
    drawLeaderboard(ctx, 16, 60, "Scoreboard", sorted);
  }

  handleChatCommand(cmd: ChatCommand): void {
    if (cmd.command !== "type") return;

    const guess = cmd.args[0]?.toLowerCase();
    if (guess === this.currentWord) {
      const prev = this.scores.get(cmd.username) || 0;
      this.scores.set(cmd.username, prev + 1);
      this.lastWinner = cmd.username;

      // Spawn particles at word position
      this.spawnParticles(this.width / 2, this.height / 2);
      this.flashTimer = FLASH_DURATION;

      this.pickNewWord();
    }
  }

  private pickNewWord(): void {
    let word: string;
    do {
      word = WORDS[Math.floor(Math.random() * WORDS.length)];
    } while (word === this.currentWord && WORDS.length > 1);
    this.currentWord = word;
    this.wordAge = 0;
  }

  private spawnParticles(cx: number, cy: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 60 + Math.random() * 100;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 500 + Math.random() * 400,
        maxLife: 900,
        color: ["#06b6d4", "#16c79a", "#f5a623", "#e94560"][Math.floor(Math.random() * 4)],
        size: 3 + Math.random() * 3,
      });
    }
  }
}
