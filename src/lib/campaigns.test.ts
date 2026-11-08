import { describe, expect, test } from "bun:test";
import { bestCampaign, campaignDbError, campaignMetrics, canCreateActive, filterCampaigns, emptyCampaignFilters, isActive, phase, recommendations, validateCampaign, type Campaign } from "./campaigns";

const base: Campaign = { id: "c1", name: "Lancement", objective: "produit", channel: "whatsapp", starts_on: "2026-11-01", ends_on: "2026-11-15", note: "", archived: false };

describe("campagnes", () => {
  test("validation", () => {
    expect(validateCampaign(base)).toBeNull();
    expect(validateCampaign({ ...base, name: "  " })).not.toBeNull();
    expect(validateCampaign({ ...base, name: "x".repeat(81) })).not.toBeNull();
    expect(validateCampaign({ ...base, channel: "tiktok" })).not.toBeNull();
    expect(validateCampaign({ ...base, objective: "argent" })).not.toBeNull();
    expect(validateCampaign({ ...base, ends_on: "2026-10-31" })).not.toBeNull();
    expect(validateCampaign({ ...base, note: "x".repeat(501) })).not.toBeNull();
  });
  test("période active", () => {
    expect(isActive(base, "2026-11-15")).toBe(true);
    expect(isActive(base, "2026-11-16")).toBe(false);
    expect(isActive({ ...base, archived: true }, "2026-11-10")).toBe(false);
    expect(phase(base, "2026-10-20")).toBe("a_venir");
  });
  test("Gratuit : 1 campagne active ; payant illimité", () => {
    expect(canCreateActive([], "gratuit", "2026-11-10")).toBe(true);
    expect(canCreateActive([base], "gratuit", "2026-11-10")).toBe(false);
    expect(canCreateActive([base], "gratuit", "2026-11-20")).toBe(true);
    expect(canCreateActive([base], "gratuit", "2026-11-10", "c1")).toBe(true);
    expect(canCreateActive([base, { ...base, id: "c2" }], "pro", "2026-11-10")).toBe(true);
  });
  test("indicateurs : seuls les éléments attribués comptent", () => {
    const posts = [{ id: "p1", status: "publie", campaign_id: "c1", published_at: "x" }, { id: "p2", status: "prevu", campaign_id: "c1", published_at: null }, { id: "p3", status: "publie", campaign_id: null, published_at: "x" }];
    const pros = [{ id: "a", status: "client", campaign_id: "c1" }, { id: "b", status: "nouveau", campaign_id: "c1", joined_team_at: "x" }, { id: "c", status: "client", campaign_id: null }];
    expect(campaignMetrics("c1", posts, pros)).toEqual({ published: 1, prospects: 2, clients: 1, joined: 1, rate: 50 });
    expect(campaignMetrics("c1", [], []).rate).toBeNull();
    expect(campaignMetrics("c1", [], [{ id: "a", status: "client", campaign_id: "c1" }, { id: "b", status: "x", campaign_id: "c1" }, { id: "c", status: "x", campaign_id: "c1" }]).rate).toBe(33.3);
  });
  test("recommandations et seuil de 5", () => {
    const m0 = { published: 0, prospects: 0, clients: 0, joined: 0, rate: null };
    expect(recommendations(base, m0, [], "2026-11-05").map(r => r.id)).toEqual(["publier"]);
    expect(recommendations(base, { ...m0, published: 2 }, [], "2026-11-05").map(r => r.id)).toEqual(["attribuer"]);
    expect(recommendations(base, { ...m0, published: 1, prospects: 4, rate: 0 }, [], "2026-11-05")).toEqual([]);
    expect(recommendations(base, { ...m0, published: 1, prospects: 5, rate: 0 }, [], "2026-11-05").map(r => r.id)).toEqual(["objections"]);
    const warm = [{ id: "a", status: "discussion", campaign_id: "c1" }];
    expect(recommendations(base, { ...m0, published: 1, prospects: 1, rate: 0 }, warm, "2026-11-13").map(r => r.id)).toEqual(["relancer"]);
    const row = (id: string, prospects: number, clients: number) => ({ campaign: { ...base, id, name: id }, m: { ...m0, prospects, clients, rate: prospects ? clients / prospects * 100 : null } });
    expect(bestCampaign([row("A", 5, 1), row("B", 4, 4)])).toBeNull();
    expect(bestCampaign([row("A", 5, 1), row("B", 6, 3)])?.name).toBe("B");
  });
  test("filtres période / canal", () => {
    const list = [base, { ...base, id: "c2", channel: "facebook", starts_on: "2026-12-01", ends_on: "2026-12-10" }, { ...base, id: "c3", ends_on: "2026-11-02" }, { ...base, id: "c4", archived: true }];
    expect(filterCampaigns(list, emptyCampaignFilters, "2026-11-05").map(c => c.id)).toEqual(["c1", "c2"]);
    expect(filterCampaigns(list, { ...emptyCampaignFilters, phase: "toutes", channel: "facebook" }, "2026-11-05").map(c => c.id)).toEqual(["c2"]);
    expect(filterCampaigns(list, { ...emptyCampaignFilters, phase: "terminees" }, "2026-11-05").map(c => c.id)).toEqual(["c3"]);
    expect(filterCampaigns(list, { ...emptyCampaignFilters, phase: "toutes", from: "2026-11-20" }, "2026-11-05").map(c => c.id)).toEqual(["c2"]);
    expect(filterCampaigns(list, { ...emptyCampaignFilters, phase: "archivees" }, "2026-11-05").map(c => c.id)).toEqual(["c4"]);
  });
  test("erreurs base traduites", () => {
    expect(campaignDbError("LIMITE_CAMPAGNES:1")).toContain("1 campagne");
    expect(campaignDbError("CONTENU_INVALIDE")).toContain("publié");
  });
});

import { routeRequest } from "./command-center";
test("Centre de commande : « campagne » mène au suivi des campagnes", () => {
  expect(routeRequest("voir ma campagne de novembre", "gratuit")[0]).toMatchObject({ kind: "page", to: "/campagnes" });
});
