import { describe, expect, test } from "bun:test";
import { availableLessonIds, unavailableLessonCount, latestVersionOf, canRevoke, mustKeepVideo, checkVideoFile, formatEta, formatTotal, groupByModule, isSameUploadTarget, isUploadComplete, MB, normalizeType, quotaOf, shouldRetryTus, tusFingerprint, uploadRate, VIDEO_BUCKET, vtError } from "./videotheque";
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

describe("affichage de l'envoi", () => {
  test("débit sur la fenêtre d'échantillons", () => {
    expect(uploadRate([{ t: 0, sent: 0 }, { t: 2000, sent: 4 * MB }])).toBe(2 * MB);
    expect(uploadRate([{ t: 0, sent: 0 }, { t: 500, sent: MB }])).toBe(0); // moins d'1 s : inconnu
    expect(uploadRate([{ t: 0, sent: 0 }])).toBe(0);
  });
  test("temps restant", () => {
    expect(formatEta(30 * MB, MB)).toBe("30 s");
    expect(formatEta(90 * MB, MB)).toBe("2 min");
    expect(formatEta(MB, 0)).toBeNull();
  });
  test("durée totale d'une formation", () => {
    expect(formatTotal(45 * 60)).toBe("45 min");
    expect(formatTotal(65 * 60)).toBe("1 h 05");
    expect(formatTotal(24)).toBe("< 1 min");
  });
});

describe("P0-1 taille exacte à la finalisation", () => {
  const d = { size: 1000, mime: "video/mp4" };
  test("taille identique acceptée", () => expect(isUploadComplete({ size: 1000, mime: "video/mp4" }, d)).toBe(true));
  test("fichier tronqué refusé", () => expect(isUploadComplete({ size: 999, mime: "video/mp4" }, d)).toBe(false));
  test("fichier plus grand refusé", () => expect(isUploadComplete({ size: 1001, mime: "video/mp4" }, d)).toBe(false));
  test("fichier vide ou absent refusé", () => { expect(isUploadComplete({ size: 0, mime: "video/mp4" }, d)).toBe(false); expect(isUploadComplete(null, d)).toBe(false); });
  test("type différent refusé", () => expect(isUploadComplete({ size: 1000, mime: "video/webm" }, d)).toBe(false));
  test("type générique toléré", () => expect(isUploadComplete({ size: 1000, mime: "application/octet-stream" }, d)).toBe(true));
});

describe("P0-2 identité de reprise TUS", () => {
  const a = "u1/vid-a.mp4", b = "u1/vid-b.mp4";
  test("même fichier, deux vidéos : empreintes différentes", () => expect(tusFingerprint(a)).not.toBe(tusFingerprint(b)));
  test("reprise acceptée seulement vers le même chemin", () => {
    expect(isSameUploadTarget({ metadata: { objectName: a, bucketName: VIDEO_BUCKET } }, a)).toBe(true);
    expect(isSameUploadTarget({ metadata: { objectName: a, bucketName: VIDEO_BUCKET } }, b)).toBe(false);
    expect(isSameUploadTarget({ metadata: { objectName: a, bucketName: "autre" } }, a)).toBe(false);
    expect(isSameUploadTarget({}, a)).toBe(false);
  });
});

describe("P0-3 réessais et session", () => {
  test("401/403 : un seul réessai après rafraîchissement", () => {
    expect(shouldRetryTus(401, 0)).toBe(true); expect(shouldRetryTus(401, 1)).toBe(false); expect(shouldRetryTus(403, 0)).toBe(true);
  });
  test("réseau et serveur : réessai", () => { expect(shouldRetryTus(null, 3)).toBe(true); expect(shouldRetryTus(503, 2)).toBe(true); });
  test("fichier refusé (413/400) : pas de réessai", () => { expect(shouldRetryTus(413, 0)).toBe(false); expect(shouldRetryTus(400, 0)).toBe(false); });
});

describe("Retrait : 7 jours depuis l'acceptation", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
  test("invitation en attente ancienne : retirable", () => expect(canRevoke({ status: "en_attente", created_at: ago(24 * 30) }, now)).toBe(true));
  test("accepté il y a 6 j 23 h : retirable", () => expect(canRevoke({ status: "actif", created_at: ago(24 * 10), accepted_at: ago(24 * 7 - 1) }, now)).toBe(true));
  test("accepté il y a exactement 7 jours : définitif", () => expect(canRevoke({ status: "actif", created_at: ago(24 * 10), accepted_at: ago(24 * 7) }, now)).toBe(false));
  test("partagé il y a 10 j, accepté il y a 2 j : retirable", () => expect(canRevoke({ status: "actif", created_at: ago(240), accepted_at: ago(48) }, now)).toBe(true));
  test("sans date d'acceptation : date du partage", () => expect(canRevoke({ status: "actif", created_at: ago(24 * 8), accepted_at: null }, now)).toBe(false));
});

describe("Vidéos protégées et leçons indisponibles", () => {
  test("dernière version publiée protège la vidéo", () => expect(mustKeepVideo({ lessons: 0, grants: 0, latestVersions: 1 })).toBe(true));
  test("aucune référence : suppression possible", () => expect(mustKeepVideo({ lessons: 0, grants: 0, latestVersions: 0 })).toBe(false));
  test("progression sans la leçon indisponible", () =>
    expect(availableLessonIds([{ lesson_id: "a", video_id: "v1" }, { lesson_id: "b", video_id: "v2" }], new Set(["v1"]))).toEqual(["a"]));
});

describe("Modération limitée à la leçon (option B)", () => {
  const ls = [{ lesson_id: "a", video_id: "v1" }, { lesson_id: "b", video_id: "v2" }, { lesson_id: "c", video_id: "v3" }];
  test("une vidéo retirée rend une seule leçon indisponible", () => expect(unavailableLessonCount(ls, new Set(["v1", "v3"]))).toBe(1));
  test("les autres leçons restent disponibles", () => expect(availableLessonIds(ls, new Set(["v1", "v3"]))).toEqual(["a", "c"]));
  test("aucune vidéo retirée : rien d'indisponible", () => expect(unavailableLessonCount(ls, new Set(["v1", "v2", "v3"]))).toBe(0));
  test("la dernière version publiée est celle au numéro le plus haut", () =>
    expect(latestVersionOf([{ course_id: "c", version: 1 }, { course_id: "c", version: 3 }, { course_id: "d", version: 9 }, { course_id: "c", version: 2 }], "c")?.version).toBe(3));
  test("formation jamais publiée : pas de version", () => expect(latestVersionOf([{ course_id: "d", version: 1 }], "c")).toBeNull());
});
