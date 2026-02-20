import { Canvas } from "skia-canvas";
import { config } from "./config";
import { Game } from "./types";
import { writeFrame } from "./stream-pipeline";
import { VoteManager } from "./vote-manager";

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let currentGame: Game;
let voteManager: VoteManager | null = null;

export function setVoteManager(vm: VoteManager): void {
  voteManager = vm;
}

export function swapGame(newGame: Game): void {
  const { width, height } = config.stream;
  newGame.init(width, height);
  currentGame = newGame;
}

export function getCurrentGame(): Game {
  return currentGame;
}

export function startGameLoop(game: Game): void {
  const { width, height, fps } = config.stream;
  const frameDurationMs = 1000 / fps;

  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  game.init(width, height);
  currentGame = game;

  let lastTime = performance.now();
  running = true;

  function tick() {
    if (!running) return;

    const now = performance.now();
    const deltaMs = now - lastTime;
    lastTime = now;

    // Update game state
    currentGame.update(deltaMs);

    // Render
    ctx.clearRect(0, 0, width, height);
    currentGame.render(ctx);

    // Vote HUD overlay
    if (voteManager) {
      const votes = voteManager.getVoteCount();
      const needed = voteManager.getNeededVotes();
      if (votes > 0) {
        const text = `Skip votes: ${votes}/${needed} (60% needed)`;
        ctx.font = "bold 16px sans-serif";
        const metrics = ctx.measureText(text);
        const px = width - metrics.width - 16;
        const py = height - 16;

        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(px - 8, py - 16, metrics.width + 16, 24);

        ctx.fillStyle = "#ff6b6b";
        ctx.fillText(text, px, py);
      }
    }

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
