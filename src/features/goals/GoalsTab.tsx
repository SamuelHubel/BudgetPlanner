import type { BudgetApiClient } from "../../api/budgetApi";
import { useFinancialSummary } from "../home/useFinancialSummary";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";
import { useGoals } from "./useGoals";

type GoalsTabProps = {
  api: BudgetApiClient;
};

/** Lets users write, edit, and track financial goals, newest first. */
export default function GoalsTab({ api }: GoalsTabProps) {
  const {
    goals,
    categories,
    error,
    isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
  } = useGoals(api);
  const { currency } = useFinancialSummary();
  const displayCurrency = currency ?? "USD";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">Goals</h3>
        <p className="text-sm text-slate-400">
          Write down what you want to change. Link a goal to a spending category
          and monthly limit to track it against your imported transactions.
        </p>
      </div>

      <section
        className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4"
        aria-label="Add a goal"
      >
        <GoalForm
          categories={categories}
          submitLabel="Add goal"
          onSubmit={createGoal}
          resetOnSubmit
        />
      </section>

      {error && (
        <p
          className="rounded-xl bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          Unable to load goals: {error}
        </p>
      )}
      {isLoading && (
        <p className="py-3 text-sm text-slate-400" role="status">
          Loading goals…
        </p>
      )}
      {!isLoading &&
        !error &&
        (goals.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">
            No goals yet. Add your first one above.
          </p>
        ) : (
          <ol className="space-y-3" aria-label="Your goals">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                categories={categories}
                currency={displayCurrency}
                onUpdate={updateGoal}
                onDelete={deleteGoal}
              />
            ))}
          </ol>
        ))}
    </div>
  );
}
