export type ParsedTransaction = {
  date: string;
  description: string;
  amountCents: number;
  categoryName: string | null;
  categoryId: number | null;
};

const headerAliases = {
  date: ["date", "transactiondate", "posteddate", "valuedate"],
  description: ["description", "details", "memo", "payee", "name", "transactiondescription"],
  amount: ["amount", "transactionamount", "value"],
  debit: ["debit", "withdrawal", "charge"],
  credit: ["credit", "deposit"],
  category: ["category", "categoryname", "transactioncategory", "spendingcategory"],
} as const;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseRows(contents: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const nextCharacter = contents[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("The CSV contains an unterminated quoted field.");
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

function parseAmount(value: string, rowNumber: number): number {
  const trimmed = value.trim();
  const isParenthesized = trimmed.startsWith("(") && trimmed.endsWith(")");
  const normalized = trimmed.replace(/[$€£,\s]/g, "").replace(/[()]/g, "");
  const amount = Number(normalized);

  if (!normalized || !Number.isFinite(amount)) {
    throw new Error(`Row ${rowNumber} has an invalid amount: "${value}".`);
  }
  const sign = isParenthesized ? -1 : Math.sign(amount);
  const absoluteCents = Math.round(Math.abs(amount) * 100 + Number.EPSILON * Math.abs(amount) * 100);
  if (!Number.isSafeInteger(absoluteCents)) {
    throw new Error(`Row ${rowNumber} has an amount that is too large: "${value}".`);
  }
  return sign * absoluteCents;
}

function findColumn(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

export function parseBankCsv(contents: string): ParsedTransaction[] {
  const rows = parseRows(contents.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("The CSV must include a header row and at least one transaction.");
  }

  const headers = rows[0].map(normalizeHeader);
  const dateColumn = findColumn(headers, headerAliases.date);
  const descriptionColumn = findColumn(headers, headerAliases.description);
  const amountColumn = findColumn(headers, headerAliases.amount);
  const debitColumn = findColumn(headers, headerAliases.debit);
  const creditColumn = findColumn(headers, headerAliases.credit);
  const categoryColumn = findColumn(headers, headerAliases.category);

  if (dateColumn < 0 || descriptionColumn < 0 || (amountColumn < 0 && debitColumn < 0 && creditColumn < 0)) {
    throw new Error("The CSV must include date, description, and amount columns.");
  }

  return rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const date = row[dateColumn]?.trim();
    const description = row[descriptionColumn]?.trim();

    if (!date || !description) {
      throw new Error(`Row ${rowNumber} must include a date and description.`);
    }

    const amountCents = amountColumn >= 0
      ? parseAmount(row[amountColumn] ?? "", rowNumber)
      : debitColumn >= 0 && row[debitColumn]?.trim()
        ? -Math.abs(parseAmount(row[debitColumn], rowNumber))
        : creditColumn >= 0
          ? Math.abs(parseAmount(row[creditColumn] ?? "", rowNumber))
          : NaN;

    if (!Number.isSafeInteger(amountCents)) {
      throw new Error(`Row ${rowNumber} must include an amount.`);
    }

    return {
      date,
      description,
      amountCents,
      categoryName: categoryColumn >= 0 ? row[categoryColumn]?.trim() || null : null,
      categoryId: null,
    };
  });
}
