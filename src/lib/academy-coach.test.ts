import { expect, test } from "bun:test";
import { buildCoachPrompt, buildLessonContext, COACH_CONTEXT_MAX, hasCoachContext, trimHistory } from "./academy-coach";

test("contexte tronqué à la limite", () => {
  const c = buildLessonContext({ title: "T", summary: "", notes: "", transcript: "x".repeat(20000) });
  expect(c.length).toBeLessThanOrEqual(COACH_CONTEXT_MAX + 30);
  expect(c).toContain("tronqué");
});

test("coach indisponible sans notes ni transcription", () => {
  expect(hasCoachContext({ notes: "", transcript: "court" })).toBe(false);
  expect(hasCoachContext({ notes: "n".repeat(40), transcript: "" })).toBe(true);
});

test("historique limité aux 4 derniers échanges", () => {
  const h = Array.from({ length: 9 }, (_, i) => ({ role: "user" as const, text: `q${i}` }));
  expect(trimHistory(h).map((t) => t.text)).toEqual(["q5", "q6", "q7", "q8"]);
});

test("question tronquée à 600 caractères", () => {
  const p = buildCoachPrompt("ctx", [], "a".repeat(1000));
  expect(p.endsWith("a".repeat(600))).toBe(true);
  expect(p).not.toContain("a".repeat(601));
});
