import { expect, test } from "bun:test";
import { addDays, canPlace, canTransition, dbError, FREE_WEEK_LIMIT, generationContext, MAX_BODY, mondayOf, PAID_WEEK_LIMIT, todayReminder, validatePost, weekDays, weekLimit } from "@/lib/content-planner";
import { buildBrief, routeRequest } from "@/lib/command-center";

const draft = { channel: "whatsapp", objective: "produit", body: "Bonjour", planned_on: "2026-11-11", slot: "matin", status: "prevu" };

test("semaine locale : lundi à dimanche, passage de mois/année", () => {
  expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // dimanche
  expect(mondayOf("2026-11-09")).toBe("2026-11-09"); // lundi
  expect(weekDays("2026-12-28").at(-1)).toBe("2027-01-03");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

test("validation : canal, objectif, date, 2 000 caractères, texte requis hors brouillon", () => {
  expect(validatePost(draft)).toBeNull();
  expect(validatePost({ ...draft, body: "a".repeat(MAX_BODY) })).toBeNull();
  expect(validatePost({ ...draft, body: "a".repeat(MAX_BODY + 1) })).not.toBeNull();
  expect(validatePost({ ...draft, channel: "sms" })).not.toBeNull();
  expect(validatePost({ ...draft, objective: "argent" })).not.toBeNull();
  expect(validatePost({ ...draft, planned_on: "11/11/2026" })).not.toBeNull();
  expect(validatePost({ ...draft, body: " " })).not.toBeNull();
  expect(validatePost({ ...draft, body: "", status: "brouillon" })).toBeNull();
});

test("transitions brouillon / prévu / publié", () => {
  expect(canTransition("brouillon", "prevu", "x")).toBe(true);
  expect(canTransition("brouillon", "publie", "")).toBe(false);
  expect(canTransition("publie", "brouillon", "")).toBe(true);
  expect(canTransition("prevu", "prevu", "x")).toBe(false);
});

test("limites de plan : Gratuit 7 par semaine, payants 60", () => {
  expect(weekLimit("gratuit")).toBe(FREE_WEEK_LIMIT);
  expect(weekLimit("pro")).toBe(PAID_WEEK_LIMIT);
  expect(weekLimit("inconnu")).toBe(7);
  const seven = Array.from({ length: 7 }, (_, i) => ({ id: String(i), planned_on: "2026-11-10" }));
  expect(canPlace(seven, "2026-11-12", "gratuit")).toBe(false);
  expect(canPlace(seven, "2026-11-17", "gratuit")).toBe(true); // semaine suivante
  expect(canPlace(seven, "2026-11-12", "gratuit", "3")).toBe(true); // déplacement dans la semaine
  expect(canPlace(seven, "2026-11-12", "business")).toBe(true);
  expect(dbError("LIMITE_STATUTS:7")).toContain("7 statuts");
});

test("rappel du jour : seulement les statuts prévus aujourd'hui", () => {
  expect(todayReminder([{ planned_on: "2026-11-08", status: "brouillon", slot: "matin" }], "2026-11-08")).toBeNull();
  expect(todayReminder([{ planned_on: "2026-11-09", status: "prevu", slot: "matin" }], "2026-11-08")).toBeNull();
  const r = todayReminder([{ planned_on: "2026-11-08", status: "prevu", slot: "soir" }, { planned_on: "2026-11-08", status: "publie", slot: "matin" }], "2026-11-08");
  expect(r?.count).toBe(1);
  expect(r?.reason).toContain("soir");
  expect(buildBrief({ statut: r }).map(i => i.id)).toEqual(["statut"]);
});

test("génération : contexte du mode Post ≥ 8 caractères, Centre de commande renvoie au Planificateur", () => {
  expect(generationContext(draft, "").length).toBeGreaterThanOrEqual(8);
  expect(generationContext(draft, "a".repeat(5000)).length).toBeLessThanOrEqual(4000);
  expect(routeRequest("Écrire une publication", "gratuit").some(a => a.kind === "page" && a.to === "/planificateur")).toBe(true);
});
