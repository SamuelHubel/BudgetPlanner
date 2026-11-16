import { useEffect, useRef, type ReactNode } from "react";

type DialogProps = {
  isOpen: boolean;
  titleId: string;
  descriptionId: string;
  role: "dialog" | "alertdialog";
  className: string;
  onClose: () => void;
  children: ReactNode;
};

/** Presents modal content with native dialog focus behavior. */
export default function Dialog({
  isOpen,
  titleId,
  descriptionId,
  role,
  className,
  onClose,
  children,
}: DialogProps) {
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
      className={`rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/40 ${className}`}
      role={role}
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
