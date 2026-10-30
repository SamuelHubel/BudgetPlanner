const LIMIT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Result of parsing a monthly-limit text field. */
export type ParsedLimit =
  { ok: true; cents: number | null } | { ok: false; error: string };

/**
 * Parses a user-entered monthly limit such as `300`, `300.5`, or `300.50`
 * into integer cents. An empty field means "no limit" and yields `null`.
 *
 * Whole and fractional parts are handled as separate integers so no
 * floating-point rounding is involved, and results stay within
 * `Number.MAX_SAFE_INTEGER` so they cross IPC exactly.
 */
export function parseLimitInput(text: string): ParsedLimit {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, cents: null };

  const match = LIMIT_PATTERN.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: "Enter the limit as a number, like 300 or 300.50.",
    };
  }
  const [, whole = "", fraction = ""] = match;
  // BigInt keeps very long inputs exact until the safe-integer check below.
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents === 0n) {
    return { ok: false, error: "The monthly limit must be greater than zero." };
  }
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "The monthly limit is too large." };
  }
  return { ok: true, cents: Number(cents) };
}

/** Formats integer cents as a plain `300.50` string for an editable input. */
export function centsToLimitInput(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return fraction === "00" ? String(whole) : `${whole}.${fraction}`;
}
