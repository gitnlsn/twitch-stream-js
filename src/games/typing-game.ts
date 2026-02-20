import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";
import { drawTopBar, drawLeaderboard, drawPanel, drawLabel } from "../ui/hud";
import { easeOut, clamp01 } from "../ui/easing";
import { fetchWords, scrambleWord } from "./word-api";

type Phase = "loading" | "showing" | "reveal" | "gameover";

const SHOWING_DURATION = 20_000;
const REVEAL_DURATION = 3_000;
const HINT1_TIME = 10_000; // first letter hint at 10s remaining
const HINT2_TIME = 5_000; // last letter hint at 5s remaining
const FLASH_DURATION = 500;
const TILE_POP_DURATION = 400;
const MAX_PARTICLES = 60;

const PARTICLE_COLORS = ["#06b6d4", "#16c79a", "#f5a623", "#e94560"];
const TILE_BG = "rgba(6, 182, 212, 0.25)";
const TILE_BORDER = "#06b6d4";

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

export class ScrambleGame implements Game {
  readonly displayName = "Word Scramble";

  private width = 0;
  private height = 0;

  private phase: Phase = "loading";
  private phaseTimer = 0;

  private words: string[] = [];
  private wordIndex = 0;
  private currentWord = "";
  private scrambled = "";
  private winner = "";

  private scores: Map<string, number> = new Map();
  private streaks: Map<string, number> = new Map();

  private flashTimer = 0;
  private particles: Particle[] = [];

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.phase = "loading";
    this.phaseTimer = 0;
    this.wordIndex = 0;
    this.currentWord = "";
    this.scrambled = "";
    this.winner = "";
    this.scores = new Map();
    this.streaks = new Map();
    this.flashTimer = 0;
    this.particles = [];
    this.words = [];

