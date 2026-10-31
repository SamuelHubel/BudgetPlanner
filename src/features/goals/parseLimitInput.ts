import {
  parseAmountInput,
  type ParsedAmount,
} from "../../shared/parseAmountInput";

/** Result of parsing a monthly-limit text field. */
export type ParsedLimit = ParsedAmount;

/**
 * Parses a user-entered monthly limit into integer cents. An empty field means
 * "no limit" and yields `null`.
 */
export function parseLimitInput(text: string): ParsedLimit {
  return parseAmountInput(text, { label: "monthly limit" });
}

/** Formats integer cents as a plain `300.50` string for an editable input. */
export function centsToLimitInput(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return fraction === "00" ? String(whole) : `${whole}.${fraction}`;
}
