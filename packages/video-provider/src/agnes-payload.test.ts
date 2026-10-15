/**
 * Corps de requête Agnes Video 2.5 (selon la documentation officielle).
 */
import { describe, it, expect } from "vitest";
import { buildCreatePayload } from "./agnes";

const base = { model: "agnes-video-2.5-flash", prompt: "Une femme présente un produit" };

describe("Agnes payload (Video 2.5 Flash)", () => {
  it("texte seul : mode text, sans first_frame", () => {
    const p = buildCreatePayload({ ...base, seconds: 5, aspectRatio: "9:16" });
    expect(p.mode).toBe("text");
    expect(p).not.toHaveProperty("first_frame");
    expect(p.seconds).toBe("5"); // chaîne, pas nombre
    expect(p.size).toBe("720P");
    expect(p.aspect_ratio).toBe("9:16");
    expect(p.n).toBe(1);
  });

  it("URL vide : ignorée", () => {
    const p = buildCreatePayload({ ...base, seconds: 5, imageUrl: "" });
    expect(p.mode).toBe("text");
    expect(p).not.toHaveProperty("first_frame");
  });

  it("image : mode keyframe avec first_frame", () => {
    const p = buildCreatePayload({ ...base, seconds: 8, imageUrl: "https://x.test/a.png" });
    expect(p.mode).toBe("keyframe");
    expect(p.first_frame).toBe("https://x.test/a.png");
  });

  it("durée bornée entre 4 et 12 secondes", () => {
    expect(buildCreatePayload({ ...base, seconds: 1 }).seconds).toBe("4");
    expect(buildCreatePayload({ ...base, seconds: 3600 }).seconds).toBe("12");
  });
});
