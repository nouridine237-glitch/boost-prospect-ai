import { describe, expect, it } from "bun:test";
import { canAccessCourse, canPublishCourse, parseYouTubeId } from "./academy-video-rules";

describe("canAccessCourse", () => {
  it("un cours Pro est fermé au gratuit", () => expect(canAccessCourse("gratuit", "pro")).toBe(false));
  it("un cours Pro est ouvert à Pro, Expert et Business", () => {
    expect(["pro", "expert", "business"].every((p) => canAccessCourse(p, "pro"))).toBe(true);
  });
  it("un cours Business est fermé à Expert", () => expect(canAccessCourse("expert", "business")).toBe(false));
  it("un cours gratuit est ouvert à tous", () => expect(canAccessCourse("gratuit", "gratuit")).toBe(true));
});

describe("parseYouTubeId", () => {
  it("lit les formats courants", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("refuse les autres sites", () => expect(parseYouTubeId("https://vimeo.com/dQw4w9WgXcQ")).toBeNull());
});

describe("canPublishCourse", () => {
  const ext = { source_type: "externe", source_author: "Auteur", authorization_note: "Accord écrit", authorized_at: "2026-11-01" };
  it("formation externe sans autorisation refusée", () => expect(canPublishCourse({ ...ext, authorized_at: null })).toBe(false));
  it("formation externe autorisée acceptée", () => expect(canPublishCourse(ext)).toBe(true));
  it("formation interne toujours publiable", () => expect(canPublishCourse({ ...ext, source_type: "interne", source_author: "", authorization_note: "", authorized_at: null })).toBe(true));
});
