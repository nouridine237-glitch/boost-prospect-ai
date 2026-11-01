import { PASS_RATIO, quizzes } from "@/lib/academy-quiz";

export type QuizResult = { level: number; score: number; total: number; passed: boolean };

/** Recalcule le score à partir des réponses et des questions officielles. null si entrée invalide. */
export function scoreQuiz(level: number, answers: unknown): QuizResult | null {
  const qs = quizzes[level];
  if (!qs || !Array.isArray(answers) || answers.length !== qs.length) return null;
  if (!answers.every((a) => Number.isInteger(a) && a >= 0)) return null;
  const score = qs.filter((q, i) => answers[i] === q.answer).length;
  return { level, score, total: qs.length, passed: score / qs.length >= PASS_RATIO };
}
