import { Canvas } from "skia-canvas";
import { config } from "./config";
import { Game } from "./types";
import { writeFrame } from "./stream-pipeline";
import { VoteManager } from "./vote-manager";
import { TransitionOverlay } from "./ui/transition-overlay";
import { ChatOverlay } from "./ui/chat-overlay";
import { drawPanel, drawLabel } from "./ui/hud";

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let currentGame: Game;
let voteManager: VoteManager | null = null;

const transitionOverlay = new TransitionOverlay();
const chatOverlay = new ChatOverlay();

export function getChatOverlay(): ChatOverlay {
  return chatOverlay;
}

export function setVoteManager(vm: VoteManager): void {
  voteManager = vm;
}

export function swapGame(newGame: Game, displayName?: string): void {
  const { width, height } = config.stream;
  newGame.init(width, height);
  currentGame = newGame;
  if (displayName) {
    transitionOverlay.trigger(displayName);
  }
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
    chatOverlay.update(deltaMs);
    transitionOverlay.update(deltaMs);

    // Render
    ctx.clearRect(0, 0, width, height);

    // 1. Game renders its own content + top bar
    currentGame.render(ctx);

    // 2. Chat overlay — bottom-left
    chatOverlay.render(ctx, width, height);

    // 3. Vote HUD — bottom-right (styled panel)
    if (voteManager) {
      const votes = voteManager.getVoteCount();
      const needed = voteManager.getNeededVotes();
      if (votes > 0) {
        const text = `Skip: ${votes}/${needed}`;
        ctx.font = "bold 14px sans-serif";
        const metrics = ctx.measureText(text);
        const panelW = metrics.width + 24;
        const panelH = 28;
        const px = width - panelW - 12;
        const py = height - panelH - 12;

        drawPanel(ctx, px, py, panelW, panelH, {
          bg: "rgba(0, 0, 0, 0.6)",
          border: "rgba(255, 107, 107, 0.4)",
        });
        drawLabel(ctx, px + 12, py + 19, text, {
          font: "bold 14px sans-serif",
          color: "#ff6b6b",
        });
      }
    }

    // 4. Transition overlay — full-screen scrim on top
    transitionOverlay.render(ctx, width, height);

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
