import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";
import { drawTopBar, drawLeaderboard, drawPanel, drawLabel } from "../ui/hud";
import { easeOut, clamp01 } from "../ui/easing";
import { TriviaQuestion, fetchQuestions } from "./trivia-api";

type Phase = "loading" | "showing" | "reveal" | "scoreboard" | "gameover";

const SHOWING_DURATION = 15_000;
const REVEAL_DURATION = 4_000;
const SCOREBOARD_DURATION = 3_000;
const FLASH_DURATION = 500;
const MAX_PARTICLES = 60;

const CARD_COLORS = ["#e94560", "#0f3460", "#16c79a", "#f5a623"];
const CARD_LETTERS = ["A", "B", "C", "D"];
const PARTICLE_COLORS = ["#06b6d4", "#16c79a", "#f5a623", "#e94560"];

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

export class TriviaGame implements Game {
  readonly displayName = "Trivia";

  private width = 0;
  private height = 0;

  private phase: Phase = "loading";
  private phaseTimer = 0;

  private questions: TriviaQuestion[] = [];
  private questionIndex = 0;

  private answers: Map<string, number> = new Map(); // username → chosen index
  private scores: Map<string, number> = new Map();
  private streaks: Map<string, number> = new Map();

  private flashTimer = 0;
  private particles: Particle[] = [];

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.phase = "loading";
    this.phaseTimer = 0;
    this.questionIndex = 0;
    this.answers = new Map();
    this.scores = new Map();
    this.streaks = new Map();
    this.flashTimer = 0;
    this.particles = [];
    this.questions = [];

