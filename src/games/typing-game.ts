import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";

const WORDS = [
  "stream", "twitch", "gaming", "chat", "emote", "pixel", "score",
  "combo", "turbo", "quest", "loot", "spawn", "ninja", "clutch",
  "hype", "glitch", "boost", "flame", "frost", "blade",
];

export class TypingGame implements Game {
  private width = 0;
  private height = 0;
  private currentWord = "";
  private scores: Map<string, number> = new Map();
  private lastWinner = "";

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.scores.clear();
    this.lastWinner = "";
    this.pickNewWord();
  }

  update(_deltaMs: number): void {
    // No continuous updates
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#1b1b3a";
    ctx.fillRect(0, 0, this.width, this.height);

    // HUD - Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Typing Game  |  Type !type <word> to score!", 20, 40);

    // Current word
    ctx.font = "bold 64px sans-serif";
    ctx.fillStyle = "#06b6d4";
    const metrics = ctx.measureText(this.currentWord);
    const wordX = (this.width - metrics.width) / 2;
    const wordY = this.height / 2;
    ctx.fillText(this.currentWord, wordX, wordY);

    // Last winner
    if (this.lastWinner) {
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#16c79a";
      const winText = `${this.lastWinner} got it!`;
      ctx.fillText(winText, (this.width - ctx.measureText(winText).width) / 2, wordY + 40);
    }

    // Scoreboard
    const sorted = [...this.scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length > 0) {
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#f5a623";
      ctx.fillText("Scoreboard", 20, 110);

      ctx.font = "16px sans-serif";
      sorted.forEach(([user, count], i) => {
        ctx.fillStyle = "#cccccc";
        ctx.fillText(`${i + 1}. ${user}: ${count}`, 20, 135 + i * 22);
      });
    }
  }

  handleChatCommand(cmd: ChatCommand): void {
    if (cmd.command !== "type") return;

    const guess = cmd.args[0]?.toLowerCase();
    if (guess === this.currentWord) {
      const prev = this.scores.get(cmd.username) || 0;
      this.scores.set(cmd.username, prev + 1);
      this.lastWinner = cmd.username;
      this.pickNewWord();
    }
  }

  private pickNewWord(): void {
    let word: string;
    do {
      word = WORDS[Math.floor(Math.random() * WORDS.length)];
    } while (word === this.currentWord && WORDS.length > 1);
    this.currentWord = word;
  }
}
