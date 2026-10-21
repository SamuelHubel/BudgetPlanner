const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Formats an integer-cent amount in the requested currency. */
export function formatCurrency(amountCents: number, currency = "USD"): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(amountCents / 100);
}

/** Formats an ISO year-month string for display. */
export function formatMonth(month: string, monthStyle: "long" | "short" = "long"): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: monthStyle,
    year: "numeric",
  });
}
