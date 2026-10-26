import { describe, expect, test } from "bun:test";
import { buildDailyMissions, dailyRecap, matchObjectionId, priorityOf, priorityScore, readCoachSettings, type CoachProspect } from "./coach";

const today = "2026-10-18";
const p = (id: string, o: Partial<CoachProspect> = {}): CoachProspect => ({ id, name: id, status: "contacté", interest_level: null, next_followup_date: null, last_contact_date: "2026-10-17T10:00:00", created_at: "2026-10-01T10:00:00", ...o });

describe("buildDailyMissions", () => {
  test("missions triées par score décroissant", () => {
    const m = buildDailyMissions([
      p("chaud", { interest_level: 3, last_contact_date: "2026-10-10T10:00:00" }),
      p("neuf", { status: "nouveau", last_contact_date: null }),
      p("jour", { next_followup_date: today }),
      p("retard", { next_followup_date: "2026-10-15" }),
    ], [], today);
    // chaud 30+14=44 ; retard 20+30+2=52 ; jour 20+2=22 ; neuf 10
    expect(m.map(x => x.prospectId)).toEqual(["retard", "chaud", "jour", "neuf"]);
    expect(m[0]!.priority).toBe("haute");
  });
  test("exclut Client et Non intéressé", () => {
    const m = buildDailyMissions([p("a", { status: "client", next_followup_date: today }), p("b", { status: "non_intéressé", next_followup_date: today })], [], today);
    expect(m).toHaveLength(0);
  });
  test("jamais plus de 5 missions", () => {
    const list = Array.from({ length: 9 }, (_, i) => p(`x${i}`, { next_followup_date: today }));
    expect(buildDailyMissions(list, [], today)).toHaveLength(5);
  });
  test("mission faite aujourd'hui reste marquée, pas celle d'hier", () => {
    const list = [p("a", { next_followup_date: today }), p("b", { next_followup_date: today })];
    const m = buildDailyMissions(list, [
      { type: "mission_faite", prospect_id: "a", created_at: new Date(2026, 9, 18, 9).toISOString() },
      { type: "mission_faite", prospect_id: "b", created_at: new Date(2026, 9, 17, 23, 59).toISOString() },
    ], today);
    expect(m.find(x => x.prospectId === "a")!.done).toBe(true);
    expect(m.find(x => x.prospectId === "b")!.done).toBe(false);
  });
  test("chaud contacté il y a 2 jours n'est pas proposé", () => {
    expect(buildDailyMissions([p("c", { interest_level: 3, last_contact_date: "2026-10-16T12:00:00" })], [], today)).toHaveLength(0);
  });
});

describe("dailyRecap", () => {
  test("bilan à zéro sans événements, objectif hebdo divisé par 5", () => {
    expect(dailyRecap([], [], { contacts_goal: 10, relances_goal: 5 }, today)).toEqual({ contacts: 0, relances: 0, nouveaux: 0, missionsFaites: 0, contactsGoal: 2, relancesGoal: 1 });
  });
});

