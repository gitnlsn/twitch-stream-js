import { Canvas } from "skia-canvas";
import { config } from "./config";
import { Game } from "./types";
import { writeFrame } from "./stream-pipeline";

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function startGameLoop(game: Game): void {
  const { width, height, fps } = config.stream;
  const frameDurationMs = 1000 / fps;

  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  game.init(width, height);

  let lastTime = performance.now();
  running = true;

  function tick() {
    if (!running) return;

    const now = performance.now();
    const deltaMs = now - lastTime;
    lastTime = now;

    // Update game state
    game.update(deltaMs);

    // Render
    ctx.clearRect(0, 0, width, height);
    game.render(ctx);

    // Extract raw RGBA buffer and pipe to FFmpeg
    const buffer = canvas.toBufferSync("raw");
    writeFrame(buffer);

    // Schedule next frame with self-correcting timing
    const elapsed = performance.now() - now;
    const delay = Math.max(0, frameDurationMs - elapsed);
    timer = setTimeout(tick, delay);
  }

  console.log(`[loop] Starting game loop at ${fps}fps (${frameDurationMs.toFixed(1)}ms per frame)`);
  tick();
}

export function stopGameLoop(): void {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  console.log("[loop] Game loop stopped");
}
