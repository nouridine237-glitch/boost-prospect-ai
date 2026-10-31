import { describe, expect, test } from "bun:test";
import { cohortConversion, conversionRate, parseStatusChange, statusDistribution, statusTransitions, stuckProspects, type ConvEvent, type ConvProspect } from "./conversion";

const p = (id: string, status: string, o: Partial<ConvProspect> = {}): ConvProspect => ({ id, status, created_at: "2026-10-01T10:00:00Z", last_contact_date: null, ...o });
const ev = (prospect_id: string, content: string | null, created_at: string | null = "2026-10-10T10:00:00Z", type = "changement_statut"): ConvEvent => ({ prospect_id, type, content, created_at });
const now = new Date("2026-10-20T10:00:00Z");

describe("données vides", () => {
  test("taux et historique : données insuffisantes", () => {
    expect(conversionRate([]).status).toBe("insufficient");
    expect(statusTransitions([]).status).toBe("insufficient");
    expect(statusDistribution([]).total).toBe(0);
    expect(stuckProspects([], [], now).stuck).toEqual([]);
  });
});

describe("taux de conversion", () => {
  test("1 client sur 4 = 25 %", () => {
    const r = conversionRate([p("a", "client"), p("b", "nouveau"), p("c", "discussion"), p("d", "non_intéressé")]);
    expect(r).toEqual({ status: "ok", value: { clients: 1, total: 4, rate: 25 } });
  });
  test("cohorte : seuls les prospects créés dans la période", () => {
    const r = cohortConversion([p("a", "client"), p("b", "nouveau"), p("c", "client", { created_at: "2026-09-01T10:00:00Z" })], new Date("2026-10-01T00:00:00Z"), new Date("2026-11-01T00:00:00Z"));
    expect(r.status === "ok" && r.value).toMatchObject({ cohort: 2, clients: 1, rate: 50 });
  });
  test("cohorte vide ou période invalide", () => {
    expect(cohortConversion([p("a", "client")], new Date("2027-01-01"), new Date("2027-02-01")).status).toBe("insufficient");
    expect(cohortConversion([p("a", "client")], new Date("2027-02-01"), new Date("2027-01-01")).status).toBe("insufficient");
  });
});

describe("changements de statut", () => {
  test("lecture des libellés réels", () => {
    expect(parseStatusChange("Contacté → Intéressé")).toEqual({ from: "contacté", to: "intéressé" });
    expect(parseStatusChange("Intéressé → Non intéressé")).toEqual({ from: "intéressé", to: "non_intéressé" });
    expect(parseStatusChange("n'importe quoi")).toBeNull();
    expect(parseStatusChange(null)).toBeNull();
  });
  test("transitions comptées, autres événements ignorés", () => {
    const r = statusTransitions([ev("a", "Nouveau → Contacté"), ev("b", "Nouveau → Contacté"), ev("a", "Contacté → Client"), ev("a", "x", null, "message_envoyé"), ev("c", "illisible")]);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.value.transitions[0]).toEqual({ from: "nouveau", to: "contacté", count: 2 });
      expect(r.value.prospects).toBe(2);
      expect(r.value.unreadable).toBe(1);
    }
  });
  test("uniquement des textes illisibles : insuffisant", () => {
    expect(statusTransitions([ev("a", "???")]).status).toBe("insufficient");
  });
});

describe("prospects bloqués (7 jours)", () => {
  test("actif inactif depuis 7 jours bloqué, 6 jours non", () => {
    const r = stuckProspects([
      p("vieux", "discussion", { created_at: "2026-10-13T10:00:00Z" }),
      p("recent", "discussion", { created_at: "2026-10-14T10:00:00Z" }),
    ], [], now);
    expect(r.stuck.map(s => s.id)).toEqual(["vieux"]);
    expect(r.stuck[0].idleDays).toBe(7);
  });
  test("un événement récent compte comme activité", () => {
    expect(stuckProspects([p("a", "contacté")], [ev("a", "x", "2026-10-19T10:00:00Z", "message_envoyé")], now).stuck).toEqual([]);
  });
  test("Client et Non intéressé jamais bloqués", () => {
    expect(stuckProspects([p("a", "client"), p("b", "non_intéressé")], [], now).stuck).toEqual([]);
  });
  test("dates toutes invalides : inconnu, pas bloqué", () => {
    const r = stuckProspects([p("a", "nouveau", { created_at: "pas une date", last_contact_date: null })], [ev("a", "x", "invalide")], now);
    expect(r.stuck).toEqual([]);
    expect(r.unknown).toEqual(["a"]);
  });
});

describe("cas limites", () => {
  test("statut inconnu compté à part", () => {
    expect(statusDistribution([p("a", "bizarre"), p("b", "client")])).toMatchObject({ total: 2, unknown: 1, counts: { client: 1 } });
  });
  test("date de création invalide exclue de la cohorte et signalée", () => {
    const r = cohortConversion([p("a", "client"), p("b", "client", { created_at: null })], new Date("2026-10-01T00:00:00Z"), new Date("2026-11-01T00:00:00Z"));
    expect(r.status === "ok" && r.value).toMatchObject({ cohort: 1, skippedInvalidDates: 1 });
  });
});
