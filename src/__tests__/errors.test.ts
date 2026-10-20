import { describe, expect, it } from "vitest";
import { toErrorMessage } from "../lib/errors";

describe("toErrorMessage", () => {
  it("returns an Error message", () => {
    expect(toErrorMessage(new Error("database unavailable"), "fallback")).toBe(
      "database unavailable",
    );
  });

  it("returns a string rejection", () => {
    expect(toErrorMessage("permission denied", "fallback")).toBe("permission denied");
  });

  it("uses the fallback when no message is available", () => {
    expect(toErrorMessage({ reason: "unknown" }, "fallback")).toBe("fallback");
  });
});
