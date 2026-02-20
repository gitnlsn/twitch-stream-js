const FALLBACK_WORDS = [
  "stream", "twitch", "gaming", "pixel", "score", "combo", "turbo", "quest",
  "ninja", "clutch", "hype", "glitch", "boost", "flame", "frost", "blade",
  "spark", "drift", "pulse", "orbit", "laser", "solar", "lunar", "cyber",
  "pixel", "prism", "storm", "ocean", "tiger", "eagle", "ghost", "magic",
  "crown", "royal", "steel", "brave", "swift", "flash", "power", "blaze",
  "crisp", "dream", "light", "shade", "stone", "frost", "cloud", "river",
  "maple", "amber", "ivory", "coral", "raven", "delta", "nexus", "forge",
  "haven", "atlas", "titan", "noble",
];

export async function fetchWords(amount = 50): Promise<string[]> {
  try {
    const res = await fetch(
      `https://random-word-api.herokuapp.com/word?number=${amount}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as string[];

    const filtered = data.filter(
      (w) => w.length >= 4 && w.length <= 8 && /^[a-z]+$/.test(w),
    );

    if (filtered.length < 10) throw new Error("Too few valid words");
    return filtered;
  } catch {
    return [...FALLBACK_WORDS];
  }
}

export function scrambleWord(word: string): string {
  const letters = word.split("");
  let scrambled: string;
  let attempts = 0;

  do {
    // Fisher-Yates shuffle
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    scrambled = letters.join("");
    attempts++;
  } while (scrambled === word && attempts < 20);

  return scrambled;
}
