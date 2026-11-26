import { describe, expect, test } from "bun:test";
import { hasAdStudioSession } from "./ad-studio";
import { announcedAvailability, saveAnalysisNotesSchema } from "./ad-studio.schemas";
import { validatePublicUrl, isBlockedIp, buildReport, extractPage } from "./url-analyzer";

const owner = "da34c34b-7f66-4103-aa6a-d29f8fe3f300";
describe("Ad Studio principal admin MFA", () => {
  test("principal admin with verified second factor is allowed", () => expect(hasAdStudioSession(owner, true, "aal2")).toBe(true));
  test("another admin is refused even with MFA", () => expect(hasAdStudioSession("00000000-0000-0000-0000-000000000001", true, "aal2")).toBe(false));
  test("principal without current admin role is refused", () => expect(hasAdStudioSession(owner, false, "aal2")).toBe(false));
  test("principal without verified second factor is refused", () => {
    expect(hasAdStudioSession(owner, true, "aal1")).toBe(false);
    expect(hasAdStudioSession(owner, true, undefined)).toBe(false);
  });
});
describe("public URL rules", () => {
  test("MLM Boost public HTTPS URL is accepted syntactically", () => expect(validatePublicUrl("https://mlmboostai.app").ok).toBe(true));
  test("private, encoded IP, credentials and unsupported schemes are rejected", () => {
    for (const url of ["http://localhost", "http://127.1", "http://2130706433", "http://[::1]", "http://169.254.169.254", "https://user:password@site.com", "ftp://site.com", "https://host.internal", "https://site.com:8080"]) expect(validatePublicUrl(url).ok).toBe(false);
  });
  test("private and mapped private address ranges are blocked", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1"]) expect(isBlockedIp(ip)).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});
describe("source integrity and draft validation", () => {
  test("development is distinct from future and unknown", () => {
    expect(announcedAvailability("Fonction en cours de développement")).toBe("developpement");
    expect(announcedAvailability("Video coming soon")).toBe("futur");
    expect(announcedAvailability("CRM inclus")).toBe("non_precisee");
  });
  test("pricing alone never confirms feature availability", () => {
    const url = "https://mlmboostai.app";
    const page = extractPage('<section><h2>Forfait Pro</h2><p>5 000 FCFA par mois</p><ul><li>Vidéo privée</li></ul></section>', url);
    const report = buildReport(url, [page], [{ url, ok: true }]);
    expect(report.claims.find((claim) => claim.text === "Vidéo privée")?.status).toBe("a_verifier");
  });
  test("draft writes require nonnegative revision and bounded content", () => {
    expect(saveAnalysisNotesSchema.safeParse({ id: owner, notes: "Positionnement validé", version: 0 }).success).toBe(true);
    expect(saveAnalysisNotesSchema.safeParse({ id: owner, notes: "x".repeat(12001), version: 0 }).success).toBe(false);
    expect(saveAnalysisNotesSchema.safeParse({ id: owner, notes: "test", version: -1 }).success).toBe(false);
  });
});