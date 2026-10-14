/**
 * Unit test: PROMPT_ONLY payload must not include image key
 */
import { describe, it, expect } from "vitest";

function buildCreatePayload(request: {
  model: string;
  prompt: string;
  image?: string;
  width: number;
  height: number;
  numFrames: number;
  frameRate: number;
}) {
  const payload: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    num_frames: request.numFrames,
    frame_rate: request.frameRate,
  };
  if (request.image && request.image.length > 0) {
    payload.image = request.image;
  }
  return payload;
}

describe("Agnes payload", () => {
  it("PROMPT_ONLY: no image property", () => {
    const p = buildCreatePayload({
      model: "agnes-video-v2.0",
      prompt: "Une femme présente un produit",
      width: 704,
      height: 1280,
      numFrames: 121,
      frameRate: 24,
    });
    expect(p).not.toHaveProperty("image");
    expect(Object.keys(p)).not.toContain("image");
  });

  it("PROMPT_ONLY: empty string image is omitted", () => {
    const p = buildCreatePayload({
      model: "agnes-video-v2.0",
      prompt: "Test",
      image: "",
      width: 704,
      height: 1280,
      numFrames: 121,
      frameRate: 24,
    });
    expect(p).not.toHaveProperty("image");
  });

  it("IMAGE_TO_VIDEO: includes image when present", () => {
    const p = buildCreatePayload({
      model: "agnes-video-v2.0",
      prompt: "Anime cette image",
      image: "data:image/png;base64,abc",
      width: 704,
      height: 1280,
      numFrames: 121,
      frameRate: 24,
    });
    expect(p.image).toBe("data:image/png;base64,abc");
  });
});
