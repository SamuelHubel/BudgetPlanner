import { describe, expect, it } from "vitest";
import { centsToLimitInput, parseLimitInput } from "./parseLimitInput";

describe("parseLimitInput", () => {
  it("treats an empty field as no limit", () => {
    expect(parseLimitInput("")).toEqual({ ok: true, cents: null });
    expect(parseLimitInput("   ")).toEqual({ ok: true, cents: null });
  });

  it("parses whole and fractional amounts into integer cents", () => {
    expect(parseLimitInput("300")).toEqual({ ok: true, cents: 30000 });
    expect(parseLimitInput(" 300.5 ")).toEqual({ ok: true, cents: 30050 });
    expect(parseLimitInput("0.07")).toEqual({ ok: true, cents: 7 });
  });

  it.each(["-5", "3.333", "1,000", "abc", "1.", ".50", "$300"])(
    "rejects %s",
    (text) => {
      expect(parseLimitInput(text).ok).toBe(false);
    },
  );

  it("rejects zero and amounts beyond the safe integer range", () => {
    expect(parseLimitInput("0")).toMatchObject({ ok: false });
    expect(parseLimitInput("0.00")).toMatchObject({ ok: false });
    expect(parseLimitInput("90071992547409.91")).toEqual({
      ok: true,
      cents: Number.MAX_SAFE_INTEGER,
    });
    expect(parseLimitInput("90071992547409.92")).toMatchObject({ ok: false });
  });
});

describe("centsToLimitInput", () => {
  it("formats cents for editing without currency symbols", () => {
    expect(centsToLimitInput(null)).toBe("");
    expect(centsToLimitInput(30000)).toBe("300");
    expect(centsToLimitInput(30050)).toBe("300.50");
    expect(centsToLimitInput(7)).toBe("0.07");
  });
});
