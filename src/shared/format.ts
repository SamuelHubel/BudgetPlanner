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
export function formatMonth(
  month: string,
  monthStyle: "long" | "short" = "long",
): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (
    !yearText ||
    !monthText ||
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new RangeError(`Invalid year-month value: ${month}`);
  }
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: monthStyle,
    year: "numeric",
  });
}
