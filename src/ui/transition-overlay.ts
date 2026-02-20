import type { CanvasRenderingContext2D } from "skia-canvas";
import { clamp01 } from "./easing";

const FADE_IN_MS = 400;
const HOLD_MS = 1200;
const FADE_OUT_MS = 400;
const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

export class TransitionOverlay {
  private elapsed = 0;
  private active = false;
  private gameName = "";

  trigger(gameName: string): void {
    this.gameName = gameName;
    this.elapsed = 0;
    this.active = true;
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.elapsed += deltaMs;
    if (this.elapsed >= TOTAL_MS) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.active) return;

    let alpha: number;
    if (this.elapsed < FADE_IN_MS) {
      alpha = clamp01(this.elapsed / FADE_IN_MS);
    } else if (this.elapsed < FADE_IN_MS + HOLD_MS) {
      alpha = 1;
    } else {
      alpha = 1 - clamp01((this.elapsed - FADE_IN_MS - HOLD_MS) / FADE_OUT_MS);
    }

    const prev = ctx.globalAlpha;
    ctx.globalAlpha = alpha;

    // Scrim
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, w, h);

    // Banner text
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("Now Playing", w / 2, h / 2 - 20);

    ctx.font = "bold 36px sans-serif";
    ctx.fillStyle = "#f5a623";
    ctx.fillText(this.gameName, w / 2, h / 2 + 30);

    ctx.textAlign = "left";
    ctx.globalAlpha = prev;
  }
}
