import { describe, expect, test } from "bun:test";
import { AD_STUDIO_MODULES, isAdStudioOwner } from "./ad-studio";

describe("Admin Ad Studio access", () => {
  test("only the principal admin UUID is allowed", () => {
    expect(isAdStudioOwner("da34c34b-7f66-4103-aa6a-d29f8fe3f300")).toBe(true);
    expect(isAdStudioOwner("DA34C34B-7F66-4103-AA6A-D29F8FE3F300")).toBe(true);
  });
  test("any other user, empty or missing id is refused", () => {
    expect(isAdStudioOwner("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(isAdStudioOwner("")).toBe(false);
    expect(isAdStudioOwner(null)).toBe(false);
    expect(isAdStudioOwner("da34c34b-7f66-4103-aa6a-d29f8fe3f300 ")).toBe(false);
  });
  test("every module is marked as coming soon in lot 1", () => {
    expect(AD_STUDIO_MODULES.every((m) => m.status === "a_venir")).toBe(true);
  });
});
