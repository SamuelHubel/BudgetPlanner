import { describe, expect, it } from "vitest";
import { centsToAmountInput, parseAmountInput } from "./parseAmountInput";

describe("parseAmountInput", () => {
  it("treats an empty field as no amount", () => {
    expect(parseAmountInput("  ", { label: "income" })).toEqual({
      ok: true,
      cents: null,
    });
  });

  it("parses amounts into integer cents", () => {
    expect(parseAmountInput("5000.5", { label: "income" })).toEqual({
      ok: true,
      cents: 500050,
    });
  });

  it("names the field in its error messages", () => {
    expect(parseAmountInput("abc", { label: "income" })).toEqual({
      ok: false,
      error: "Enter the income as a number, like 300 or 300.50.",
    });
    expect(parseAmountInput("0", { label: "income" })).toEqual({
      ok: false,
      error: "The income must be greater than zero.",
    });
  });

  it("accepts zero only when allowed", () => {
    expect(
      parseAmountInput("0.00", { label: "amount", allowZero: true }),
    ).toEqual({ ok: true, cents: 0 });
  });

  it("rejects amounts beyond the safe integer range", () => {
    expect(
      parseAmountInput("90071992547409.92", {
        label: "income",
      }),
    ).toEqual({ ok: false, error: "The income is too large." });
    expect(parseAmountInput("90071992547409.91", { label: "income" })).toEqual({
      ok: true,
      cents: Number.MAX_SAFE_INTEGER,
    });
  });

  it("parses fractional amounts without rounding", () => {
    expect(parseAmountInput("0.07", { label: "income" })).toEqual({
      ok: true,
      cents: 7,
    });
  });

  it.each(["-5", "3.333", "1,000", "abc", "1.", ".50", "$300"])(
    "rejects %s",
    (text) => {
      expect(parseAmountInput(text, { label: "income" }).ok).toBe(false);
    },
  );
});

describe("centsToAmountInput", () => {
  it("formats cents for editing without currency symbols", () => {
    expect(centsToAmountInput(null)).toBe("");
    expect(centsToAmountInput(30000)).toBe("300");
    expect(centsToAmountInput(30050)).toBe("300.50");
    expect(centsToAmountInput(7)).toBe("0.07");
  });
});
