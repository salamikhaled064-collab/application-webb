import { describe, it, expect } from "vitest";
/**
 * Run with: npx vitest run (after npm i -D vitest)
 * These tests validate pure functions without DB.
 */
import { encrypt, decrypt, maskKey } from "../lib/crypto";

describe("crypto", () => {
  it("encrypt/decrypt roundtrip", () => {
    const plain = "agnes-test-key-xyz";
    const enc = encrypt(plain);
    expect(enc).not.toContain(plain);
    expect(decrypt(enc)).toBe(plain);
  });
  it("masks keys", () => {
    expect(maskKey("abcdefghijklmnop")).toMatch(/•/);
  });
});
