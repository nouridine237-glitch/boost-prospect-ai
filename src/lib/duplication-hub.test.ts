import { describe, expect, test } from "bun:test";
import { isValidToken, toPublicCourse, viewerAction, publicLinkError } from "./duplication-hub";

describe("duplication hub", () => {
  test("jeton : seulement 64 hex", () => {
    expect(isValidToken("a".repeat(64))).toBe(true);
    expect(isValidToken("a".repeat(63))).toBe(false);
    expect(isValidToken("A".repeat(64))).toBe(false);
    expect(isValidToken("../etc")).toBe(false);
  });
  test("réponse publique : champs privés supprimés", () => {
    const c = toPublicCourse({ trainer: "Awa", intro: "Hi", whatsapp: "237600000000", title: "T", description: "D", freeLessonId: "l1",
      owner_id: "secret", notes: "x", storage_path: "p", lessons: [{ id: "l1", title: "A", module: "", duration: 30, free: true, video_id: "v", transcript: "t" }] })!;
    expect(Object.keys(c).sort()).toEqual(["description", "freeLessonId", "intro", "lessons", "title", "trainer", "whatsapp"]);
    expect(Object.keys(c.lessons[0]!).sort()).toEqual(["duration", "free", "id", "module", "title"]);
  });
  test("lien invalide ou limité = null", () => {
    expect(toPublicCourse(null)).toBeNull();
    expect(toPublicCourse({ error: "rate_limited" })).toBeNull();
  });
  test("whatsapp non numérique écarté", () => {
    expect(toPublicCourse({ freeLessonId: "l", whatsapp: "javascript:x", lessons: [] })!.whatsapp).toBeNull();
  });
  test("action selon les droits, sans octroi automatique", () => {
    expect(viewerAction("anonyme").to).toBe("auth");
    expect(viewerAction("owner").to).toBe("editor");
    expect(viewerAction("recipient").to).toBe("reader");
    expect(viewerAction("pending").to).toBe("received");
    expect(viewerAction("none").to).toBe("request");
  });
  test("création réservée Business", () => {
    expect(publicLinkError(new Error("PLAN_BUSINESS_REQUIS"))).toContain("Business");
  });
});
