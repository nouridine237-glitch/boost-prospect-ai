import { describe, expect, test } from "bun:test";
import { canCompleteDay, pathState, validActions } from "./duplication-rules";
import { FEATURE_MIN_PLAN, hasFeature, computeEffectivePlan } from "./plans";

describe("duplication", () => {
  test("exactement sept jours, démarrage au premier", () => { expect(pathState([])).toEqual({ currentDay: 1, completedCount: 0, finished: false }); expect(canCompleteDay(0, [0,1,2], [])).toBe(false); expect(canCompleteDay(8, [0,1,2], [])).toBe(false); });
  test("checklist valide avant complétion", () => { expect(canCompleteDay(1, [0,1,2], [])).toBe(true); expect(canCompleteDay(1, [0,1], [])).toBe(false); expect(validActions([0,0,2],3)).toBe(false); expect(validActions([3],3)).toBe(false); });
  test("ordre et reprise à partir des résultats persistés", () => { const rows = [{ day:1, checked_actions:[0,1,2], completed_at:"2026-11-01T00:00:00Z" }]; expect(pathState(rows).currentDay).toBe(2); expect(canCompleteDay(2,[0,1,2],rows)).toBe(true); expect(canCompleteDay(3,[0,1,2],rows)).toBe(false); });
  test("état terminé et jours précédents conservés", () => { const rows = Array.from({length:7},(_,i)=>({day:i+1,checked_actions:[0,1,2],completed_at:"2026-11-01T00:00:00Z"})); expect(pathState(rows)).toEqual({currentDay:7,completedCount:7,finished:true}); expect(canCompleteDay(1,[0,1,2],rows)).toBe(true); });
  for (const feature of ["duplicationPath","duplicationKits"] as const) {
    test(`${feature} réservé aux plans payants`, () => { expect(FEATURE_MIN_PLAN[feature]).toBe("pro"); expect(hasFeature("gratuit",feature)).toBe(false); expect(hasFeature("inconnu",feature)).toBe(false); for (const plan of ["pro","expert","business"]) expect(hasFeature(plan,feature)).toBe(true); });
    test(`${feature} refusé après expiration et grâce`, () => { expect(hasFeature(computeEffectivePlan({plan:"pro",status:"actif",date_renouvellement:"2026-10-01T00:00:00Z"},new Date("2026-11-01T00:00:00Z")),feature)).toBe(false); });
  }
});