    fetchQuestions(15).then((qs) => {
      this.questions = qs;
      this.startQuestion();
    });
  }

  private startQuestion(): void {
    this.answers = new Map();
    this.phase = "showing";
    this.phaseTimer = 0;
  }

  private get currentQuestion(): TriviaQuestion | undefined {
    return this.questions[this.questionIndex];
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
      this.endRound();
    } else if (this.phase === "reveal" && this.phaseTimer >= REVEAL_DURATION) {
      this.phase = "scoreboard";
      this.phaseTimer = 0;
    } else if (
      this.phase === "scoreboard" &&
      this.phaseTimer >= SCOREBOARD_DURATION
    ) {
      this.questionIndex++;
      if (this.questionIndex >= this.questions.length) {
        this.phase = "gameover";
        this.phaseTimer = 0;
      } else {
        this.startQuestion();
      }
    }
  }

  private endRound(): void {
    const q = this.currentQuestion;
    if (!q) return;

    let anyCorrect = false;
    for (const [user, choice] of this.answers) {
      if (choice === q.correctIndex) {
        const streak = (this.streaks.get(user) ?? 0) + 1;
        this.streaks.set(user, streak);
        const bonus = Math.min((streak - 1) * 50, 250);
        const points = 100 + bonus;
        this.scores.set(user, (this.scores.get(user) ?? 0) + points);
        anyCorrect = true;
      } else {
        this.streaks.set(user, 0);
      }
    }

    if (anyCorrect) {
      this.flashTimer = FLASH_DURATION;
      this.spawnParticles(this.width / 2, this.height / 2);
    }

    this.phase = "reveal";
    this.phaseTimer = 0;
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

    // HUD top bar
    drawTopBar(ctx, this.width, "Trivia", "!a  !b  !c  !d");

    if (this.phase === "loading") {
      this.renderLoading(ctx);
    } else if (this.phase === "gameover") {
      this.renderGameOver(ctx);
    } else {
      this.renderQuestion(ctx);
    }
  }

  private renderLoading(ctx: CanvasRenderingContext2D): void {
    drawLabel(ctx, this.width / 2, this.height / 2, "Loading questions...", {
      font: "bold 28px sans-serif",
      color: "#aaaaaa",
      align: "center",
    });
  }

  private renderQuestion(ctx: CanvasRenderingContext2D): void {
    const q = this.currentQuestion;
    if (!q) return;

    const leftMargin = 30;
    const contentWidth = this.width - 280; // leave room for leaderboard

    // Category + difficulty + counter
    const diffColor =
      q.difficulty === "easy"
        ? "#16c79a"
        : q.difficulty === "medium"
          ? "#f5a623"
          : "#e94560";
    drawLabel(ctx, leftMargin, 80, q.category, {
      font: "bold 14px sans-serif",
      color: "#8b5cf6",
    });
    drawLabel(ctx, leftMargin + ctx.measureText(q.category).width + 16, 80, q.difficulty.toUpperCase(), {
      font: "bold 12px sans-serif",
      color: diffColor,
    });
    drawLabel(
      ctx,
      leftMargin + contentWidth,
      80,
      `${this.questionIndex + 1} / ${this.questions.length}`,
      { font: "14px sans-serif", color: "#aaaaaa", align: "right" },
    );

    // Question text with word-wrap
    ctx.font = "bold 22px sans-serif";
    const lines = this.wrapText(ctx, q.question, contentWidth - 20);
    drawPanel(ctx, leftMargin - 10, 90, contentWidth + 10, 20 + lines.length * 28, {
      bg: "rgba(0,0,0,0.4)",
      border: "rgba(255,255,255,0.08)",
    });
    for (let i = 0; i < lines.length; i++) {
      drawLabel(ctx, leftMargin, 112 + i * 28, lines[i], {
        font: "bold 22px sans-serif",
        color: "#ffffff",
      });
    }

    const questionBottomY = 112 + lines.length * 28 + 10;

    // Timer bar (showing phase only)
    if (this.phase === "showing") {
      const timerY = questionBottomY;
      const progress = clamp01(1 - this.phaseTimer / SHOWING_DURATION);
      const barW = contentWidth * progress;
      const timerColor =
        progress > 0.5 ? "#16c79a" : progress > 0.25 ? "#f5a623" : "#e94560";
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(leftMargin, timerY, contentWidth, 8);
      ctx.fillStyle = timerColor;
      ctx.fillRect(leftMargin, timerY, barW, 8);
    }

    // 2x2 answer cards
    const gridY = questionBottomY + 25;
    const cardW = (contentWidth - 15) / 2;
    const cardH = 70;
    const gap = 15;

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = leftMargin + col * (cardW + gap);
      const cy = gridY + row * (cardH + gap);

      let cardBg = "rgba(0,0,0,0.45)";
      let border = "rgba(255,255,255,0.12)";

      if (this.phase === "reveal") {
        if (i === q.correctIndex) {
          cardBg = "rgba(22,199,154,0.35)";
          border = "#16c79a";
        } else {
          cardBg = "rgba(233,69,96,0.2)";
          border = "rgba(233,69,96,0.5)";
        }
      }

      drawPanel(ctx, cx, cy, cardW, cardH, {
        bg: cardBg,
        border,
        borderWidth: 2,
        radius: 10,
      });

      // Letter badge
      const badgeR = 16;
      const badgeX = cx + 22;
      const badgeY = cy + cardH / 2;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = CARD_COLORS[i];
      ctx.fill();
      drawLabel(ctx, badgeX, badgeY + 6, CARD_LETTERS[i], {
        font: "bold 16px sans-serif",
        color: "#ffffff",
        align: "center",
      });

      // Answer text (truncate if needed)
      const answerText = this.truncateText(
        ctx,
        q.options[i],
        cardW - 60,
        "18px sans-serif",
      );
      drawLabel(ctx, cx + 48, cy + cardH / 2 + 6, answerText, {
        font: "18px sans-serif",
        color: "#ffffff",
      });

      // Answer count badge during reveal
      if (this.phase === "reveal") {
        const count = this.countAnswers(i);
        if (count > 0) {
          drawLabel(ctx, cx + cardW - 12, cy + cardH / 2 + 6, `${count}`, {
            font: "bold 14px sans-serif",
            color: "#aaaaaa",
            align: "right",
          });
        }
      }
    }

    // Reveal info
    if (this.phase === "reveal") {
      const infoY = gridY + 2 * (cardH + gap) + 10;
      const correctUsers = this.getCorrectUsers();
      const text =
        this.answers.size === 0
          ? "No one answered!"
          : correctUsers.length === 0
            ? "No one got it right!"
            : `Correct: ${correctUsers.slice(0, 8).join(", ")}${correctUsers.length > 8 ? ` +${correctUsers.length - 8}` : ""}`;
      drawLabel(ctx, leftMargin, infoY, text, {
        font: "bold 16px sans-serif",
        color: correctUsers.length > 0 ? "#16c79a" : "#e94560",
      });

      // Distribution bar chart
      this.renderDistribution(ctx, leftMargin, infoY + 15, contentWidth, 20);
    }

    // Leaderboard (right side)
    const sorted = [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({ name, score }));
    drawLeaderboard(ctx, this.width - 240, 60, "Leaderboard", sorted, 8);

    // Scoreboard overlay
    if (this.phase === "scoreboard") {
      this.renderScoreboard(ctx);
    }
  }

  private renderDistribution(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const total = this.answers.size;
    if (total === 0) return;

    const counts = [0, 1, 2, 3].map((i) => this.countAnswers(i));
    let cx = x;

    for (let i = 0; i < 4; i++) {
      const frac = counts[i] / total;
      const barW = Math.max(frac > 0 ? 2 : 0, w * frac);
      ctx.fillStyle = CARD_COLORS[i];
      ctx.globalAlpha = 0.7;
      ctx.fillRect(cx, y, barW, h);
      cx += barW;
    }
    ctx.globalAlpha = 1;
  }

  private renderScoreboard(ctx: CanvasRenderingContext2D): void {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, this.width, this.height);

    const panelW = 400;
    const panelX = (this.width - panelW) / 2;
    const panelY = 80;

    const sorted = [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const panelH = 80 + sorted.length * 32;

    drawPanel(ctx, panelX, panelY, panelW, panelH, {
      bg: "rgba(20,20,50,0.95)",
      border: "#f5a623",
      borderWidth: 2,
      radius: 12,
    });

    drawLabel(ctx, this.width / 2, panelY + 35, "Standings", {
      font: "bold 24px sans-serif",
      color: "#f5a623",
      align: "center",
    });

    sorted.forEach(([name, score], i) => {
      const rowY = panelY + 65 + i * 32;
      const streak = this.streaks.get(name) ?? 0;
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      const streakText = streak >= 2 ? ` (${streak}x streak)` : "";

      drawLabel(ctx, panelX + 20, rowY, `${medal} ${name}`, {
        font: "bold 16px sans-serif",
        color: i < 3 ? "#ffffff" : "#cccccc",
      });
      drawLabel(ctx, panelX + panelW - 20, rowY, `${score}${streakText}`, {
        font: "14px sans-serif",
        color: "#f5a623",
        align: "right",
      });
    });
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
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

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

  handleChatCommand(cmd: ChatCommand): void {
    if (this.phase !== "showing") return;

    const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
    const choice = letterMap[cmd.command];
    if (choice === undefined) return;

    // Only first answer per user per round
    if (this.answers.has(cmd.username)) return;

    this.answers.set(cmd.username, choice);
  }

  // --- Helpers ---

  private countAnswers(index: number): number {
    let count = 0;
    for (const choice of this.answers.values()) {
      if (choice === index) count++;
    }
    return count;
  }

  private getCorrectUsers(): string[] {
    const q = this.currentQuestion;
    if (!q) return [];
    const users: string[] = [];
    for (const [user, choice] of this.answers) {
      if (choice === q.correctIndex) users.push(user);
    }
    return users;
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);

    // Limit to 3 lines max, truncate last line with ellipsis if needed
    if (lines.length > 3) {
      lines.length = 3;
      lines[2] = lines[2].slice(0, -3) + "...";
    }
    return lines;
  }

  private truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    font: string,
  ): string {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
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
