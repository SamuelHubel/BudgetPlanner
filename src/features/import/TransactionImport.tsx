import type { BudgetApiClient } from "../../api/budgetApi";
import ImportPreviewTable from "./ImportPreviewTable";
import { isDateOrder, useImportFlow } from "./useImportFlow";

type TransactionImportProps = {
  api: BudgetApiClient;
  onImported?: () => void;
};

export default function TransactionImport({ api, onImported }: TransactionImportProps) {
  const flow = useImportFlow(api, onImported);
  return (
    <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Bank statement</p>
          <h4 className="mt-1 text-lg font-semibold text-white">Import transactions</h4>
        </div>
        <button
          type="button"
          className="inline-flex justify-center rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => flow.inputRef.current?.click()}
          disabled={flow.isLoading}
        >
          Choose CSV
        </button>
        <input ref={flow.inputRef} className="hidden" type="file" accept=".csv,text/csv" aria-label="Choose a CSV file" onChange={flow.handleFile} />
      </div>
      <p className="mt-3 text-sm text-slate-300">Review categories before anything is written to your transactions.</p>
      {flow.error && <p className="mt-3 rounded-xl bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert">{flow.error}</p>}
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
      {flow.status && <p className="mt-3 rounded-xl bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200" role="status">{flow.status}</p>}
      {flow.transactions.length > 0 && (
        <>
          <ImportPreviewTable
            transactions={flow.transactions}
            categories={flow.categories}
            currency={flow.currency}
            onCategoryChange={flow.updateCategory}
          />
          <button
            type="button"
            className="mt-4 inline-flex justify-center rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={flow.confirmImport}
            disabled={flow.isLoading || !flow.currency}
          >
            Confirm import
          </button>
        </>
      )}
    </section>
  );
}
