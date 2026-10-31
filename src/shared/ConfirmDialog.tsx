import type { ReactNode } from "react";
import Dialog from "./Dialog";

type ConfirmDialogProps = {
  isOpen: boolean;
  titleId: string;
  descriptionId: string;
  onClose: () => void;
  children: ReactNode;
};

/** Presents modal confirmation content with native dialog focus behavior. */
export default function ConfirmDialog(props: ConfirmDialogProps) {
  return <Dialog {...props} role="alertdialog" className="w-full max-w-lg" />;
}
