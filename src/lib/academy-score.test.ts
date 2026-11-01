import { describe, expect, test } from "bun:test";
import { scoreQuiz } from "@/lib/academy-score";
import { quizzes } from "@/lib/academy-quiz";

const correct = (n: number) => quizzes[n]!.map((q) => q.answer);

describe("scoreQuiz", () => {
  test("toutes bonnes réponses = validé", () => {
    expect(scoreQuiz(1, correct(1))).toEqual({ level: 1, score: 5, total: 5, passed: true });
  });
  test("4/5 = 80 % = validé (seuil inclus)", () => {
    const a = correct(2); a[0] = (a[0]! + 1) % 3;
    expect(scoreQuiz(2, a)).toMatchObject({ score: 4, passed: true });
  });
  test("3/5 = 60 % = non validé", () => {
    const a = correct(3); a[0] = (a[0]! + 1) % 3; a[1] = (a[1]! + 1) % 3;
    expect(scoreQuiz(3, a)).toMatchObject({ score: 3, passed: false });
  });
  test("niveau inconnu ou réponses mal formées refusés", () => {
    expect(scoreQuiz(99, [0])).toBeNull();
    expect(scoreQuiz(1, [0, 1])).toBeNull();
    expect(scoreQuiz(1, [0, 1, 2, "x", 0])).toBeNull();
    expect(scoreQuiz(1, "tricher")).toBeNull();
  });
});
