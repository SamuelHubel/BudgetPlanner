import { useState } from "react";
import Button from "../../shared/Button";
import type { Category, Goal, GoalInput } from "../../types";
import DeleteGoalDialog from "./DeleteGoalDialog";
import GoalForm from "./GoalForm";
import GoalProgressDonut from "./GoalProgressDonut";

type GoalCardProps = {
  goal: Goal;
  /** Expense categories, used for the category name and the edit form. */
  categories: Category[];
  currency: string;
  onUpdate: (id: number, input: GoalInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

/**
 * Displays one goal as a bubble with edit, delete, and AI-help actions, and a
 * right-aligned progress donut.
 */
export default function GoalCard({
  goal,
  categories,
  currency,
  onUpdate,
  onDelete,
}: GoalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHelpNoticeVisible, setIsHelpNoticeVisible] = useState(false);
  const categoryName =
    goal.categoryId === null
      ? null
      : (categories.find(({ id }) => id === goal.categoryId)?.name ??
        "Linked category");

  const requestHelp = () => {
    // TODO(ai): Build a prompt from this goal (and, with the user's consent,
    // relevant spending totals), send it through a Rust command to the local
    // model, and show the response with the disclosure below. Until then this
    // only explains what the feature will do.
    setIsHelpNoticeVisible(true);
  };

  return (
    <li className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <GoalForm
              categories={categories}
              initialValue={goal}
              submitLabel="Save goal"
              onSubmit={async (input) => {
                await onUpdate(goal.id, input);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                {goal.title}
              </p>
              {categoryName && (
                <p className="mt-1 text-xs text-slate-400">
                  Tracking {categoryName} spending each month
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Button type="button" variant="primary" onClick={requestHelp}>
                  Help me meet this
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                  aria-label={`Edit goal: ${goal.title}`}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setIsDeleteOpen(true)}
                  aria-label={`Delete goal: ${goal.title}`}
                >
                  Delete
                </Button>
              </div>
              {isHelpNoticeVisible && (
                <p
                  className="mt-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300"
                  role="status"
                >
                  AI help isn&apos;t available yet. When it is, you&apos;ll be
                  shown exactly what is shared with the model, and its
                  suggestions will be general information, not professional
                  financial advice.
                </p>
              )}
            </>
          )}
        </div>
        <GoalProgressDonut
          progress={goal.progress}
          categoryName={categoryName}
          currency={currency}
        />
      </div>
      <DeleteGoalDialog
        isOpen={isDeleteOpen}
        goalId={goal.id}
        goalTitle={goal.title}
        onConfirm={() => onDelete(goal.id)}
        onClose={() => setIsDeleteOpen(false)}
      />
    </li>
  );
}
