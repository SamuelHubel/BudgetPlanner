import { formatCurrency } from "../../shared/format";
import type { BudgetInputMode, Category } from "../../types";
import { PERCENT_STEP_BASIS_POINTS } from "./budgetMath";

const BASIS_POINTS_PER_PERCENT = 100;

type AllocationRowProps = {
  category: Category;
  mode: BudgetInputMode;
  /** The row's current allocation in cents. */
  cents: number;
  /** Slider position, used in percent mode. */
  basisPoints: number;
  /** Share of income shown beside a typed amount. */
  percent: number;
  /** Raw field text, used in amount mode. */
  amountText: string;
  isInvalid: boolean;
  currency: string;
  onPercentChange: (basisPoints: number) => void;
  onAmountChange: (text: string) => void;
  onActiveChange: (isActive: boolean) => void;
};

/** One category in the budget builder: a slider or a typed amount. */
export default function AllocationRow({
  category,
  mode,
  cents,
  basisPoints,
  percent,
  amountText,
  isInvalid,
  currency,
  onPercentChange,
  onAmountChange,
  onActiveChange,
}: AllocationRowProps) {
  const percentText = `${basisPoints / BASIS_POINTS_PER_PERCENT}%`;
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 hover:bg-slate-800/50"
      onMouseEnter={() => onActiveChange(true)}
      onMouseLeave={() => onActiveChange(false)}
      onFocus={() => onActiveChange(true)}
      onBlur={() => onActiveChange(false)}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-200">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: category.color ?? "#94a3b8" }}
          aria-hidden="true"
        />
        <span className="truncate">{category.name}</span>
      </span>
      {mode === "percent" ? (
        <>
          <span className="text-sm tabular-nums text-slate-300">
            {percentText} · {formatCurrency(cents, currency)}
          </span>
          <input
            className="col-span-2 w-full accent-cyan-400"
            type="range"
            aria-label={`${category.name} percent`}
            aria-valuetext={`${percentText}, ${formatCurrency(cents, currency)}`}
            min={0}
            max={100}
            step={PERCENT_STEP_BASIS_POINTS / BASIS_POINTS_PER_PERCENT}
            value={basisPoints / BASIS_POINTS_PER_PERCENT}
            onChange={(event) =>
              onPercentChange(
                Math.round(
                  Number(event.target.value) * BASIS_POINTS_PER_PERCENT,
                ),
              )
            }
          />
        </>
      ) : (
        <span className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-slate-400">
            {percent}%
          </span>
          <input
            className={`w-28 rounded-xl border bg-slate-900 px-2 py-1 text-right text-sm tabular-nums text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none ${isInvalid ? "border-rose-500" : "border-slate-700"}`}
            type="text"
            inputMode="decimal"
            aria-label={`${category.name} amount`}
            aria-invalid={isInvalid}
            placeholder="0.00"
            value={amountText}
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </span>
      )}
    </li>
  );
}
