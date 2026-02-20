import type { CanvasRenderingContext2D } from "skia-canvas";
import { drawPanel, drawLabel } from "./hud";
import { clamp01 } from "./easing";

const MAX_MESSAGES = 5;
const MESSAGE_LIFETIME_MS = 8000;

interface ChatMessage {
  username: string;
  text: string;
  age: number;
}

export class ChatOverlay {
  private messages: ChatMessage[] = [];

  addMessage(username: string, text: string): void {
    this.messages.push({ username, text, age: 0 });
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
  }

  update(deltaMs: number): void {
    for (const msg of this.messages) {
      msg.age += deltaMs;
    }
    this.messages = this.messages.filter((m) => m.age < MESSAGE_LIFETIME_MS);
  }

  render(ctx: CanvasRenderingContext2D, _w: number, h: number): void {
    if (this.messages.length === 0) return;

    const lineHeight = 22;
    const panelW = 280;
    const panelH = 32 + this.messages.length * lineHeight;
    const px = 12;
    const py = h - panelH - 12;

    drawPanel(ctx, px, py, panelW, panelH, {
      bg: "rgba(0, 0, 0, 0.5)",
      border: "rgba(255,255,255,0.08)",
    });

    this.messages.forEach((msg, i) => {
      const fade = 1 - clamp01((msg.age - MESSAGE_LIFETIME_MS * 0.75) / (MESSAGE_LIFETIME_MS * 0.25));
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = fade;

      drawLabel(ctx, px + 10, py + 22 + i * lineHeight, `${msg.username}: ${msg.text}`, {
        font: "13px sans-serif",
        color: "#dddddd",
      });

      ctx.globalAlpha = prev;
    });
  }
}
