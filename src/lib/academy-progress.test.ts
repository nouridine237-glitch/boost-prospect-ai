import { describe, expect, test } from "bun:test";
import { courseProgress, creditSeconds, lessonProgress, resumeAt, resumeLesson, type ProgressRow } from "./academy-progress";

const row = (id: string, status: string, watched = 0, at = "2026-11-01T10:00:00Z"): ProgressRow =>
  ({ lesson_id: id, status, position_seconds: 120, watched_seconds: watched, duration_seconds: 600, last_activity_at: at });

describe("progression des leçons vidéo", () => {
  test("sans ligne, la leçon est non commencée", () => {
    expect(lessonProgress(undefined, 600).state).toBe("non_commencee");
  });
  test("une leçon en cours n'affiche jamais 100 %", () => {
    expect(lessonProgress(row("a", "en_cours", 600), 600)).toEqual({ state: "en_cours", position: 120, percent: 99 });
  });
  test("un cours compte uniquement les leçons publiées actuelles", () => {
    expect(courseProgress(["a", "b"], [row("a", "terminee"), row("zombie", "terminee")])).toEqual({ done: 1, total: 2, percent: 50 });
  });
  test("reprise sur la leçon non terminée la plus récente", () => {
    expect(resumeLesson(["a", "b", "c"], [row("a", "terminee"), row("b", "en_cours", 0, "2026-11-01T09:00:00Z"), row("c", "en_cours", 0, "2026-11-02T09:00:00Z")])).toBe("c");
    expect(resumeLesson(["a", "b"], [row("a", "terminee")])).toBe("b");
  });
  test("pas de reprise trop près du début ou de la fin", () => {
    expect(resumeAt(3, 600)).toBe(0);
    expect(resumeAt(595, 600)).toBe(0);
    expect(resumeAt(252.7, 600)).toBe(252);
  });
  test("le temps visionné est borné par l'horloge, l'avancée et 30 s", () => {
    expect(creditSeconds(false, 15, 0, 15)).toBe(0); // pas de lecture précédente
    expect(creditSeconds(true, 15, 100, 400)).toBe(15); // saut en avant : seulement le temps écoulé
    expect(creditSeconds(true, 3600, 100, 4000)).toBe(30); // plafond par envoi
    expect(creditSeconds(true, 15, 400, 100)).toBe(0); // retour en arrière
  });
});
