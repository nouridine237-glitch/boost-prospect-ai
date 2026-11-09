import { describe, expect, test } from "bun:test";
import { canRevoke, checkVideoFile, groupByModule, MB, normalizeType, quotaOf, vtError } from "./videotheque";
import { hasFeature } from "./plans";

const f = (size: number, duration = 60, type = "video/mp4") => ({ size, duration, type, name: "a.mp4" });

describe("Vidéothèque — import à partir du plan Pro", () => {
  test("Gratuit ne peut pas importer", () => {
    expect(hasFeature("gratuit", "videoLibrary")).toBe(false);
    expect(checkVideoFile(f(10 * MB), "gratuit", 0)).toContain("plan Pro");
  });
  test("Pro, Expert et Business peuvent importer", () => {
    for (const p of ["pro", "expert", "business"]) expect(hasFeature(p, "videoLibrary")).toBe(true);
    expect(checkVideoFile(f(10 * MB), "pro", 0)).toBeNull();
  });
  test("taille maximale par plan : 200, 300 et 500 Mo", () => {
    expect(checkVideoFile(f(201 * MB), "pro", 0)).toContain("trop lourde");
    expect(checkVideoFile(f(250 * MB), "expert", 0)).toBeNull();
    expect(checkVideoFile(f(301 * MB), "expert", 0)).toContain("trop lourde");
    expect(checkVideoFile(f(500 * MB), "business", 0)).toBeNull();
  });
  test("espace total : 2, 5 et 15 Go", () => {
    expect(quotaOf("pro").totalBytes).toBe(2 * 1024 * MB);
    expect(quotaOf("expert").totalBytes).toBe(5 * 1024 * MB);
    expect(quotaOf("business").totalBytes).toBe(15 * 1024 * MB);
    expect(checkVideoFile(f(100 * MB), "pro", 2 * 1024 * MB - 50 * MB)).toContain("Espace insuffisant");
  });
  test("formats et durée", () => {
    expect(normalizeType("", "clip.MOV")).toBe("video/quicktime");
    expect(normalizeType("video/x-matroska", "a.mkv")).toBeNull();
    expect(checkVideoFile(f(MB, 3601), "pro", 0)).toContain("60 minutes");
  });
});

describe("Accès durable : retrait volontaire limité à 7 jours", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  test("une invitation en attente peut être retirée", () => {
    expect(canRevoke({ status: "en_attente", created_at: "2026-01-01T00:00:00Z" }, now)).toBe(true);
  });
  test("un accès actif partagé il y a 3 jours peut être retiré", () => {
    expect(canRevoke({ status: "actif", created_at: "2026-11-17T12:00:00Z" }, now)).toBe(true);
  });
  test("au-delà de 7 jours, l'accès est définitif", () => {
    expect(canRevoke({ status: "actif", created_at: "2026-11-12T12:00:00Z" }, now)).toBe(false);
  });
});

test("regroupement par module en gardant l'ordre", () => {
  const g = groupByModule([{ module: "A" }, { module: "A" }, { module: "" }, { module: "A" }]);
  expect(g.map((x) => [x.module, x.items.length])).toEqual([["A", 2], ["", 1], ["A", 1]]);
});

test("erreurs base traduites", () => {
  expect(vtError(new Error("LIMITE_STOCKAGE:2147483648"))).toContain("espace vidéo est plein");
});
