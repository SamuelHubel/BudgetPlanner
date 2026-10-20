const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(amountCents: number): string {
  return currency.format(amountCents / 100);
}

export function formatMonth(month: string, monthStyle: "long" | "short" = "long"): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: monthStyle,
    year: "numeric",
  });
}
