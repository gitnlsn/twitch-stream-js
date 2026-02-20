import { ChildProcess, spawn } from "child_process";
import path from "path";
import { config } from "./config";

let ffmpegProcess: ChildProcess | null = null;

export function startStreamPipeline(): ChildProcess {
  const ffmpegPath = require("ffmpeg-static") as string;
  const { width, height, fps } = config.stream;
  const rtmpUrl = `rtmp://live.twitch.tv/app/${config.twitch.streamKey}`;

  const args = [
    // Input: raw RGBA frames from stdin
    "-f", "rawvideo",
    "-pixel_format", "rgba",
    "-video_size", `${width}x${height}`,
    "-framerate", `${fps}`,
    "-i", "pipe:0",

    // Video encoding
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-g", `${fps * 2}`,

    // Output format
    "-f", "flv",
    rtmpUrl,
  ];

  console.log(`[stream] Starting FFmpeg: ${ffmpegPath}`);
  console.log(`[stream] Resolution: ${width}x${height} @ ${fps}fps`);

  ffmpegProcess = spawn(ffmpegPath, args, {
    stdio: ["pipe", "ignore", "pipe"],
  });

  ffmpegProcess.stderr!.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      console.log(`[ffmpeg] ${line}`);
    }
  });

  ffmpegProcess.on("close", (code) => {
    console.log(`[stream] FFmpeg exited with code ${code}`);
    ffmpegProcess = null;
  });

  ffmpegProcess.on("error", (err) => {
    console.error(`[stream] FFmpeg error:`, err.message);
  });

  return ffmpegProcess;
}

export function writeFrame(frameBuffer: Buffer): boolean {
  if (!ffmpegProcess || !ffmpegProcess.stdin || ffmpegProcess.stdin.destroyed) {
    return false;
  }
  return ffmpegProcess.stdin.write(frameBuffer);
}

export function stopStreamPipeline(): void {
  if (ffmpegProcess) {
    console.log("[stream] Stopping FFmpeg...");
    ffmpegProcess.stdin?.end();
    ffmpegProcess.kill("SIGTERM");
    ffmpegProcess = null;
  }
}
