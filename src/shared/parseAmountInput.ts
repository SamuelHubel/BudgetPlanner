const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Result of parsing a money text field. */
export type ParsedAmount =
  { ok: true; cents: number | null } | { ok: false; error: string };

/** Options for {@link parseAmountInput}. */
export type ParseAmountOptions = {
  /** Field name used in error messages, such as `income`. */
  label: string;
  /** Accepts zero as a value instead of reporting an error. */
  allowZero?: boolean;
};

/**
 * Parses a user-entered amount such as `300`, `300.5`, or `300.50` into
 * integer cents. An empty field yields `null`.
 *
 * Whole and fractional parts are handled as separate integers so no
 * floating-point rounding is involved, and results stay within
 * `Number.MAX_SAFE_INTEGER` so they cross IPC exactly.
 */
export function parseAmountInput(
  text: string,
  { label, allowZero = false }: ParseAmountOptions,
): ParsedAmount {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, cents: null };

  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: `Enter the ${label} as a number, like 300 or 300.50.`,
    };
  }
  const [, whole = "", fraction = ""] = match;
  // BigInt keeps very long inputs exact until the safe-integer check below.
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents === 0n && !allowZero) {
    return { ok: false, error: `The ${label} must be greater than zero.` };
  }
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: `The ${label} is too large.` };
  }
  return { ok: true, cents: Number(cents) };
}
