import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";

const SQUARE_SIZE = 40;
const COLORS = ["#e94560", "#0f3460", "#16c79a", "#f5a623", "#8b5cf6", "#ec4899", "#06b6d4"];

export class ColorChaseGame implements Game {
  private width = 0;
  private height = 0;
  private squareX = 0;
  private squareY = 0;
  private color = COLORS[0];
  private catches: Map<string, number> = new Map();
  private lastCatcher = "";

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.catches.clear();
    this.lastCatcher = "";
    this.teleport();
  }

  update(_deltaMs: number): void {
    // No continuous movement — square only moves on catch
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, this.width, this.height);

    // Target square
    ctx.fillStyle = this.color;
    ctx.fillRect(this.squareX, this.squareY, SQUARE_SIZE, SQUARE_SIZE);

    // HUD - Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Color Chase  |  Type !catch to score!", 20, 40);

    // Last catcher
    if (this.lastCatcher) {
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#16c79a";
      ctx.fillText(`Last catch: ${this.lastCatcher}`, 20, 70);
    }

    // Leaderboard
    const sorted = [...this.catches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length > 0) {
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#f5a623";
      ctx.fillText("Leaderboard", 20, 110);

      ctx.font = "16px sans-serif";
      sorted.forEach(([user, count], i) => {
        ctx.fillStyle = "#cccccc";
        ctx.fillText(`${i + 1}. ${user}: ${count}`, 20, 135 + i * 22);
      });
    }
  }

  handleChatCommand(cmd: ChatCommand): void {
    if (cmd.command !== "catch") return;

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
}
