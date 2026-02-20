export interface TriviaQuestion {
  question: string;
  correctAnswer: string;
  options: [string, string, string, string];
  correctIndex: number;
  category: string;
  difficulty: string;
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function shuffleAnswers(
  correct: string,
  incorrect: string[],
): { options: [string, string, string, string]; correctIndex: number } {
  const answers = [correct, ...incorrect.slice(0, 3)];
  // Fisher-Yates shuffle
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  return {
    options: answers as [string, string, string, string],
    correctIndex: answers.indexOf(correct),
  };
}

const FALLBACK_QUESTIONS: TriviaQuestion[] = [
  {
    question: "What is the largest planet in our solar system?",
    correctAnswer: "Jupiter",
    options: ["Saturn", "Jupiter", "Neptune", "Mars"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy",
  },
  {
    question: "In what year did the Titanic sink?",
    correctAnswer: "1912",
    options: ["1905", "1912", "1920", "1898"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
  },
  {
    question: "Which element has the chemical symbol 'O'?",
    correctAnswer: "Oxygen",
    options: ["Gold", "Osmium", "Oxygen", "Iron"],
    correctIndex: 2,
    category: "Science",
    difficulty: "easy",
  },
  {
    question: "What is the capital of Australia?",
    correctAnswer: "Canberra",
    options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
  },
  {
    question: "Who painted the Mona Lisa?",
    correctAnswer: "Leonardo da Vinci",
    options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"],
    correctIndex: 1,
    category: "Art",
    difficulty: "easy",
  },
];

interface OpenTDBResponse {
  response_code: number;
  results: Array<{
    category: string;
    difficulty: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
  }>;
}

export async function fetchQuestions(amount = 15): Promise<TriviaQuestion[]> {
  try {
    const res = await fetch(
      `https://opentdb.com/api.php?amount=${amount}&type=multiple`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as OpenTDBResponse;
    if (data.response_code !== 0 || !data.results.length) {
      throw new Error("No results from API");
    }

    return data.results.map((r) => {
      const question = decodeHtmlEntities(r.question);
      const correct = decodeHtmlEntities(r.correct_answer);
      const incorrect = r.incorrect_answers.map(decodeHtmlEntities);
      const { options, correctIndex } = shuffleAnswers(correct, incorrect);
      return {
        question,
        correctAnswer: correct,
        options,
        correctIndex,
        category: decodeHtmlEntities(r.category),
        difficulty: r.difficulty,
      };
    });
  } catch {
    return [...FALLBACK_QUESTIONS];
  }
}
