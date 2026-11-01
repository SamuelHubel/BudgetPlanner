import type { ReactNode } from "react";

type AlertProps = {
  /** Extra layout classes, such as a top margin. */
  className?: string;
  children: ReactNode;
};

/** Announces an error or warning in the shared alert style. */
export default function Alert({ className = "", children }: AlertProps) {
  return (
    <p
      className={`rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200 ${className}`.trimEnd()}
      role="alert"
    >
      {children}
    </p>
  );
}
