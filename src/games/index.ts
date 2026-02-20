import { Game } from "../types";
import { BallGame } from "./ball-game";
import { ScrambleGame } from "./typing-game";
import { TriviaGame } from "./trivia-game";
import { ChessGame } from "./chess-game";

const gameRegistry: Record<string, () => Game> = {
  ball: () => new BallGame(),
  scramble: () => new ScrambleGame(),
  trivia: () => new TriviaGame(),
  chess: () => new ChessGame(),
};

export function createGame(name: string): Game {
  const factory = gameRegistry[name];
  if (!factory) {
    const available = Object.keys(gameRegistry).join(", ");
    throw new Error(`Unknown game "${name}". Available games: ${available}`);
  }
  return factory();
}

export function getAvailableGames(): string[] {
  return Object.keys(gameRegistry);
}

export function getRandomGame(exclude: string): { name: string; game: Game } {
  const candidates = Object.keys(gameRegistry).filter((n) => n !== exclude);
  const name = candidates[Math.floor(Math.random() * candidates.length)];
  return { name, game: createGame(name) };
}

const gameDisplayNames: Record<string, string> = {
  ball: "Ball Game",
  scramble: "Word Scramble",
  trivia: "Trivia",
  chess: "Chess vs Stockfish",
};

export function getDisplayName(name: string): string {
  return gameDisplayNames[name] ?? name;
}
