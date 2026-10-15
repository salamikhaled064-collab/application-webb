import { describe, it, expect, beforeAll } from "vitest";

let mod: typeof import("../lib/signed-url");

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://x:y@localhost:5432/z";
  process.env.PUBLIC_BASE_URL = "https://api.exemple.test/";
  mod = await import("../lib/signed-url");
});

function parse(url: string) {
  const u = new URL(url);
  return { id: u.pathname.split("/").pop()!, exp: u.searchParams.get("exp"), sig: u.searchParams.get("sig") };
}

describe("URL signée de l'image de départ", () => {
  it("accepte une signature valide", () => {
    const { id, exp, sig } = parse(mod.buildSignedUploadUrl("img123")!);
    expect(mod.verifySignedUpload(id, exp, sig)).toBe(true);
  });
  it("refuse une autre image avec la même signature", () => {
    const { exp, sig } = parse(mod.buildSignedUploadUrl("img123")!);
    expect(mod.verifySignedUpload("autre", exp, sig)).toBe(false);
  });
  it("refuse un lien expiré", () => {
    const { id, sig } = parse(mod.buildSignedUploadUrl("img123", -10)!);
    expect(mod.verifySignedUpload(id, String(Math.floor(Date.now() / 1000) - 10), sig)).toBe(false);
  });
  it("refuse une signature falsifiée ou absente", () => {
    const { id, exp } = parse(mod.buildSignedUploadUrl("img123")!);
    expect(mod.verifySignedUpload(id, exp, "0".repeat(64))).toBe(false);
    expect(mod.verifySignedUpload(id, exp, undefined)).toBe(false);
  });
  it("l'URL utilise l'adresse publique sans double slash", () => {
    expect(mod.buildSignedUploadUrl("a")!.startsWith("https://api.exemple.test/api/public/uploads/a?")).toBe(true);
  });
});
