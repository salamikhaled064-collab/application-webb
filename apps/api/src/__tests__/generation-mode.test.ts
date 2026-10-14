import { describe, it, expect } from "vitest";

/**
 * Characterization tests for mode validation logic
 * (pure logic, no DB required)
 */

const ALLOWED_FORMATS = new Set(["9:16", "16:9", "1:1", "4:5"]);
const ALLOWED_STYLES = new Set(["none", "cinematic", "realistic", "artistic", "dynamic", "anime"]);
const ALLOWED_DURATIONS = new Set([3, 5, 10, 18]);

function validateModeA(body: {
  mode?: string;
  prompt?: string;
  format?: string;
  style?: string;
  durationSeconds?: number;
  imageId?: string;
}) {
  const errors: string[] = [];
  const mode = body.mode || "PROMPT_ONLY";
  if (mode !== "PROMPT_ONLY" && mode !== "IMAGE_TO_VIDEO") errors.push("mode");
  if (!body.prompt || body.prompt.trim().length < 10) errors.push("prompt_short");
  if (body.prompt && body.prompt.length > 1500) errors.push("prompt_long");
  if (!body.format || !ALLOWED_FORMATS.has(body.format)) errors.push("format");
  if (!body.style || !ALLOWED_STYLES.has(body.style)) errors.push("style");
  if (!body.durationSeconds || !ALLOWED_DURATIONS.has(body.durationSeconds))
    errors.push("duration");
  if (mode === "IMAGE_TO_VIDEO" && !body.imageId) errors.push("image_required");
  if (mode === "PROMPT_ONLY" && body.imageId) {
    // imageId ignored for PROMPT_ONLY – not an error
  }
  return errors;
}

describe("PROMPT_ONLY mode validation", () => {
  it("accepts valid prompt-only payload without imageId", () => {
    const errors = validateModeA({
      mode: "PROMPT_ONLY",
      prompt: "Une femme présente un produit dans un studio lumineux.",
      format: "9:16",
      style: "realistic",
      durationSeconds: 5,
    });
    expect(errors).toEqual([]);
  });

  it("rejects short prompt", () => {
    const errors = validateModeA({
      mode: "PROMPT_ONLY",
      prompt: "court",
      format: "9:16",
      style: "realistic",
      durationSeconds: 5,
    });
    expect(errors).toContain("prompt_short");
  });

  it("rejects invalid format", () => {
    const errors = validateModeA({
      mode: "PROMPT_ONLY",
      prompt: "Une description suffisamment longue pour passer.",
      format: "21:9",
      style: "realistic",
      durationSeconds: 5,
    });
    expect(errors).toContain("format");
  });
});

describe("IMAGE_TO_VIDEO mode validation", () => {
  it("requires imageId", () => {
    const errors = validateModeA({
      mode: "IMAGE_TO_VIDEO",
      prompt: "Anime cette image avec un léger zoom.",
      format: "9:16",
      style: "cinematic",
      durationSeconds: 5,
    });
    expect(errors).toContain("image_required");
  });

  it("accepts with imageId", () => {
    const errors = validateModeA({
      mode: "IMAGE_TO_VIDEO",
      prompt: "Anime cette image avec un léger zoom.",
      format: "9:16",
      style: "cinematic",
      durationSeconds: 5,
      imageId: "upload-123",
    });
    expect(errors).toEqual([]);
  });
});
