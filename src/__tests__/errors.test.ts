import { describe, expect, it } from "vitest";
import { errorCode, toErrorMessage } from "../shared/errors";

describe("toErrorMessage", () => {
  it("returns an Error message", () => {
    expect(toErrorMessage(new Error("database unavailable"), "fallback")).toBe(
      "database unavailable",
    );
  });

  it("returns a string rejection", () => {
    expect(toErrorMessage("permission denied", "fallback")).toBe(
      "permission denied",
    );
  });

  it("returns the message of a backend error", () => {
    expect(
      toErrorMessage(
        { code: "locked", message: "the app is locked" },
        "fallback",
      ),
    ).toBe("the app is locked");
  });

  it("uses the fallback when no message is available", () => {
    expect(toErrorMessage({ reason: "unknown" }, "fallback")).toBe("fallback");
  });
});

describe("errorCode", () => {
  it("reads the code of a backend error", () => {
    expect(errorCode({ code: "locked", message: "locked" })).toBe("locked");
  });

  it("returns null for errors without a code", () => {
    expect(errorCode("date order is ambiguous")).toBeNull();
    expect(errorCode(new Error("failed"))).toBeNull();
    expect(errorCode(null)).toBeNull();
  });
});
