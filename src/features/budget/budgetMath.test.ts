import { describe, expect, it } from "vitest";
import type { Budget } from "../../types";
import {
  carryAllocations,
  centsToBasisPoints,
  currentMonth,
  donutSegments,
  percentToCents,
  shiftMonth,
  summarizeAllocations,
} from "./budgetMath";

function budget(overrides: Partial<Budget>): Budget {
  return {
    month: "2026-09",
    expectedIncomeCents: 500000,
    inputMode: "percent",
    allocations: [],
    ...overrides,
  };
}

describe("percentToCents", () => {
  it("converts basis points of income into cents", () => {
    expect(percentToCents(500000, 3000)).toBe(150000);
    expect(percentToCents(500000, 1250)).toBe(62500);
  });

  it("rounds down so percents totalling 100% never exceed income", () => {
    const income = 33333;
    const shares = [3350, 3350, 3300];

    const total = shares.reduce(
      (sum, share) => sum + percentToCents(income, share),
      0,
    );

    expect(percentToCents(income, 3350)).toBe(11166);
    expect(total).toBeLessThanOrEqual(income);
  });

  it("stays exact beyond the range of float multiplication", () => {
    expect(percentToCents(Number.MAX_SAFE_INTEGER, 10000)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe("centsToBasisPoints", () => {
  it("snaps to the half-percent slider step", () => {
    expect(centsToBasisPoints(150000, 500000)).toBe(3000);
    expect(centsToBasisPoints(151200, 500000)).toBe(3000);
    expect(centsToBasisPoints(151300, 500000)).toBe(3050);
  });

  it("recovers the slider value after floor rounding", () => {
    expect(centsToBasisPoints(percentToCents(33333, 3350), 33333)).toBe(3350);
  });

  it("caps at the slider maximum", () => {
    expect(centsToBasisPoints(600000, 500000)).toBe(10000);
  });
});

describe("carryAllocations", () => {
  it("starts empty without a source budget", () => {
    expect(carryAllocations(null, 500000)).toEqual({});
  });

  it("keeps percents for percent budgets when income changes", () => {
    const source = budget({
      allocations: [{ categoryId: 1, amountCents: 150000 }],
    });

    expect(carryAllocations(source, 600000)).toEqual({ 1: 180000 });
  });

  it("keeps amounts for amount budgets when income changes", () => {
    const source = budget({
      inputMode: "amount",
      allocations: [{ categoryId: 1, amountCents: 123456 }],
    });

    expect(carryAllocations(source, 600000)).toEqual({ 1: 123456 });
  });

  it("leaves percent budgets unchanged when income is unchanged", () => {
    const source = budget({
      expectedIncomeCents: 33333,
      allocations: [{ categoryId: 1, amountCents: 11166 }],
    });

    expect(carryAllocations(source, 33333)).toEqual({ 1: 11166 });
  });
});

describe("summarizeAllocations", () => {
  it("reports allocated, unallocated, and percent totals", () => {
    expect(summarizeAllocations([150000, 60000], 500000)).toEqual({
      allocatedCents: 210000,
      unallocatedCents: 290000,
      overCents: 0,
      allocatedPercent: 42,
    });
  });

  it("is not over budget at exactly 100%", () => {
    expect(summarizeAllocations([500000], 500000)).toMatchObject({
      overCents: 0,
      unallocatedCents: 0,
      allocatedPercent: 100,
    });
  });

  it("reports the overage above 100%", () => {
    expect(summarizeAllocations([560000], 500000)).toEqual({
      allocatedCents: 560000,
      unallocatedCents: 0,
      overCents: 60000,
      allocatedPercent: 112,
    });
  });

  it("never rounds a small overage down to 100%", () => {
    expect(
      summarizeAllocations([500001], 500000).allocatedPercent,
    ).toBeGreaterThan(100);
  });
});

describe("donutSegments", () => {
  const rows = [
    { id: 1, color: "#111111", cents: 250000 },
    { id: 2, color: "#222222", cents: 0 },
    { id: 3, color: "#333333", cents: 125000 },
  ];

  it("maps amounts onto the ring as shares of income", () => {
    expect(donutSegments(rows, 500000)).toEqual([
      { id: 1, color: "#111111", start: 0, fraction: 0.5 },
      { id: 3, color: "#333333", start: 0.5, fraction: 0.25 },
    ]);
  });

  it("scales segments to fit the ring above 100%", () => {
    const segments = donutSegments(rows, 250000);

    expect(segments.map(({ fraction }) => fraction)).toEqual([
      250000 / 375000,
      125000 / 375000,
    ]);
    expect(segments.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1);
  });
});

describe("month helpers", () => {
  it("formats the current month from local time", () => {
    expect(currentMonth(new Date(2026, 9, 30))).toBe("2026-10");
    expect(currentMonth(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("moves across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-05", 1)).toBe("2026-06");
  });
});
