import { useId, useState, type ReactNode } from "react";
import Alert from "./Alert";
import Button from "./Button";
import Dialog from "./Dialog";
import { toErrorMessage } from "./errors";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  /** Label of the destructive button. */
  confirmLabel: string;
  /** Label of the destructive button while `onConfirm` runs. */
  pendingLabel: string;
  /** Shown when `onConfirm` rejects without a usable message. */
  errorFallback: string;
  /** Text the user must type to enable the action, for irreversible erasure. */
  confirmationPhrase?: string;
  /** Runs the action; a rejection keeps the dialog open with the error. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

/**
 * Asks before a destructive action. Cancel takes initial focus so a stray Enter
 * can't confirm, and closing is blocked while the action runs.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  pendingLabel,
  errorFallback,
  confirmationPhrase,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogId = useId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typedPhrase, setTypedPhrase] = useState("");
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const isPhraseMissing =
    confirmationPhrase !== undefined && typedPhrase !== confirmationPhrase;

  const close = () => {
    if (isPending) return;
    setError(null);
    setTypedPhrase("");
    onClose();
  };

  const confirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      await onConfirm();
      setTypedPhrase("");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, errorFallback));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      titleId={titleId}
      descriptionId={descriptionId}
      role="alertdialog"
      className="w-full max-w-lg"
      onClose={close}
    >
      <h3 className="text-xl font-semibold text-white" id={titleId}>
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300" id={descriptionId}>
        {description}
      </p>
      {confirmationPhrase !== undefined && (
        <div className="mt-4 space-y-1">
          <label
            className="text-sm font-medium text-slate-300"
            htmlFor={`${dialogId}-phrase`}
          >
            Type {confirmationPhrase} to confirm
          </label>
          <input
            id={`${dialogId}-phrase`}
            className="block w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            autoComplete="off"
            value={typedPhrase}
            onChange={(event) => setTypedPhrase(event.target.value)}
            disabled={isPending}
          />
        </div>
      )}
      {error && <Alert className="mt-4">{error}</Alert>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={close}
          disabled={isPending}
          autoFocus
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => void confirm()}
          disabled={isPending || isPhraseMissing}
        >
          {isPending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
