import type { CanvasRenderingContext2D } from "skia-canvas";
import { Game, ChatCommand } from "../types";
import { drawTopBar, drawLeaderboard, drawPanel, drawLabel } from "../ui/hud";
import { lerp, clamp01, easeOut } from "../ui/easing";
import { ChessEngine, type ChessPiece } from "./chess-engine";
import type { Move, PieceSymbol } from "chess.js";

type Phase =
  | "loading"
  | "white_turn"
  | "white_moving"
  | "engine_thinking"
  | "black_moving"
  | "gameover";

const ANIM_DURATION = 500;
const SQ = 65;
const BOARD_X = 30;
const BOARD_Y = 70;
const BOARD_SIZE = SQ * 8; // 520
const PANEL_X = 580;

const CREAM = "#f0d9b5";
const GREEN = "#769656";
const HIGHLIGHT = "rgba(255, 255, 100, 0.45)";
const CHECK_HIGHLIGHT = "rgba(255, 50, 50, 0.55)";

const PIECE_CHARS: Record<string, Record<string, string>> = {
  w: { k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P" },
  b: { k: "k", q: "q", r: "r", b: "b", n: "n", p: "p" },
};

const PIECE_DISPLAY: Record<string, string> = {
  K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659",
  k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F",
};

interface AnimState {
  piece: ChessPiece;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  elapsed: number;
}

export class ChessGame implements Game {
  readonly displayName = "Chess vs Stockfish";

  private width = 0;
  private height = 0;
  private engine!: ChessEngine;

  private phase: Phase = "loading";
  private phaseTimer = 0;

  private lastMove: Move | null = null;
  private lastMoveBy = "";
  private anim: AnimState | null = null;

  private contributors: Map<string, number> = new Map();

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.phase = "loading";
    this.phaseTimer = 0;
    this.lastMove = null;
    this.lastMoveBy = "";
    this.anim = null;
    this.contributors = new Map();

    this.engine = new ChessEngine();
    this.engine
      .init()
      .then(() => {
        console.log("[chess] Engine ready");
        this.phase = "white_turn";
      })
      .catch((err) => {
        console.error("[chess] Engine init failed:", err);
      });
  }

  destroy(): void {
    this.engine?.destroy();
  }

  update(deltaMs: number): void {
    this.phaseTimer += deltaMs;

    if (
      (this.phase === "white_moving" || this.phase === "black_moving") &&
      this.anim
    ) {
      this.anim.elapsed += deltaMs;
      if (this.anim.elapsed >= ANIM_DURATION) {
        this.anim = null;
        if (this.phase === "white_moving") {
          this.afterWhiteMove();
        } else {
          this.afterBlackMove();
        }
      }
    }
  }

  private afterWhiteMove(): void {
    if (this.engine.isGameOver) {
      this.phase = "gameover";
      this.phaseTimer = 0;
      return;
    }
    this.phase = "engine_thinking";
    this.phaseTimer = 0;

    this.engine
      .getEngineMove()
      .then((move) => {
        if (!move) {
          this.phase = "gameover";
          this.phaseTimer = 0;
          return;
        }
        this.lastMove = move;
        this.lastMoveBy = "Stockfish";
        this.startMoveAnim(move, "black_moving");
      })
      .catch(() => {
        this.phase = "gameover";
        this.phaseTimer = 0;
      });
  }

  private afterBlackMove(): void {
    if (this.engine.isGameOver) {
      this.phase = "gameover";
      this.phaseTimer = 0;
      return;
    }
    this.phase = "white_turn";
    this.phaseTimer = 0;
  }

  private startMoveAnim(move: Move, phase: Phase): void {
    const fromCol = move.from.charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(move.from[1]);
    const toCol = move.to.charCodeAt(0) - 97;
    const toRow = 8 - parseInt(move.to[1]);

    this.anim = {
      piece: { type: move.piece, color: move.color },
      fromCol,
      fromRow,
      toCol,
      toRow,
      elapsed: 0,
    };
    this.phase = phase as Phase;
    this.phaseTimer = 0;
  }

  handleChatCommand(cmd: ChatCommand): void {
    if (cmd.command !== "move") return;
    if (this.phase !== "white_turn") return;

    const parsed = this.parseMove(cmd.args);
    if (!parsed) return;

    const { from, to, promotion } = parsed;
    const move = this.engine.tryMove(from, to, promotion);
    if (!move) return;

    this.lastMove = move;
    this.lastMoveBy = cmd.username;
    this.contributors.set(
      cmd.username,
      (this.contributors.get(cmd.username) ?? 0) + 1,
    );

    this.startMoveAnim(move, "white_moving");
  }

  private parseMove(
    args: string[],
  ): { from: string; to: string; promotion?: string } | null {
    const joined = args.join("").toLowerCase().replace(/\s/g, "");
    // e2e4 or e7e8q
    const match = joined.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!match) return null;
    return {
      from: match[1],
      to: match[2],
      promotion: match[3],
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#1b1b3a";
    ctx.fillRect(0, 0, this.width, this.height);

    drawTopBar(ctx, this.width, "Chess vs Stockfish", "!move e2e4");

    if (this.phase === "loading") {
      drawLabel(ctx, this.width / 2, this.height / 2, "Starting engine...", {
        font: "bold 28px sans-serif",
        color: "#aaaaaa",
        align: "center",
      });
      return;
    }

    this.renderBoard(ctx);
    this.renderPanel(ctx);
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    const board = this.engine.board();

    // Draw squares
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = BOARD_X + col * SQ;
        const y = BOARD_Y + row * SQ;
        ctx.fillStyle = (row + col) % 2 === 0 ? CREAM : GREEN;
        ctx.fillRect(x, y, SQ, SQ);
      }
    }

    // Last move highlight
    if (this.lastMove) {
      const fromCol = this.lastMove.from.charCodeAt(0) - 97;
      const fromRow = 8 - parseInt(this.lastMove.from[1]);
      const toCol = this.lastMove.to.charCodeAt(0) - 97;
      const toRow = 8 - parseInt(this.lastMove.to[1]);

      ctx.fillStyle = HIGHLIGHT;
      ctx.fillRect(BOARD_X + fromCol * SQ, BOARD_Y + fromRow * SQ, SQ, SQ);
      ctx.fillRect(BOARD_X + toCol * SQ, BOARD_Y + toRow * SQ, SQ, SQ);
    }

    // Check highlight
    if (this.engine.isCheck) {
      // Find the king
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.type === "k" && piece.color === this.engine.turn) {
            ctx.fillStyle = CHECK_HIGHLIGHT;
            ctx.fillRect(BOARD_X + col * SQ, BOARD_Y + row * SQ, SQ, SQ);
          }
        }
      }
    }

    // Draw pieces (skip animated piece at its origin)
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (
          this.anim &&
          col === this.anim.toCol &&
          row === this.anim.toRow
        ) {
          continue; // will draw animated
        }
        const piece = board[row][col];
        if (piece) {
          this.drawPiece(ctx, piece, BOARD_X + col * SQ, BOARD_Y + row * SQ);
        }
      }
    }

    // Draw animated piece
    if (this.anim) {
      const t = easeOut(clamp01(this.anim.elapsed / ANIM_DURATION));
      const x = lerp(
        BOARD_X + this.anim.fromCol * SQ,
        BOARD_X + this.anim.toCol * SQ,
        t,
      );
      const y = lerp(
        BOARD_Y + this.anim.fromRow * SQ,
        BOARD_Y + this.anim.toRow * SQ,
        t,
      );
      this.drawPiece(ctx, this.anim.piece, x, y);
    }

    // Coordinates
    ctx.font = "bold 11px sans-serif";
    for (let i = 0; i < 8; i++) {
      // file labels (a-h)
      ctx.fillStyle = i % 2 === 0 ? GREEN : CREAM;
      ctx.textAlign = "center";
      ctx.fillText(
        String.fromCharCode(97 + i),
        BOARD_X + i * SQ + SQ / 2,
        BOARD_Y + BOARD_SIZE + 14,
      );
      // rank labels (8-1)
      ctx.fillStyle = i % 2 === 0 ? CREAM : GREEN;
      ctx.textAlign = "right";
      ctx.fillText(
        String(8 - i),
        BOARD_X - 6,
        BOARD_Y + i * SQ + SQ / 2 + 4,
      );
    }
    ctx.textAlign = "left";
  }

  private drawPiece(
    ctx: CanvasRenderingContext2D,
    piece: ChessPiece,
    x: number,
    y: number,
  ): void {
    const key = PIECE_CHARS[piece.color][piece.type];
    const ch = PIECE_DISPLAY[key];
    if (ch) {
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw outline for visibility
      ctx.fillStyle = piece.color === "w" ? "#000000" : "#000000";
      ctx.fillText(ch, x + SQ / 2 + 1, y + SQ / 2 + 1);

      ctx.fillStyle = piece.color === "w" ? "#ffffff" : "#333333";
      ctx.fillText(ch, x + SQ / 2, y + SQ / 2);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  private renderPanel(ctx: CanvasRenderingContext2D): void {
    // Status
    let status = "";
    let statusColor = "#ffffff";

    if (this.phase === "gameover") {
      if (this.engine.isCheckmate) {
        status =
          this.engine.turn === "w" ? "Stockfish wins!" : "Chat wins!";
        statusColor = this.engine.turn === "w" ? "#e94560" : "#16c79a";
      } else if (this.engine.isStalemate) {
        status = "Stalemate!";
        statusColor = "#f5a623";
      } else {
        status = "Draw!";
        statusColor = "#f5a623";
      }
    } else if (this.phase === "white_turn") {
      status = "Your move! (!move e2e4)";
      statusColor = "#16c79a";
    } else if (this.phase === "engine_thinking") {
      status = "Stockfish thinking...";
      statusColor = "#f5a623";
    } else if (this.phase === "white_moving") {
      status = "Playing move...";
      statusColor = "#06b6d4";
    } else if (this.phase === "black_moving") {
      status = "Stockfish plays...";
      statusColor = "#f5a623";
    }

    // Status panel
    drawPanel(ctx, PANEL_X, BOARD_Y, 280, 40, {
      bg: "rgba(0,0,0,0.5)",
      border: "rgba(255,255,255,0.1)",
      radius: 8,
    });
    drawLabel(ctx, PANEL_X + 12, BOARD_Y + 26, status, {
      font: "bold 16px sans-serif",
      color: statusColor,
    });

    // Last move info
    if (this.lastMove) {
      const moveText = `${this.lastMoveBy}: ${this.lastMove.san}`;
      drawPanel(ctx, PANEL_X, BOARD_Y + 50, 280, 34, {
        bg: "rgba(0,0,0,0.35)",
        border: "rgba(255,255,255,0.05)",
        radius: 6,
      });
      drawLabel(ctx, PANEL_X + 12, BOARD_Y + 72, moveText, {
        font: "14px sans-serif",
        color: "#cccccc",
      });
    }

    // Move history
    const history = this.engine.moveHistory;
    if (history.length > 0) {
      const startY = BOARD_Y + 96;
      drawPanel(ctx, PANEL_X, startY, 280, 180, {
        bg: "rgba(0,0,0,0.35)",
        border: "rgba(255,255,255,0.05)",
        radius: 6,
      });
      drawLabel(ctx, PANEL_X + 12, startY + 20, "Move History", {
        font: "bold 14px sans-serif",
        color: "#f5a623",
      });

      // Show last ~14 half-moves as pairs
      const recentMoves = history.slice(-14);
      const startIdx = history.length - recentMoves.length;
      let yOff = startY + 40;

      for (let i = 0; i < recentMoves.length; i += 2) {
        const moveNum = Math.floor((startIdx + i) / 2) + 1;
        const white = recentMoves[i]?.san ?? "";
        const black = recentMoves[i + 1]?.san ?? "";
        const line = `${moveNum}. ${white}  ${black}`;
        drawLabel(ctx, PANEL_X + 12, yOff, line, {
          font: "13px monospace",
          color: "#bbbbbb",
        });
        yOff += 20;
      }
    }

    // Captured pieces
    const captured = this.engine.getCapturedPieces();
    const capturedY = BOARD_Y + 290;
    if (captured.white.length > 0 || captured.black.length > 0) {
      drawPanel(ctx, PANEL_X, capturedY, 280, 60, {
        bg: "rgba(0,0,0,0.35)",
        border: "rgba(255,255,255,0.05)",
        radius: 6,
      });
      drawLabel(ctx, PANEL_X + 12, capturedY + 18, "Captured", {
        font: "bold 13px sans-serif",
        color: "#f5a623",
      });

      // White captured (pieces chat took from Stockfish)
      const whiteCapturedStr = captured.white
        .map((p) => PIECE_DISPLAY[PIECE_CHARS["b"][p]] ?? p)
        .join(" ");
      drawLabel(ctx, PANEL_X + 12, capturedY + 36, whiteCapturedStr, {
        font: "18px sans-serif",
        color: "#cccccc",
      });

      // Black captured (pieces Stockfish took from chat)
      const blackCapturedStr = captured.black
        .map((p) => PIECE_DISPLAY[PIECE_CHARS["w"][p]] ?? p)
        .join(" ");
      drawLabel(ctx, PANEL_X + 12, capturedY + 52, blackCapturedStr, {
        font: "18px sans-serif",
        color: "#cccccc",
      });
    }

    // Contributors leaderboard
    const sorted = [...this.contributors.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({ name, score }));
    drawLeaderboard(ctx, PANEL_X, BOARD_Y + 360, "Contributors", sorted, 6);
  }
}
