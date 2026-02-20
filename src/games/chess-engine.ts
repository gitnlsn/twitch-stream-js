import { Chess, type Move, type Square, type PieceSymbol, type Color } from "chess.js";
import { fork, type ChildProcess } from "child_process";

export interface ChessPiece {
  type: PieceSymbol;
  color: Color;
}

export class ChessEngine {
  private chess: Chess;
  private sfProcess: ChildProcess | null = null;
  private ready = false;
  private outputBuffer = "";
  private moveResolve: ((move: string) => void) | null = null;

  constructor() {
    this.chess = new Chess();
  }

  async init(): Promise<void> {
    const sfPath = require.resolve("stockfish/bin/stockfish.js");
    this.sfProcess = fork(sfPath, [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      silent: true,
    });

    this.sfProcess.stdout?.on("data", (data: Buffer) => {
      this.handleOutput(data.toString());
    });

    this.sfProcess.stderr?.on("data", () => {
      // ignore stderr
    });

    await this.sendAndWait("uci", "uciok");
    this.sendCommand("setoption name Skill Level value 10");
    await this.sendAndWait("isready", "readyok");
    this.ready = true;
  }

  private sendCommand(cmd: string): void {
    this.sfProcess?.stdin?.write(cmd + "\n");
  }

  private handleOutput(data: string): void {
    this.outputBuffer += data;
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (this.moveResolve && trimmed.startsWith("bestmove")) {
        const parts = trimmed.split(" ");
        const resolve = this.moveResolve;
        this.moveResolve = null;
        resolve(parts[1]);
      }
    }
  }

  private sendAndWait(cmd: string, waitFor: string): Promise<void> {
    return new Promise((resolve) => {
      const handler = (data: Buffer) => {
        if (data.toString().includes(waitFor)) {
          this.sfProcess?.stdout?.off("data", handler);
          resolve();
        }
      };
      this.sfProcess?.stdout?.on("data", handler);
      this.sendCommand(cmd);
    });
  }

  tryMove(from: string, to: string, promotion?: string): Move | null {
    try {
      return this.chess.move({
        from: from as Square,
        to: to as Square,
        promotion: (promotion ?? "q") as PieceSymbol,
      });
    } catch {
      return null;
    }
  }

  async getEngineMove(): Promise<Move | null> {
    if (!this.ready || !this.sfProcess) return null;

    const fen = this.chess.fen();
    this.sendCommand(`position fen ${fen}`);

    const bestmove = await new Promise<string>((resolve) => {
      this.moveResolve = resolve;
      this.sendCommand("go depth 5");
    });

    if (!bestmove || bestmove === "(none)") return null;

    const from = bestmove.slice(0, 2);
    const to = bestmove.slice(2, 4);
    const promotion = bestmove.length > 4 ? bestmove[4] : undefined;

    return this.tryMove(from, to, promotion);
  }

  get fen(): string {
    return this.chess.fen();
  }

  board(): (ChessPiece | null)[][] {
    return this.chess.board().map((row) =>
      row.map((sq) => (sq ? { type: sq.type, color: sq.color } : null)),
    );
  }

  get isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  get isCheck(): boolean {
    return this.chess.isCheck();
  }

  get isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  get isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  get isDraw(): boolean {
    return this.chess.isDraw();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  get moveHistory(): Move[] {
    return this.chess.history({ verbose: true });
  }

  getCapturedPieces(): { white: PieceSymbol[]; black: PieceSymbol[] } {
    const white: PieceSymbol[] = [];
    const black: PieceSymbol[] = [];
    for (const move of this.moveHistory) {
      if (move.captured) {
        if (move.color === "w") {
          white.push(move.captured);
        } else {
          black.push(move.captured);
        }
      }
    }
    return { white, black };
  }

  destroy(): void {
    if (this.sfProcess) {
      try {
        this.sfProcess.stdin?.write("quit\n");
      } catch {
        // ignore
      }
      this.sfProcess.kill();
      this.sfProcess = null;
    }
    this.ready = false;
  }
}
