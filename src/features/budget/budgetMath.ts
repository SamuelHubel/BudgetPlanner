import type { Budget } from "../../types";

const BASIS_POINTS_PER_WHOLE = 10_000;

/** Slider granularity in basis points: half a percent. */
export const PERCENT_STEP_BASIS_POINTS = 50;

/** Budgeted cents keyed by category id. */
export type AllocationCents = Record<number, number>;

/** Totals for a set of allocations against expected income. */
export type AllocationSummary = {
  allocatedCents: number;
  /** Income left to allocate; zero once fully allocated or over. */
  unallocatedCents: number;
  /** Amount allocated beyond income; zero at 100% or below. */
  overCents: number;
  /** Share of income, to one decimal. Rounds up above 100%, so any overage shows. */
  allocatedPercent: number;
};

/** One filled arc of the budget donut, as fractions of the full ring. */
export type DonutSegment = {
  id: number;
  color: string;
  start: number;
  fraction: number;
};

/**
 * Converts a share of income into cents, rounding down so percents totalling
 * 100% can never add up to more than the income.
 */
export function percentToCents(
  incomeCents: number,
  basisPoints: number,
): number {
  return Number(
    (BigInt(incomeCents) * BigInt(basisPoints)) /
      BigInt(BASIS_POINTS_PER_WHOLE),
  );
}

/** Maps cents to a slider position: the nearest step, at most 100%. */
export function centsToBasisPoints(cents: number, incomeCents: number): number {
  const steps = Math.round(
    ((cents / incomeCents) * BASIS_POINTS_PER_WHOLE) /
      PERCENT_STEP_BASIS_POINTS,
  );
  return Math.min(steps * PERCENT_STEP_BASIS_POINTS, BASIS_POINTS_PER_WHOLE);
}

/**
 * Carries a saved budget or template onto a new income. Percent budgets keep
 * their percents and amount budgets keep their amounts.
 */
export function carryAllocations(
  source: Budget | null,
  incomeCents: number,
): AllocationCents {
  const carried: AllocationCents = {};
  for (const { categoryId, amountCents } of source?.allocations ?? []) {
    carried[categoryId] =
      source?.inputMode === "percent"
        ? percentToCents(
            incomeCents,
            centsToBasisPoints(amountCents, source.expectedIncomeCents),
          )
        : amountCents;
  }
  return carried;
}

/** Totals allocations and compares them with expected income. */
export function summarizeAllocations(
  amounts: number[],
  incomeCents: number,
): AllocationSummary {
  const allocatedCents = amounts.reduce((sum, cents) => sum + cents, 0);
  const overCents = Math.max(0, allocatedCents - incomeCents);
  const income = BigInt(incomeCents);
  const roundingOffset = overCents > 0 ? income - 1n : income / 2n;
  const percentTenths =
    (BigInt(allocatedCents) * 1000n + roundingOffset) / income;
  return {
    allocatedCents,
    unallocatedCents: Math.max(0, incomeCents - allocatedCents),
    overCents,
    allocatedPercent: Number(percentTenths) / 10,
  };
}

/**
 * Lays out positive allocations around the ring. Each arc is a share of income,
 * so the ring fills as categories are allocated; above 100% the arcs scale down
 * together to fit.
 */
export function donutSegments(
  rows: { id: number; color: string; cents: number }[],
  incomeCents: number,
): DonutSegment[] {
  const allocatedCents = rows.reduce((sum, { cents }) => sum + cents, 0);
  const ringCents = Math.max(incomeCents, allocatedCents);
  let start = 0;
  return rows
    .filter(({ cents }) => cents > 0)
    .map(({ id, color, cents }) => {
      const fraction = cents / ringCents;
      const segment = { id, color, start, fraction };
      start += fraction;
      return segment;
    });
}

/** Returns a date's `YYYY-MM` month in local time. */
export function currentMonth(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

/** Moves a `YYYY-MM` month by a number of months. */
export function shiftMonth(month: string, offset: number): string {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return currentMonth(new Date(year, monthNumber - 1 + offset, 1));
}
