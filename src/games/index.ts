import { Game } from "../types";
import { BallGame } from "./ball-game";
import { ColorChaseGame } from "./color-chase-game";
import { TypingGame } from "./typing-game";
import { TriviaGame } from "./trivia-game";

const gameRegistry: Record<string, () => Game> = {
  ball: () => new BallGame(),
  "color-chase": () => new ColorChaseGame(),
  typing: () => new TypingGame(),
  trivia: () => new TriviaGame(),
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
  "color-chase": "Color Chase",
  typing: "Typing Game",
  trivia: "Trivia",
};

export function getDisplayName(name: string): string {
  return gameDisplayNames[name] ?? name;
}