    fetchWords(50).then((ws) => {
      this.words = ws;
      this.startWord();
    });
  }

  private startWord(): void {
    const word = this.words[this.wordIndex];
    if (!word) {
      this.phase = "gameover";
      this.phaseTimer = 0;
      return;
    }
    this.currentWord = word;
    this.scrambled = scrambleWord(word);
    this.winner = "";
    this.phase = "showing";
    this.phaseTimer = 0;
  }

  update(deltaMs: number): void {
    this.phaseTimer += deltaMs;

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

    // Phase transitions
    if (this.phase === "showing" && this.phaseTimer >= SHOWING_DURATION) {
      this.phase = "reveal";
      this.phaseTimer = 0;
    } else if (this.phase === "reveal" && this.phaseTimer >= REVEAL_DURATION) {
      this.wordIndex++;
      if (this.wordIndex >= this.words.length) {
        this.phase = "gameover";
        this.phaseTimer = 0;
      } else {
        this.startWord();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#1b1b3a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Flash overlay
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

    // HUD
    drawTopBar(ctx, this.width, "Word Scramble", "!guess <word>");

    if (this.phase === "loading") {
      this.renderLoading(ctx);
    } else if (this.phase === "gameover") {
      this.renderGameOver(ctx);
    } else if (this.phase === "reveal") {
      this.renderReveal(ctx);
    } else {
      this.renderShowing(ctx);
    }
  }

  private renderLoading(ctx: CanvasRenderingContext2D): void {
    drawLabel(ctx, this.width / 2, this.height / 2, "Loading words...", {
      font: "bold 28px sans-serif",
      color: "#aaaaaa",
      align: "center",
    });
  }

  private renderShowing(ctx: CanvasRenderingContext2D): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2 - 20;

    // Word counter
    drawLabel(
      ctx,
      this.width - 260,
      80,
      `${this.wordIndex + 1} / ${this.words.length}`,
      { font: "14px sans-serif", color: "#aaaaaa", align: "right" },
    );

    // Scrambled letter tiles
    this.renderTiles(ctx, this.scrambled, centerX, centerY);

    // Hint row
    const remaining = SHOWING_DURATION - this.phaseTimer;
    const hint = this.buildHint(remaining);
    if (hint) {
      drawLabel(ctx, centerX, centerY + 70, hint, {
        font: "bold 24px monospace",
        color: "#f5a623",
        align: "center",
      });
    }

    // Timer bar
    const timerY = centerY + 100;
    const barWidth = this.width - 520;
    const barX = centerX - barWidth / 2;
    const progress = clamp01(1 - this.phaseTimer / SHOWING_DURATION);
    const timerColor =
      progress > 0.5 ? "#16c79a" : progress > 0.25 ? "#f5a623" : "#e94560";
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, timerY, barWidth, 8);
    ctx.fillStyle = timerColor;
    ctx.fillRect(barX, timerY, barWidth * progress, 8);

    // Timer text
    const secondsLeft = Math.ceil(remaining / 1000);
    drawLabel(ctx, centerX, timerY + 30, `${secondsLeft}s`, {
      font: "bold 16px sans-serif",
      color: timerColor,
      align: "center",
    });

    // Winner message
    if (this.winner) {
      drawLabel(
        ctx,
        centerX,
        centerY - 70,
        `${this.winner} got it!`,
        { font: "bold 20px sans-serif", color: "#16c79a", align: "center" },
      );
    }

    // Leaderboard
    this.renderLeaderboard(ctx);
  }

  private renderTiles(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
  ): void {
    const tileSize = 52;
    const gap = 8;
    const totalW = text.length * (tileSize + gap) - gap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < text.length; i++) {
      const tileX = startX + i * (tileSize + gap);
      const tileY = cy - tileSize / 2;

      // Pop-in animation per tile (staggered)
      const delay = i * 60;
      const popT = clamp01((this.phaseTimer - delay) / TILE_POP_DURATION);
      const scale = easeOut(popT);

      ctx.save();
      ctx.translate(tileX + tileSize / 2, tileY + tileSize / 2);
      ctx.scale(scale, scale);

      // Tile background
      drawPanel(ctx, -tileSize / 2, -tileSize / 2, tileSize, tileSize, {
        bg: TILE_BG,
        border: TILE_BORDER,
        borderWidth: 2,
        radius: 8,
      });

      // Letter
      drawLabel(ctx, 0, 8, text[i].toUpperCase(), {
        font: "bold 32px sans-serif",
        color: "#ffffff",
        align: "center",
      });

      ctx.restore();
    }
  }

  private buildHint(remainingMs: number): string | null {
    if (remainingMs > HINT1_TIME) return null;

    const letters = this.currentWord.split("");
    const display = letters.map(() => "_");

    // First letter hint
    display[0] = letters[0].toUpperCase();

    // Last letter hint at 5s
    if (remainingMs <= HINT2_TIME && letters.length > 1) {
      display[display.length - 1] = letters[letters.length - 1].toUpperCase();
    }

    return display.join(" ");
  }

  private renderReveal(ctx: CanvasRenderingContext2D): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2 - 20;

    // Show the answer as tiles
    this.renderTiles(ctx, this.currentWord, centerX, centerY);

    // Reveal message
    const msg = this.winner
      ? `${this.winner} got it!`
      : "No one got it!";
    const color = this.winner ? "#16c79a" : "#e94560";
    drawLabel(ctx, centerX, centerY + 60, msg, {
      font: "bold 22px sans-serif",
      color,
      align: "center",
    });

    drawLabel(ctx, centerX, centerY + 90, `The word was: ${this.currentWord}`, {
      font: "18px sans-serif",
      color: "#aaaaaa",
      align: "center",
    });

    this.renderLeaderboard(ctx);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    drawLabel(ctx, this.width / 2, 100, "Game Over!", {
      font: "bold 40px sans-serif",
      color: "#f5a623",
      align: "center",
    });

    drawLabel(ctx, this.width / 2, 140, "Use !skip to play another game", {
      font: "16px sans-serif",
      color: "#aaaaaa",
      align: "center",
    });

    if (sorted.length === 0) {
      drawLabel(ctx, this.width / 2, 220, "No one played!", {
        font: "bold 22px sans-serif",
        color: "#aaaaaa",
        align: "center",
      });
      return;
    }

    const panelW = 420;
    const panelX = (this.width - panelW) / 2;
    const panelY = 170;
    const panelH = 50 + sorted.length * 34;

    drawPanel(ctx, panelX, panelY, panelW, panelH, {
      bg: "rgba(0,0,0,0.5)",
      border: "rgba(255,255,255,0.1)",
      radius: 12,
    });

    drawLabel(ctx, this.width / 2, panelY + 30, "Final Standings", {
      font: "bold 20px sans-serif",
      color: "#f5a623",
      align: "center",
    });

    sorted.forEach(([name, score], i) => {
      const rowY = panelY + 60 + i * 34;
      const medal =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

      drawLabel(ctx, panelX + 24, rowY, `${medal} ${name}`, {
        font: "bold 18px sans-serif",
        color: i < 3 ? "#ffffff" : "#cccccc",
      });
      drawLabel(ctx, panelX + panelW - 24, rowY, `${score} pts`, {
        font: "16px sans-serif",
        color: "#f5a623",
        align: "right",
      });
    });
  }

  private renderLeaderboard(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({ name, score }));
    drawLeaderboard(ctx, this.width - 240, 60, "Leaderboard", sorted, 8);
  }

  handleChatCommand(cmd: ChatCommand): void {
    if (cmd.command !== "guess") return;
    if (this.phase !== "showing") return;

    const guess = cmd.args[0]?.toLowerCase();
    if (!guess || guess !== this.currentWord) return;

    const remainingMs = Math.max(0, SHOWING_DURATION - this.phaseTimer);

    // Scoring: 100 base + time bonus + streak bonus
    const streak = (this.streaks.get(cmd.username) ?? 0) + 1;
    this.streaks.set(cmd.username, streak);
    const timeBonus = Math.floor(remainingMs / 200);
    const streakBonus = Math.min((streak - 1) * 25, 100);
    const points = 100 + timeBonus + streakBonus;

    this.scores.set(
      cmd.username,
      (this.scores.get(cmd.username) ?? 0) + points,
    );
    this.winner = cmd.username;

    // Effects
    this.flashTimer = FLASH_DURATION;
    this.spawnParticles(this.width / 2, this.height / 2);

    // Immediately go to reveal
    this.phase = "reveal";
    this.phaseTimer = 0;
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
        color: PARTICLE_COLORS[Math.floor(Math.random() * 4)],
        size: 3 + Math.random() * 3,
      });
    }
  }
}
