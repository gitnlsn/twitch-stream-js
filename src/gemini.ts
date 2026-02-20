import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { config } from "./config";
import { ChatMessage } from "./types";

const MAX_HISTORY = 20;
const MAX_RESPONSE_LENGTH = 500;
const BATCH_INTERVAL_MS = 60_000;

let model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
const history: Content[] = [];
const pendingMessages: ChatMessage[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let sayCallback: ((text: string) => void) | null = null;
let getCurrentGameName: (() => string) | null = null;

export function initGemini(say: (text: string) => void, getGameName: () => string): void {
  sayCallback = say;
  getCurrentGameName = getGameName;

  if (!config.gemini.apiKey) {
    console.log("[gemini] No GEMINI_API_KEY set — conversational chat disabled");
    return;
  }

  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  console.log("[gemini] Initialized with gemini-2.5-flash-lite (batch mode, 1min interval)");
}

export function geminiCollect(msg: ChatMessage): void {
  if (!model) return;

  pendingMessages.push(msg);

  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      flushAndRespond();
    }, BATCH_INTERVAL_MS);
  }
}

async function flushAndRespond(): Promise<void> {
  batchTimer = null;

  if (pendingMessages.length === 0 || !model || !sayCallback) return;

  const summary = pendingMessages
    .map((m) => `${m.username}: ${m.message}`)
    .join("\n");

  // Add batched messages as a single user turn
  history.push({
    role: "user",
    parts: [{ text: summary }],
  });
  while (history.length > MAX_HISTORY) {
    history.shift();
  }

  pendingMessages.length = 0;

  try {
    const chat = model.startChat({
      history,
      systemInstruction: {
        role: "user",
        parts: [{
          text: `You are a chill Twitch chat bot. You see recent chat messages and chime in naturally. Keep it short, under 450 characters. No markdown. Be conversational and relaxed, not overly excited. Talk like a regular chatter, not a hype man.

The stream features interactive games that viewers can play via chat commands. Available games: Ball Game, Word Scramble, Trivia. Currently playing: ${getCurrentGameName ? getCurrentGameName() : "unknown"}. Viewers can type !skip to vote for a game change. You can reference the current game naturally if it comes up.`,
        }],
      },
    });

    const result = await chat.sendMessage(
      "Here are recent chat messages. Pick up on something interesting and respond naturally."
    );
    let text = result.response.text().trim();

    if (text.length > MAX_RESPONSE_LENGTH) {
      text = text.slice(0, MAX_RESPONSE_LENGTH - 3) + "...";
    }

    history.push({
      role: "model",
      parts: [{ text }],
    });
    while (history.length > MAX_HISTORY) {
      history.shift();
    }

    console.log(`[gemini] Batch response (${pendingMessages.length} msgs): ${text}`);
    sayCallback(text);
  } catch (err) {
    console.error("[gemini] API error:", err);
  }
}
