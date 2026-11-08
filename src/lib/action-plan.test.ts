import { describe, expect, test } from "bun:test";
import { adaptNext, buildWeeks, canUseActionPlan, capacityOf, conversionRate, dayProgress, mondayOf, planDbError, weekActuals, workDays } from "./action-plan";
import { buildBrief, routeRequest } from "./command-center";
import { weeklyRecap } from "./coach";

const plan = { starts_on: "2026-11-09", rest_days: [0] };

describe("plan d'action 30 jours", () => {
  test("accès : payant uniquement", () => {
    expect(canUseActionPlan("gratuit")).toBe(false);
    for (const p of ["pro", "expert", "business"]) expect(canUseActionPlan(p)).toBe(true);
  });
  test("taux personnel à partir de 5 prospects, sinon hypothèse", () => {
    expect(conversionRate("clients", [{ status: "client" }, { status: "nouveau" }])).toMatchObject({ personal: false, rate: 1 / 20 });
    const five = [{ status: "client" }, ...Array.from({ length: 4 }, () => ({ status: "nouveau" }))];
    expect(conversionRate("clients", five)).toMatchObject({ personal: true, rate: 0.2 });
    expect(conversionRate("recruter", five)).toMatchObject({ personal: false, rate: 1 / 40 });
    expect(conversionRate("relancer", five)).toBeNull();
  });
  test("répartition 4 semaines progressive et plafonnée", () => {
    const { weeks, capped } = buildWeeks("clients", 2, 60, [0], { rate: 0.2, personal: true, sample: 10 });
    expect(weeks).toHaveLength(4);
    expect(weeks[0]!.contacts).toBeLessThan(weeks[2]!.contacts);
    expect(capped).toBe(false);
    const big = buildWeeks("clients", 10, 15, [0, 6], null);
    expect(big.capped).toBe(true);
    for (const w of big.weeks) expect(w.contacts + w.relances).toBeLessThanOrEqual(3 * workDays([0, 6]));
    expect(workDays([0, 0, 1])).toBe(5);
  });
  test("réalisé = bilan du Coach + statuts publiés", () => {
    const prospects = [{ id: "a", name: "A", status: "client", interest_level: null, next_followup_date: null, last_contact_date: null, created_at: "2026-11-01T10:00:00", joined_team_at: "2026-11-10T10:00:00" }];
    const events = [{ type: "message_envoyé", prospect_id: "a", content: "", created_at: "2026-11-10T10:00:00" }];
    const posts = [{ published_at: "2026-11-11T09:00:00" }, { published_at: "2026-11-20T09:00:00" }];
    const a = weekActuals("2026-11-09", prospects, events, posts);
    const r = weeklyRecap(prospects, events, "2026-11-09");
    expect(a).toEqual({ contacts: r.contacts, relances: r.relances, posts: 1, clients: r.recrues, recrues: 1 });
  });
  test("suivi du jour", () => {
    expect(dayProgress("2026-11-08", plan, null, { contacts: 0, relances: 0, posts: 0 }).status).toBe("a_venir");
    const p = dayProgress("2026-11-12", plan, { contacts: 10, relances: 4, posts: 3 }, { contacts: 4, relances: 4, posts: 1 });
    expect(p).toMatchObject({ day: 4, weekIndex: 1, status: "en_cours", workDaysLeft: 3, remaining: { contacts: 6, relances: 0, posts: 2 }, today: { contacts: 2, relances: 0, posts: 1 } });
    expect(dayProgress("2026-11-16", plan, null, { contacts: 0, relances: 0, posts: 0 }).weekIndex).toBe(2);
    expect(dayProgress("2026-12-07", plan, null, { contacts: 0, relances: 0, posts: 0 }).status).toBe("fini");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
  });
  test("adaptation proposée sans toucher au réalisé", () => {
    const planned = { contacts: 20, relances: 10, posts: 4 }, next = { contacts: 22, relances: 11, posts: 4 };
    const low = adaptNext(planned, { contacts: 5, relances: 2, posts: 0 }, next, 100);
    expect(low.proposal).toEqual({ contacts: 17, relances: 9, posts: 4 });
    expect(low.changed).toBe(true);
    const mid = adaptNext(planned, { contacts: 16, relances: 8, posts: 3 }, next, 100);
    expect(mid.changed).toBe(false);
    const high = adaptNext(planned, { contacts: 25, relances: 10, posts: 4 }, next, 100);
    expect(high.proposal.contacts).toBe(22);
    expect(adaptNext(planned, { contacts: 30, relances: 30, posts: 9 }, { contacts: 40, relances: 40, posts: 4 }, 30).proposal.contacts + 0).toBeLessThanOrEqual(30);
    expect(capacityOf({ minutes_per_day: 30, rest_days: [0] })).toBe(36);
  });
  test("erreurs et Centre de commande", () => {
    expect(planDbError("PLAN_PAYANT_REQUIS")).toContain("payants");
    expect(routeRequest("ouvrir mon plan d'action", "pro")[0]).toMatchObject({ to: "/plan-action" });
    expect(routeRequest("ouvrir mon plan d'action", "gratuit")[0]).toMatchObject({ to: "/abonnement", locked: true });
    expect(buildBrief({ plan: { day: 3, remaining: 4, reviewPending: false } })[0]).toMatchObject({ id: "plan" });
    expect(buildBrief({ plan: { day: 8, remaining: 0, reviewPending: true } })[0]?.title).toContain("Bilan");
  });
});
