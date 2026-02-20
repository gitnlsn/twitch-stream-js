import type { CanvasRenderingContext2D } from "skia-canvas";

interface PanelOptions {
  bg?: string;
  border?: string;
  borderWidth?: number;
  radius?: number;
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PanelOptions = {},
): void {
  const { bg = "rgba(0, 0, 0, 0.55)", border, borderWidth = 1, radius = 8 } = options;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = bg;
  ctx.fill();

  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }
}

interface LabelOptions {
  font?: string;
  color?: string;
  align?: "left" | "right" | "center" | "start" | "end";
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  options: LabelOptions = {},
): void {
  const { font = "16px sans-serif", color = "#ffffff", align = "left" } = options;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left"; // reset
}

interface LeaderboardEntry {
  name: string;
  score: number;
}

export function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  entries: LeaderboardEntry[],
  maxEntries = 5,
): void {
  const visible = entries.slice(0, maxEntries);
  if (visible.length === 0) return;

  const lineHeight = 24;
  const panelH = 36 + visible.length * lineHeight + 8;
  const panelW = 220;

  drawPanel(ctx, x, y, panelW, panelH, { border: "rgba(255,255,255,0.1)" });

  drawLabel(ctx, x + 12, y + 24, title, {
    font: "bold 16px sans-serif",
    color: "#f5a623",
  });

  visible.forEach((entry, i) => {
    drawLabel(ctx, x + 12, y + 48 + i * lineHeight, `${i + 1}. ${entry.name}: ${entry.score}`, {
      font: "14px sans-serif",
      color: "#cccccc",
    });
  });
}

export function drawTopBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  gameName: string,
  instructions: string,
): void {
  drawPanel(ctx, 0, 0, width, 50, {
    bg: "rgba(0, 0, 0, 0.65)",
    radius: 0,
  });

  drawLabel(ctx, 16, 32, gameName, {
    font: "bold 20px sans-serif",
    color: "#ffffff",
  });

  drawLabel(ctx, width - 16, 32, instructions, {
    font: "14px sans-serif",
    color: "#aaaaaa",
    align: "right",
  });
}
