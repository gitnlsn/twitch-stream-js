import { Game } from "../types";
import { BallGame } from "./ball-game";

const gameRegistry: Record<string, () => Game> = {
  ball: () => new BallGame(),
};

export function createGame(name: string): Game {
  const factory = gameRegistry[name];
  if (!factory) {
    const available = Object.keys(gameRegistry).join(", ");
    throw new Error(`Unknown game "${name}". Available games: ${available}`);
  }
  return factory();
}
