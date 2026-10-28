import { describe, expect, it } from "vitest";
import { formatMonth } from "./format";

describe("formatMonth", () => {
  it("formats a valid year-month value", () => {
    expect(formatMonth("2026-01")).toMatch(/January 2026/);
  });

  it.each(["", "2026", "2026-00", "2026-13", "year-month"])(
    "rejects an invalid year-month value: %s",
    (value) => {
      expect(() => formatMonth(value)).toThrow(RangeError);
    },
  );
});
