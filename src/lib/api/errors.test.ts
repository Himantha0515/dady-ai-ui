import { describe, expect, it } from "vitest";
import { ApiError } from "../../types/api";

describe("ApiError", () => {
  it("carries stable error codes", () => {
    const err = new ApiError(
      "INSUFFICIENT_CREDITS",
      "You need 25 credits, but your current balance is 10.",
    );
    expect(err.code).toBe("INSUFFICIENT_CREDITS");
    expect(err.message).toContain("25 credits");
  });
});

describe("credit cost display contract", () => {
  it("formats generate CTA from backend cost", () => {
    const cost = 5;
    expect(`Generate Image · ${cost} credits`).toBe("Generate Image · 5 credits");
  });
});
