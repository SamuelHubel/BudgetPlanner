import { useId, useState } from "react";
import { toErrorMessage } from "../../lib/errors";
import Button from "../../shared/Button";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { formatMonth } from "../../shared/format";

type DeleteBudgetDialogProps = {
  isOpen: boolean;
  month: string;
  /** Deletes the budget; a rejection keeps the dialog open with the error. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

/** Confirms permanent deletion of a month's budget. */
export default function DeleteBudgetDialog({
  isOpen,
  month,
  onConfirm,
  onClose,
}: DeleteBudgetDialogProps) {
  const dialogId = useId();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  const close = () => {
    if (isDeleting) return;
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to delete the budget."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      titleId={titleId}
      descriptionId={descriptionId}
      onClose={close}
    >
      <h3 className="text-xl font-semibold text-white" id={titleId}>
        Delete this budget?
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300" id={descriptionId}>
        Your {formatMonth(month)} budget will be permanently removed. Your
        transactions are not affected.
      </p>
      {error && (
        <p
          className="mt-4 rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={close}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => void confirm()}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete budget"}
        </Button>
      </div>
    </ConfirmDialog>
  );
}
