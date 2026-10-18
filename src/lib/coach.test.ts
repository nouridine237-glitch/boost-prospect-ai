import { describe, expect, test } from "bun:test";
import { buildDailyMissions, dailyRecap, type CoachProspect } from "./coach";

const today = "2026-10-18";
const p = (id: string, o: Partial<CoachProspect> = {}): CoachProspect => ({ id, name: id, status: "contacté", interest_level: null, next_followup_date: null, last_contact_date: "2026-10-17T10:00:00", created_at: "2026-10-01T10:00:00", ...o });

describe("buildDailyMissions", () => {
  test("relances en retard d'abord, puis nouveaux, puis chauds", () => {
    const m = buildDailyMissions([
      p("chaud", { interest_level: 3, last_contact_date: "2026-10-10T10:00:00" }),
      p("neuf", { status: "nouveau", last_contact_date: null }),
      p("jour", { next_followup_date: today }),
      p("retard", { next_followup_date: "2026-10-15" }),
    ], [], today);
    expect(m.map(x => x.prospectId)).toEqual(["retard", "jour", "neuf", "chaud"]);
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
