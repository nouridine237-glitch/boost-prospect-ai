import { describe, expect, test } from "bun:test";
import { buildBrief, clampRequest, detectIntents, MAX_REQUEST, routeRequest } from "./command-center";

describe("routeur d'intention", () => {
  test("ignore accents et casse", () => {
    expect(detectIntents("ÉCRIRE UNE PUBLICATION")).toContain("post");
    expect(detectIntents("reprendre une lecon")).toContain("formation");
  });
  test("objection prioritaire et reconnue", () => {
    const a = routeRequest("Mon prospect dit que c'est une arnaque", "gratuit");
    expect(a[0]).toMatchObject({ kind: "objection", objectionId: "pyramide" });
    expect(a.length).toBeLessThanOrEqual(3);
  });
  test("relance ouvre le CRM puis un brouillon", () => {
    const a = routeRequest("Préparer une relance", "gratuit");
    expect(a[0]).toMatchObject({ kind: "page", to: "/prospects" });
    expect(a[1]).toMatchObject({ kind: "assistant", mode: "prospection" });
  });
  test("post ouvre l'Assistant en mode Post", () => {
    expect(routeRequest("Écrire une publication", "gratuit")[0]).toMatchObject({ kind: "assistant", mode: "post" });
  });
  test("formation et statistiques", () => {
    expect(routeRequest("Reprendre une formation", "gratuit")[0]).toMatchObject({ to: "/academie" });
    expect(routeRequest("Comprendre mes statistiques", "gratuit")[0]).toMatchObject({ to: "/statistiques" });
  });
  test("repli si intention inconnue", () => {
    const a = routeRequest("bonjour", "gratuit");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: "fallback", kind: "assistant", context: "bonjour" });
  });
  test("duplication verrouillée en gratuit, ouverte en Pro", () => {
    expect(routeRequest("Développer mon équipe", "gratuit")[0]).toMatchObject({ to: "/abonnement", locked: true });
    expect(routeRequest("Développer mon équipe", "pro")[0]).toMatchObject({ to: "/duplication" });
  });
  test("texte limité à 2000 caractères", () => {
    expect(clampRequest("a".repeat(5000))).toHaveLength(MAX_REQUEST);
    const a = routeRequest("x".repeat(5000), "gratuit")[0]!;
    expect(a.kind === "assistant" && a.context.length).toBe(MAX_REQUEST);
  });
});

describe("brief du jour", () => {
  const course = { slug: "c", title: "Cours", percent: 40, resumeSlug: "l1", unlocked: true };
  test("aucune donnée : brief vide", () => {
    expect(buildBrief({})).toEqual([]);
    expect(buildBrief({ mission: null, stuck: null, course: null, duplication: null })).toEqual([]);
  });
  test("limité à trois, sans doublon de prospect", () => {
    const b = buildBrief({
      mission: { prospectId: "p1", name: "Awa", reason: "Relance prévue aujourd'hui" },
      stuck: [{ id: "p1", name: "Awa", idleDays: 9 }, { id: "p2", name: "Koffi", idleDays: 8 }],
      course: [course],
      duplication: { allowed: true, days: [{ day: 1, title: "Bases" }], progress: [] },
    });
    expect(b.map(i => i.id)).toEqual(["coach", "inactif", "lecon"]);
    expect(b[1]).toMatchObject({ prospectId: "p2" });
  });
  test("cours verrouillé ou terminé ignoré, duplication proposée", () => {
    const b = buildBrief({ course: [{ ...course, unlocked: false }, { ...course, percent: 100 }], duplication: { allowed: true, days: [{ day: 1, title: "Bases" }, { day: 2, title: "Contacts" }], progress: [{ day: 1, completed_at: "2026-11-01" }] } });
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ id: "duplication", day: 2 });
  });
  test("duplication non autorisée : rien", () => {
    expect(buildBrief({ duplication: { allowed: false, days: [], progress: [] } })).toEqual([]);
  });
});