describe("V2 : score et réglages", () => {
  test("score critère par critère", () => {
    expect(priorityScore(p("a", { last_contact_date: "2026-10-18T08:00:00" }), today)).toBe(0);
    expect(priorityScore(p("a", { last_contact_date: null }), today)).toBe(10);
    expect(priorityScore(p("a", { last_contact_date: "2026-10-18T08:00:00", interest_level: 2 }), today)).toBe(15);
    expect(priorityScore(p("a", { last_contact_date: "2026-10-18T08:00:00", status: "intéressé" }), today)).toBe(10);
    expect(priorityScore(p("a", { last_contact_date: "2026-10-18T08:00:00", main_objection: "trop cher" }), today)).toBe(5);
    expect(priorityScore(p("a", { last_contact_date: "2026-10-18T08:00:00", next_followup_date: "2026-10-01" }), today)).toBe(50);
  });
  test("seuils de priorité", () => {
    expect(priorityOf(50)).toBe("haute"); expect(priorityOf(25)).toBe("moyenne"); expect(priorityOf(24)).toBe("normale");
  });
  test("égalité : ordre des catégories conservé", () => {
    const m = buildDailyMissions([p("b", { next_followup_date: today }), p("a", { next_followup_date: today })], [], today);
    expect(m.map(x => x.prospectId)).toEqual(["b", "a"]);
  });
  test("nombre de missions 3 / 8 respecté", () => {
    const list = Array.from({ length: 9 }, (_, i) => p(`x${i}`, { next_followup_date: today }));
    expect(buildDailyMissions(list, [], today, 5, { missions: 3, restDays: [], tone: "amical" })).toHaveLength(3);
    expect(buildDailyMissions(list, [], today, 5, { missions: 8, restDays: [], tone: "amical" })).toHaveLength(8);
  });
  test("jour de repos : aucune mission (18 oct. 2026 = dimanche)", () => {
    expect(buildDailyMissions([p("a", { next_followup_date: today })], [], today, 5, { missions: 5, restDays: [0], tone: "amical" })).toHaveLength(0);
  });
  test("réglages invalides ramenés aux valeurs par défaut", () => {
    expect(readCoachSettings({ coach: { missions: 7, restDays: [9, 1, 1], tone: "x" } })).toEqual({ missions: 5, restDays: [1], tone: "amical" });
  });
  test("correspondance objection", () => {
    expect(matchObjectionId("Il trouve ça trop cher")).toBe("cher");
    expect(matchObjectionId("pas le temps en ce moment")).toBe("temps");
    expect(matchObjectionId("")).toBeNull();
    expect(matchObjectionId("aucune idée")).toBeNull();
  });
});

import { streak, weeklyRecap, suggestNextGoals, mondayOf } from "./coach";
const ev = (type: string, day: string, pid = "p1", content = "") => ({ type, prospect_id: pid, content, created_at: new Date(day + "T10:00:00").toISOString() });
describe("coach V3", () => {
  test("série consécutive, cassée par un trou", () => {
    const e = [ev("message_envoyé", "2026-10-21"), ev("mission_faite", "2026-10-22"), ev("message_envoyé", "2026-10-23")];
    expect(streak(e, "2026-10-23")).toBe(3);
    expect(streak([ev("message_envoyé", "2026-10-20"), ev("message_envoyé", "2026-10-23")], "2026-10-23")).toBe(1);
  });
  test("jour de repos ne casse pas la série", () => {
    // 25 oct. 2026 = dimanche
    const e = [ev("message_envoyé", "2026-10-24"), ev("message_envoyé", "2026-10-26")];
    expect(streak(e, "2026-10-26", { missions: 5, restDays: [0], tone: "amical" })).toBe(2);
    expect(streak(e, "2026-10-26")).toBe(1);
  });
  test("aujourd'hui pas encore actif ne remet pas à zéro", () => {
    expect(streak([ev("message_envoyé", "2026-10-25")], "2026-10-26")).toBe(1);
  });
  test("lundi de la semaine", () => { expect(mondayOf("2026-10-25")).toBe("2026-10-19"); expect(mondayOf("2026-10-19")).toBe("2026-10-19"); });
  test("bilan de semaine limité à la semaine", () => {
    const e = [ev("message_envoyé", "2026-10-19"), ev("message_envoyé", "2026-10-20", "p2"), ev("message_envoyé", "2026-10-20", "p3"), ev("message_envoyé", "2026-10-26", "p4"), ev("changement_statut", "2026-10-21", "p1", "Intéressé → Client")];
    const r = weeklyRecap([], e, "2026-10-19");
    expect(r.contacts).toBe(3); expect(r.recrues).toBe(1); expect(r.bestDay).toBe("2026-10-20");
  });
  test("règle +10 % si atteint, identique sinon", () => {
    const n = suggestNextGoals({ contacts_goal: 10, relances_goal: 5, recrues_goal: 1 }, { contacts: 10, relances: 4, recrues: 1, missions: 0, bestDay: null });
    expect(n).toEqual({ contacts_goal: 11, relances_goal: 5, recrues_goal: 2 });
    expect(suggestNextGoals({ contacts_goal: 25, relances_goal: 1, recrues_goal: 1 }, { contacts: 30, relances: 0, recrues: 0, missions: 0, bestDay: null }).contacts_goal).toBe(28);
  });
});
