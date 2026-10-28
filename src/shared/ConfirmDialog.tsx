import { useEffect, useRef, type ReactNode } from "react";

type ConfirmDialogProps = {
  isOpen: boolean;
  titleId: string;
  descriptionId: string;
  onClose: () => void;
  children: ReactNode;
};

/** Presents modal confirmation content with native dialog focus behavior. */
export default function ConfirmDialog({
  isOpen,
  titleId,
  descriptionId,
  onClose,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
