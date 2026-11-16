import { describe, expect, test } from "bun:test";
import { COMPARE_ROWS, formatFcfa, landingCardItems } from "./landing-content";

const row = (label: string) => COMPARE_ROWS.find(r => r.label === label)!.cells;

describe("cartes tarifaires de la page d'accueil", () => {
  test("la carte Pro ne présente plus « À relancer » comme un avantage payant", () => {
    expect(landingCardItems("pro").some(i => /relancer/i.test(i.text))).toBe(false);
    expect(landingCardItems("pro").some(i => i.text === "Prospects illimités")).toBe(true);
  });
  test("le support prioritaire Business est présenté comme un service", () => {
    expect(landingCardItems("business").some(i => i.text === "Support prioritaire (service)")).toBe(true);
  });
  test("les fonctions à venir gardent leur badge Bientôt", () => {
    expect(landingCardItems("expert").find(i => i.text === "Rapports hebdomadaires")?.soon).toBe(true);
    expect(landingCardItems("business").find(i => i.text === "WhatsApp Business")?.soon).toBe(true);
  });
  test("prix affichés en FCFA", () => {
    expect(formatFcfa(25000)).toBe("25 000 FCFA");
  });
});

describe("tableau de comparaison", () => {
  test("limites prospects et IA : Gratuit 10 / 5, Pro illimité / 100, Expert et Business 500", () => {
    expect(row("Prospects")).toEqual(["10", "Illimités", "Illimités", "Illimités"]);
    expect(row("Générations IA / mois")).toEqual(["5", "100", "500", "500"]);
  });
  test("statuts 7 par semaine en Gratuit, 60 en payant ; 1 campagne active en Gratuit", () => {
    expect(row("Statuts planifiés / semaine")).toEqual(["7", "60", "60", "60"]);
    expect(row("Campagnes actives")[0]).toBe("1");
  });
  test("vidéothèque dès Pro : 2 / 5 / 15 Go", () => {
    expect(row("Vidéothèque (stockage)")).toEqual([false, "2 Go", "5 Go", "15 Go"]);
  });
  test("statistiques dès Expert, équipe et support réservés à Business", () => {
    expect(row("Statistiques avancées")).toEqual([false, false, true, true]);
    expect(row("Former ton équipe et lui partager tes formations")).toEqual([false, false, false, true]);
    expect(row("Support prioritaire (service)")).toEqual([false, false, false, true]);
  });
  test("relances et WhatsApp assisté disponibles sur tous les forfaits", () => {
    expect(row("Suivi des prospects et écran « À relancer »")).toEqual([true, true, true, true]);
    expect(row("WhatsApp assisté (tu envoies toi-même)")).toEqual([true, true, true, true]);
  });
  test("fonctions à venir jamais présentées comme disponibles", () => {
    expect(row("Rapports hebdomadaires")).toEqual([false, false, "soon", "soon"]);
    expect(row("WhatsApp Business")).toEqual([false, false, false, "soon"]);
  });
});
