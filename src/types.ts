import type { CanvasRenderingContext2D } from "skia-canvas";

export interface ChatCommand {
  username: string;
  command: string;
  args: string[];
}

export interface Game {
  readonly displayName?: string;
  init(width: number, height: number): void;
  update(deltaMs: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  handleChatCommand(cmd: ChatCommand): void;
}
