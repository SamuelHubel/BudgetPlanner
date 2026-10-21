import type { ButtonHTMLAttributes } from "react";

/** Semantic visual treatment for a button action. */
export type ButtonVariant = "primary" | "secondary" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: ButtonVariant;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
  secondary: "bg-slate-800 text-slate-300 hover:bg-slate-700",
  danger:
    "border border-rose-800 bg-rose-950/70 text-rose-200 hover:bg-rose-900",
};

/** Renders a button using the shared semantic action variants. */
export default function Button({
  variant,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
