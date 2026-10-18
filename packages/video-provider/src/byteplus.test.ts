/**
 * Corps de requête BytePlus Seedance (selon la documentation officielle).
 */
import { describe, it, expect } from "vitest";
import { buildBytePlusPayload, BytePlusVideoProvider } from "./byteplus";

const cfg = {
  model: "seedance-1-5-pro-251215",
  baseUrl: "http://localhost:3997/api/v3",
  resolution: "720p",
  generateAudio: false,
  watermark: false,
  requestTimeoutMs: 5000,
  resultTimeoutMs: 5000,
};
const base = { model: "seedance-1-5-pro-251215", prompt: "Une femme présente un produit" };

describe("BytePlus payload", () => {
  it("texte seul : un seul bloc texte, pas d'image", () => {
    const p: any = buildBytePlusPayload({ ...base, seconds: 6, aspectRatio: "9:16" }, cfg);
    expect(p.content).toHaveLength(1);
    expect(p.content[0].type).toBe("text");
    expect(p.ratio).toBe("9:16");
    expect(p.duration).toBe(6);
    expect(p.resolution).toBe("720p");
    expect(p.generate_audio).toBe(false);
    expect(p.watermark).toBe(false);
  });

  it("image : bloc image_url avec role first_frame (base64 prioritaire)", () => {
    const p: any = buildBytePlusPayload(
      { ...base, seconds: 5, imageDataUrl: "data:image/png;base64,AAA", imageUrl: "https://x/a.png" },
      cfg
    );
    expect(p.content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAA" },
      role: "first_frame",
    });
  });

  it("durée bornée 4–12", () => {
    expect((buildBytePlusPayload({ ...base, seconds: 1 }, cfg) as any).duration).toBe(4);
    expect((buildBytePlusPayload({ ...base, seconds: 99 }, cfg) as any).duration).toBe(12);
  });

  it("generate_audio absent pour les modèles qui ne le supportent pas", () => {
    const p: any = buildBytePlusPayload({ ...base, model: "seedance-1-0-pro-250528", seconds: 5 }, cfg);
    expect(p.model).toBe("seedance-1-0-pro-250528"); // le modèle demandé prime sur celui de la config
    expect(p).not.toHaveProperty("generate_audio");
  });

  it("construit sans erreur", () => {
    expect(new BytePlusVideoProvider(cfg).name).toBe("byteplus");
  });
});
