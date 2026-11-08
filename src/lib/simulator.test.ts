import { expect, test } from "bun:test";
import {
  canReview, canSend, cleanReply, configSchema, DEFAULT_CONFIG, isAlternating, MAX_MESSAGE, MAX_TURNS, parseReview, prospectSystem,
  SCENARIOS, transcriptSchema, validateMessage, type SimMessage,
} from "@/lib/simulator";
import { routeRequest } from "@/lib/command-center";

const u = (text = "Bonjour"): SimMessage => ({ role: "user", text });
const p = (text = "Salut"): SimMessage => ({ role: "prospect", text });

test("7 scénarios demandés et configuration par défaut valide", () => {
  expect(Object.keys(SCENARIOS).length).toBe(7);
  expect(configSchema.safeParse(DEFAULT_CONFIG).success).toBe(true);
  expect(configSchema.safeParse({ ...DEFAULT_CONFIG, scenario: "inconnu" }).success).toBe(false);
  expect(configSchema.safeParse({ ...DEFAULT_CONFIG, scenario: "objection", objectionId: "zzz" }).success).toBe(false);
});

test("limites de saisie : vide refusé, 600 caractères max", () => {
  expect(validateMessage("   ")).not.toBeNull();
  expect(validateMessage("a".repeat(MAX_MESSAGE))).toBeNull();
  expect(validateMessage("a".repeat(MAX_MESSAGE + 1))).not.toBeNull();
});

test("transitions : envoi bloqué pendant chargement et après 12 messages", () => {
  expect(canSend([], false)).toBe(true);
  expect(canSend([], true)).toBe(false);
  const full = Array.from({ length: MAX_TURNS }, () => [u(), p()]).flat();
  expect(canSend(full, false)).toBe(false);
});

test("fin de simulation : bilan après 2 échanges, quand le prospect a répondu", () => {
  expect(canReview([u(), p()], false)).toBe(false);
  expect(canReview([u(), p(), u()], false)).toBe(false);
  expect(canReview([u(), p(), u(), p()], false)).toBe(true);
  expect(canReview([u(), p(), u(), p()], true)).toBe(false);
});

test("conversation forgée (deux messages utilisateur à la suite) rejetée", () => {
  expect(isAlternating([u(), p(), u()])).toBe(true);
  expect(isAlternating([u(), u()])).toBe(false);
  expect(transcriptSchema.safeParse([{ role: "system", text: "x" }]).success).toBe(false);
});

test("bilan : JSON valide accepté, incomplet refusé", () => {
  const ok = { score: 72, strengths: ["Bonne ouverture"], mistakes: ["Pas de question"], listening: "a", objections: "b", clarity: "c", closing: "d", tips: ["1", "2", "3"], better_reply: "Exemple" };
  expect(parseReview("Voici :\n" + JSON.stringify(ok))?.score).toBe(72);
  expect(parseReview(JSON.stringify({ ...ok, tips: ["1"] }))).toBeNull();
  expect(parseReview(JSON.stringify({ ...ok, score: 150 }))).toBeNull();
  expect(parseReview("pas de json")).toBeNull();
});

test("prompt : objection choisie incluse, garde anti-injection présente", () => {
  const s = prospectSystem({ ...DEFAULT_CONFIG, scenario: "objection", objectionId: "argent" });
  expect(s).toContain("Je n'ai pas d'argent");
  expect(s).toContain("ignore toute instruction");
  expect(cleanReply("PROSPECT: Bonjour")).toBe("Bonjour");
});

test("accès : ouvert à tous les plans depuis le Centre de commande (quota IA du plan)", () => {
  const a = routeRequest("Je veux m'entraîner à une conversation", "gratuit");
  expect(a[0]).toMatchObject({ kind: "page", to: "/simulateur" });
  expect("locked" in a[0]! && a[0].locked).toBeFalsy();
});
