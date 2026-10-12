import { detectImageMime, isAllowedImageMime } from "../lib/mime";

describe("mime detection", () => {
  it("detects JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageMime(buf)).toBe("image/jpeg");
  });
  it("detects PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageMime(buf)).toBe("image/png");
  });
  it("rejects random bytes", () => {
    const buf = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(detectImageMime(buf)).toBeNull();
  });
  it("allows known mimes", () => {
    expect(isAllowedImageMime("image/jpeg")).toBe(true);
    expect(isAllowedImageMime("image/svg+xml")).toBe(false);
  });
});
