import tmi from "tmi.js";
import { config } from "./config";
import { ChatCommand, ChatMessage } from "./types";

let client: tmi.Client | null = null;

export function say(message: string): void {
  if (client) {
    client.say(config.twitch.channel, message).catch((err) => {
      console.error("[chat] Failed to send message:", err);
    });
  }
}

export function startChatHandler(
  onCommand: (cmd: ChatCommand) => void,
  onMessage: (msg: ChatMessage) => void,
): void {
  const opts: tmi.Options = {
    channels: [config.twitch.channel],
    connection: {
      secure: true,
      reconnect: true,
    },
  };

  // Use authenticated connection if credentials provided
  if (config.twitch.oauthToken && config.twitch.botUsername) {
    opts.identity = {
      username: config.twitch.botUsername,
      password: config.twitch.oauthToken,
    };
  }

  client = new tmi.Client(opts);

  client.on("message", (_channel, tags, message, self) => {
    if (self) return;

    const trimmed = message.trim();
    if (!trimmed.startsWith("!")) {
      const username = tags["display-name"] || tags.username || "anonymous";
      onMessage({ username, message: trimmed });
      return;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const cmd: ChatCommand = {
      username: tags["display-name"] || tags.username || "anonymous",
      command,
      args,
    };

    console.log(`[chat] ${cmd.username}: !${cmd.command} ${args.join(" ")}`);
    onCommand(cmd);
  });

  client.on("connected", (addr, port) => {
    console.log(`[chat] Connected to ${addr}:${port}`);
    console.log(`[chat] Joined channel: ${config.twitch.channel}`);
  });

  client.on("disconnected", (reason) => {
    console.log(`[chat] Disconnected: ${reason}`);
  });

  client.connect().catch((err) => {
    console.error("[chat] Failed to connect:", err);
  });
}

export function stopChatHandler(): void {
  if (client) {
    console.log("[chat] Disconnecting...");
    client.disconnect().catch(() => {});
    client = null;
  }
}
