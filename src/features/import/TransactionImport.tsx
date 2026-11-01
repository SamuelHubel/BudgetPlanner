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
    <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">
            Bank statement
          </p>
          <h4 className="mt-1 text-lg font-semibold text-white">
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
      <p className="mt-3 text-sm text-slate-300">
        Review categories before anything is written to your transactions.
      </p>
      {flow.error && <Alert className="mt-3">{flow.error}</Alert>}
      {flow.needsDateOrder && (
        <label className="mt-3 block text-sm text-slate-300">
          Choose the date order used by this statement
          <select
            className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
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
        <label className="mt-3 block text-sm text-slate-300">
          Choose how this statement writes amounts
          <select
            className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
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
          className="mt-3 rounded-xl bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200"
          role="status"
        >
          {flow.status}
        </p>
      )}
      {flow.transactions.length > 0 && (
        <>
          <ImportPreviewTable
            transactions={flow.transactions}
            categories={flow.categories}
            currency={flow.currency}
            onCategoryChange={flow.updateCategory}
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
