import { useState } from "react";
import type { CategoryTotal } from "../../types";
import Button from "../../shared/Button";
import { NEUTRAL_SEGMENT_COLOR } from "../../shared/Donut";
import { formatCurrency } from "../../shared/format";
import DonutPanel, { type DonutItem } from "./DonutPanel";

const UNCATEGORIZED_ID = -1;
const GENERAL_ID = -1;

type SummaryDonutProps = {
  title: string;
  categories: CategoryTotal[];
  uncategorizedCents: number;
  currency: string;
  /** Whether a main category can open a donut of its subcategories. */
  showSubcategories: boolean;
};

/** Converts a category's subcategory shares into donut slices. */
function subcategoryItems(category: CategoryTotal): DonutItem[] {
  return category.subcategories.map(
    ({ subcategoryId, name, color, amountCents }) => ({
      id: subcategoryId ?? GENERAL_ID,
      name,
      color: subcategoryId === null ? NEUTRAL_SEGMENT_COLOR : color,
      amountCents,
    }),
  );
}

/** Displays category totals as a donut that can drill into subcategories. */
export default function SummaryDonut({
  title,
  categories,
  uncategorizedCents,
  currency,
  showSubcategories,
}: SummaryDonutProps) {
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null);
  const openCategory = showSubcategories
    ? categories.find(({ category }) => category.id === openCategoryId)
    : undefined;

  const mainItems: DonutItem[] = [
    ...categories.map(({ category, amountCents, subcategories }) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      amountCents,
      canOpen:
        showSubcategories &&
        subcategories.some(({ subcategoryId }) => subcategoryId !== null),
    })),
    ...(uncategorizedCents === 0
      ? []
      : [
          {
            id: UNCATEGORIZED_ID,
            name: "Uncategorized",
            color: NEUTRAL_SEGMENT_COLOR,
            amountCents: uncategorizedCents,
          },
        ]),
  ];
  const items = openCategory ? subcategoryItems(openCategory) : mainItems;
  const heading = openCategory ? openCategory.category.name : title;
  const total = items.reduce((sum, item) => sum + item.amountCents, 0);
  const headingId = `${title.toLowerCase()}-chart-title`;

  return (
    <section
      className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/80 p-4"
      aria-labelledby={headingId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {openCategory && (
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-sm"
              aria-label={`Back to ${title}`}
              onClick={() => setOpenCategoryId(null)}
            >
              ← Back
            </Button>
          )}
          <h4
            className="mt-1 truncate text-lg font-semibold text-white"
            id={headingId}
          >
            {heading}
          </h4>
        </div>
        <strong className="text-lg text-white">
          {formatCurrency(total, currency)}
        </strong>
      </div>
      <DonutPanel
        key={openCategory?.category.id ?? "main"}
        title={heading}
        items={items}
        total={total}
        currency={currency}
        onOpen={setOpenCategoryId}
      />
    </section>
  );
}
