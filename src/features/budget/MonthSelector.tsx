import Button from "../../shared/Button";
import { formatMonth } from "../../shared/format";
import { shiftMonth } from "./budgetMath";

type MonthSelectorProps = {
  month: string;
  onChange: (month: string) => void;
};

/** Steps the Budget tab between calendar months. */
export default function MonthSelector({ month, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="secondary"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <span aria-hidden="true">←</span>
      </Button>
      <h4 className="text-lg font-semibold text-white">{formatMonth(month)}</h4>
      <Button
        type="button"
        variant="secondary"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <span aria-hidden="true">→</span>
      </Button>
    </div>
  );
}
