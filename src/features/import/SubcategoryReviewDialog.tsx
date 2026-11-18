import { useId, useState } from "react";
import type { Category, ImportPreviewRow, Subcategory } from "../../types";
import Button from "../../shared/Button";
import Dialog from "../../shared/Dialog";
import { formatCurrency } from "../../shared/format";

/** One popup's worth of work: a main category and its new rows. */
export type SubcategoryStep = {
  category: Category;
  subcategories: Subcategory[];
  /** Indexes into the full preview, so edits reuse `updateSubcategory`. */
  rowIndexes: number[];
};

/**
 * Lists the categories worth refining, in category order: those with
 * subcategories and at least one new (non-duplicate) row.
 */
export function subcategorySteps(
  transactions: ImportPreviewRow[],
  categories: Category[],
  subcategories: Subcategory[],
): SubcategoryStep[] {
  return categories
    .map((category) => ({
      category,
      subcategories: subcategories.filter(
        (subcategory) => subcategory.categoryId === category.id,
      ),
      rowIndexes: transactions.flatMap((transaction, index) =>
        transaction.categoryId === category.id && !transaction.isDuplicate
          ? [index]
          : [],
      ),
    }))
    .filter(
      (step) => step.subcategories.length > 0 && step.rowIndexes.length > 0,
    );
}

type SubcategoryReviewDialogProps = {
  steps: SubcategoryStep[];
  transactions: ImportPreviewRow[];
  currency: string | null;
  onSubcategoryChange: (index: number, subcategoryId: string) => void;
  onImport: (includeSubcategories: boolean) => void;
  onClose: () => void;
};

/**
 * Asks whether to refine categories, then shows one category's rows at a time.
 * Mount it only while open so each opening starts at the question.
 */
export default function SubcategoryReviewDialog({
  steps,
  transactions,
  currency,
  onSubcategoryChange,
  onImport,
  onClose,
}: SubcategoryReviewDialogProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  // -1 is the "be more specific?" question.
  const [stepIndex, setStepIndex] = useState(-1);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <Dialog
      isOpen
      titleId={titleId}
      descriptionId={descriptionId}
      role="dialog"
      className="w-full max-w-2xl"
      onClose={onClose}
    >
      {step === undefined ? (
        <>
          <h3 className="text-xl font-semibold text-slate-900" id={titleId}>
            Do you want to be more specific?
          </h3>
          <p
            className="mt-3 text-sm leading-6 text-slate-700"
            id={descriptionId}
          >
            You can sort these transactions into subcategories, one category at
            a time.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onImport(false)}
            >
              No, import
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setStepIndex(0)}
            >
              Yes
            </Button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-xl font-semibold text-slate-900" id={titleId}>
            {step.category.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500" id={descriptionId}>
            {stepIndex + 1} of {steps.length}
          </p>
          <ul className="mt-4 max-h-96 divide-y divide-slate-200 overflow-auto rounded-lg border border-slate-200">
            {step.rowIndexes.map((index) => {
              const transaction = transactions[index];
              if (!transaction) return null;
              return (
                <li
                  key={index}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700"
                >
                  <span className="shrink-0 text-slate-500">
                    {transaction.date}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {transaction.description}
                  </span>
                  <span className="shrink-0">
                    {currency
                      ? formatCurrency(transaction.amountCents, currency)
                      : ""}
                  </span>
                  <select
                    className="select-capped rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
                    aria-label={`Subcategory for ${transaction.description}`}
                    value={transaction.subcategoryId ?? ""}
                    onChange={(event) =>
                      onSubcategoryChange(index, event.currentTarget.value)
                    }
                  >
                    <option value="">General</option>
                    {step.subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStepIndex(stepIndex - 1)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() =>
                isLast ? onImport(true) : setStepIndex(stepIndex + 1)
              }
            >
              {isLast ? "Import" : "Next"}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
