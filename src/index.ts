import { config } from "./config";
import { createGame, getRandomGame, getDisplayName } from "./games";
import { startStreamPipeline, stopStreamPipeline } from "./stream-pipeline";
import { startGameLoop, stopGameLoop, swapGame, setVoteManager, getCurrentGame, getChatOverlay } from "./game-loop";
import { startChatHandler, stopChatHandler } from "./chat-handler";
import { VoteManager } from "./vote-manager";

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
  let currentGameName = config.game;
  const initialGame = createGame(currentGameName);
  console.log(`[main] Loaded game: ${currentGameName}`);

  // Set up vote manager
  const voteManager = new VoteManager();
  const chatOverlay = getChatOverlay();

  // Start FFmpeg stream pipeline
  startStreamPipeline();

  // Start the game loop (renders frames and pipes to FFmpeg)
  setVoteManager(voteManager);
  startGameLoop(initialGame);

  // Start chat handler (forwards commands to the game)
  startChatHandler((cmd) => {
    // Track activity for every command
    voteManager.recordActivity(cmd.username);

    // Feed every command to chat overlay
    chatOverlay.addMessage(cmd.username, `!${cmd.command}${cmd.args.length ? " " + cmd.args.join(" ") : ""}`);

    // Handle !skip votes
    if (cmd.command === "skip") {
      const result = voteManager.recordSkipVote(cmd.username);
      console.log(`[vote] ${cmd.username} voted to skip (${result.votes}/${result.needed})`);

      if (result.triggered) {
        const { name, game: newGame } = getRandomGame(currentGameName);
        const displayName = getDisplayName(name);
        swapGame(newGame, displayName);
        voteManager.reset();
        console.log(`[vote] Threshold reached! Switching game: ${currentGameName} -> ${name}`);
        currentGameName = name;
      }
      return;
    }

    // Forward other commands to the current game
    getCurrentGame().handleChatCommand(cmd);
  });

  // Graceful shutdown
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[main] All systems running. Press Ctrl+C to stop.");
}

main();
