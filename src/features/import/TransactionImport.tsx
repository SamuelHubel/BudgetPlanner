import type { BudgetApiClient } from "../../api/budgetApi";
import Alert from "../../shared/Alert";
import ImportPreviewTable from "./ImportPreviewTable";
import { isAmountFormat, isDateOrder, useImportFlow } from "./useImportFlow";
import Button from "../../shared/Button";

type TransactionImportProps = {
  api: BudgetApiClient;
};

/** Lets the user preview and commit a CSV statement import. */
export default function TransactionImport({ api }: TransactionImportProps) {
  const flow = useImportFlow(api);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Bank statement</p>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">
            Import transactions
          </h4>
        </div>
        <Button
          type="button"
          variant="primary"
          className="px-4 py-2"
          onClick={() => flow.inputRef.current?.click()}
          disabled={flow.isLoading}
        >
          Choose CSV
        </Button>
        <input
          ref={flow.inputRef}
          className="hidden"
          type="file"
          accept=".csv,text/csv"
          aria-label="Choose a CSV file"
          onChange={flow.handleFile}
        />
      </div>
      <p className="mt-3 text-sm text-slate-700">
        Review categories before anything is written to your transactions.
      </p>
      {flow.error && <Alert className="mt-3">{flow.error}</Alert>}
      {flow.needsDateOrder && (
        <label className="mt-3 block text-sm text-slate-700">
          Choose the date order used by this statement
          <select
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
            aria-label="Statement date order"
            value={flow.dateOrder}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isDateOrder(value)) void flow.handleDateOrder(value);
            }}
            disabled={flow.isLoading}
          >
            <option value="auto">Automatic</option>
            <option value="mdy">Month / day / year</option>
            <option value="dmy">Day / month / year</option>
          </select>
        </label>
      )}
      {flow.needsAmountFormat && (
        <label className="mt-3 block text-sm text-slate-700">
          Choose how this statement writes amounts
          <select
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
            aria-label="Statement amount format"
            value={flow.amountFormat}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isAmountFormat(value)) void flow.handleAmountFormat(value);
            }}
            disabled={flow.isLoading}
          >
            <option value="auto">Automatic</option>
            <option value="decimalDot">
              1,234.56 (comma groups thousands)
            </option>
            <option value="decimalComma">
              1.234,56 (comma marks decimals)
            </option>
          </select>
        </label>
      )}
      {flow.status && (
        <p
          className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          role="status"
        >
          {flow.status}
        </p>
      )}
      {flow.transactions.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-slate-900"
                checked={flow.useSubcategories}
                disabled={!flow.canToggleSubcategories}
                onChange={(event) =>
                  void flow.toggleSubcategories(event.currentTarget.checked)
                }
              />
              Use subcategories
            </label>
            {flow.needsCategoryCount > 0 && (
              <p className="text-amber-700">
                {flow.needsCategoryCount === 1
                  ? "1 transaction needs a category"
                  : `${flow.needsCategoryCount} transactions need a category`}
              </p>
            )}
          </div>
          <ImportPreviewTable
            transactions={flow.transactions}
            categories={flow.categories}
            subcategories={flow.subcategories}
            useSubcategories={flow.useSubcategories}
            currency={flow.currency}
            onCategoryChange={flow.updateCategory}
            onSubcategoryChange={flow.updateSubcategory}
          />
          <Button
            type="button"
            variant="primary"
            className="mt-4 px-4 py-2"
            onClick={flow.confirmImport}
            disabled={flow.isLoading || !flow.currency}
          >
            Confirm import
          </Button>
        </>
      )}
    </section>
  );
}
