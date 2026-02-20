import dotenv from "dotenv";
dotenv.config();

export const config = {
  twitch: {
    streamKey: process.env.TWITCH_STREAM_KEY || "",
    channel: process.env.TWITCH_CHANNEL || "",
    oauthToken: process.env.TWITCH_OAUTH_TOKEN,
    botUsername: process.env.TWITCH_BOT_USERNAME,
  },
  stream: {
    width: parseInt(process.env.STREAM_WIDTH || "1280", 10),
    height: parseInt(process.env.STREAM_HEIGHT || "720", 10),
    fps: parseInt(process.env.STREAM_FPS || "30", 10),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  game: process.env.GAME || "ball",
};
