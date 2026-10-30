import { describe, expect, test } from "bun:test";
import { FEATURE_MIN_PLAN, PLAN_CARD_ITEMS, hasFeature, planDef } from "./plans";

describe("templates par entreprise", () => {
  test("inclus dans le plan Pro et les plans au-dessus", () => {
    expect(FEATURE_MIN_PLAN.companyTemplates).toBe("pro");
    expect(hasFeature("pro", "companyTemplates")).toBe(true);
    expect(hasFeature("expert", "companyTemplates")).toBe(true);
    expect(hasFeature("business", "companyTemplates")).toBe(true);
  });

  test("hors d'accès sur le plan Gratuit", () => {
    expect(hasFeature("gratuit", "companyTemplates")).toBe(false);
    expect(hasFeature(null as unknown as string, "companyTemplates")).toBe(false);
  });

  test("la carte du plan Pro le mentionne, celle du Business non", () => {
    expect(PLAN_CARD_ITEMS.pro.some(i => i.text === "Templates par entreprise")).toBe(true);
    expect(PLAN_CARD_ITEMS.business.some(i => i.text === "Templates par entreprise")).toBe(false);
  });

  test("la formation d'équipe reste réservée au Business", () => {
    expect(hasFeature("pro", "teamTraining")).toBe(false);
    expect(hasFeature("business", "teamTraining")).toBe(true);
    expect(planDef("business").label).toBe("Business");
  });
});
