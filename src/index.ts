import { config } from "./config";
import { createGame } from "./games";
import { startStreamPipeline, stopStreamPipeline } from "./stream-pipeline";
import { startGameLoop, stopGameLoop } from "./game-loop";
import { startChatHandler, stopChatHandler } from "./chat-handler";

function shutdown() {
  console.log("\n[main] Shutting down...");
  stopGameLoop();
  stopChatHandler();
  stopStreamPipeline();
  console.log("[main] Goodbye!");
  process.exit(0);
}

function main() {
  console.log("[main] Twitch Stream - Interactive Game Engine");
  console.log(`[main] Game: ${config.game}`);
  console.log(`[main] Stream: ${config.stream.width}x${config.stream.height} @ ${config.stream.fps}fps`);

  if (!config.twitch.streamKey) {
    console.error("[main] Error: TWITCH_STREAM_KEY is required. See .env.example");
    process.exit(1);
  }

  if (!config.twitch.channel) {
    console.error("[main] Error: TWITCH_CHANNEL is required. See .env.example");
    process.exit(1);
  }

  // Create the game
  const game = createGame(config.game);
  console.log(`[main] Loaded game: ${config.game}`);

  // Start FFmpeg stream pipeline
  startStreamPipeline();

  // Start the game loop (renders frames and pipes to FFmpeg)
  startGameLoop(game);

  // Start chat handler (forwards commands to the game)
  startChatHandler((cmd) => {
    game.handleChatCommand(cmd);
  });

  // Graceful shutdown
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[main] All systems running. Press Ctrl+C to stop.");
}

main();
