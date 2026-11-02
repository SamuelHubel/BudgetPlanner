use csv::{ReaderBuilder, StringRecord};

use super::dates::{detect_date_order, parse_date};
use super::money::parse_amount_to_cents;
use super::{AmountLocaleHint, DateOrder, ImportError, ImportedTransaction};

/// Maximum accepted size of a statement CSV.
pub const MAX_CSV_BYTES: usize = 5 * 1024 * 1024;
/// Maximum number of parsed transactions accepted from one CSV.
pub const MAX_TRANSACTION_ROWS: usize = 50_000;

/// Options that control locale-sensitive CSV parsing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct CsvImportOptions {
    /// Locale hint for ambiguous decimal and grouping separators.
    pub amount_locale: Option<AmountLocaleHint>,
    /// Interpretation of ambiguous date strings.
    pub date_order: DateOrder,
}

/// Parses a bank statement CSV into normalized transactions.
pub fn parse_bank_csv(
    contents: &str,
    options: CsvImportOptions,
) -> Result<Vec<ImportedTransaction>, ImportError> {
    if contents.len() > MAX_CSV_BYTES {
        return Err(ImportError::FileTooLarge {
            limit_bytes: MAX_CSV_BYTES,
        });
    }
    let contents = contents.strip_prefix('\u{feff}').unwrap_or(contents);
    let delimiter = detect_delimiter(contents)?;
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(false)
        .flexible(true)
        .from_reader(contents.as_bytes());

    let mut rows = Vec::<(u64, StringRecord)>::new();
    let mut record = StringRecord::new();
    loop {
        match reader.read_record(&mut record) {
            Ok(false) => break,
            Ok(true) => {}
            Err(error) => {
                let byte = error
                    .position()
                    .map_or_else(|| reader.position().byte(), |position| position.byte());
                return Err(ImportError::CsvRow {
                    line: source_record_line(contents.as_bytes(), byte),
                    message: error.to_string(),
                });
            }
        }
        if record.iter().all(|field| field.trim().is_empty()) {
            continue;
        }
        let byte = record.position().map_or(0, |position| position.byte());
        let line = source_record_line(contents.as_bytes(), byte);
        rows.push((line, record.clone()));
    }

    if rows.len() < 2 {
        return Err(ImportError::InvalidCsv(
            "a header row and at least one transaction are required".to_owned(),
        ));
    }
    if rows.len() - 1 > MAX_TRANSACTION_ROWS {
        return Err(ImportError::TooManyRows {
            limit: MAX_TRANSACTION_ROWS,
        });
    }

    let (header_line, header) = &rows[0];
    let columns = find_columns(header);
    if columns.date.is_none()
        || columns.description.is_none()
        || (columns.amount.is_none() && columns.debit.is_none() && columns.credit.is_none())
    {
        return Err(ImportError::CsvRow {
            line: *header_line,
            message: ImportError::MissingColumns.to_string(),
        });
    }

    let date_values = rows
        .iter()
        .skip(1)
        .map(|(line, record)| {
            columns
                .date
                .and_then(|index| record.get(index))
                .filter(|value| !value.trim().is_empty())
                .map(str::trim)
                .ok_or_else(|| ImportError::CsvRow {
                    line: *line,
                    message: "date is required".to_owned(),
                })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let date_order = if options.date_order == DateOrder::Auto {
        detect_date_order(date_values.iter().copied())?
    } else {
        options.date_order
    };

    rows.iter()
        .skip(1)
        .zip(date_values)
        .map(|((line, record), date_value)| {
            parse_record(
                record,
                *line,
                date_value,
                date_order,
                options.amount_locale,
                &columns,
            )
        })
        .collect()
}

#[derive(Default)]
struct Columns {
    date: Option<usize>,
    description: Option<usize>,
    amount: Option<usize>,
    debit: Option<usize>,
    credit: Option<usize>,
    category: Option<usize>,
}

fn find_columns(header: &StringRecord) -> Columns {
    let normalized = header.iter().map(normalize_header).collect::<Vec<_>>();
    Columns {
        date: find_column(
            &normalized,
            &["date", "transactiondate", "posteddate", "valuedate"],
        ),
        description: find_column(
            &normalized,
            &[
                "description",
                "details",
                "memo",
                "payee",
                "transactiondescription",
            ],
        ),
        amount: find_column(&normalized, &["amount", "transactionamount"]),
        debit: find_column(&normalized, &["debit", "withdrawal"]),
        credit: find_column(&normalized, &["credit", "deposit"]),
        category: find_column(
            &normalized,
            &[
                "category",
                "categoryname",
                "transactioncategory",
                "spendingcategory",
            ],
        ),
    }
}

fn normalize_header(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .collect()
}

fn find_column(headers: &[String], aliases: &[&str]) -> Option<usize> {
    headers
        .iter()
        .position(|header| aliases.contains(&header.as_str()))
}

fn parse_record(
    record: &StringRecord,
    line: u64,
    date_value: &str,
    date_order: DateOrder,
    amount_locale: Option<AmountLocaleHint>,
    columns: &Columns,
) -> Result<ImportedTransaction, ImportError> {
    let date = parse_date(date_value, date_order).map_err(|error| row_error(line, error))?;
    let description = field_value(record, columns.description)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ImportError::CsvRow {
            line,
            message: "description is required".to_owned(),
        })?
        .to_owned();
    let amount_cents = if let Some(index) = columns.amount {
        let value = record.get(index).unwrap_or_default().trim();
        parse_amount_to_cents(value, amount_locale).map_err(|error| row_error(line, error))?
    } else {
        let debit = field_value(record, columns.debit)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let credit = field_value(record, columns.credit)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if debit.is_some() && credit.is_some() {
            return Err(ImportError::CsvRow {
                line,
                message: "debit and credit cannot both have values".to_owned(),
            });
        }
        if let Some(value) = debit {
            parse_amount_to_cents(value, amount_locale)
                .map_err(|error| row_error(line, error))?
                .checked_abs()
                .and_then(i64::checked_neg)
                .ok_or_else(|| row_error(line, ImportError::NumericOverflow))?
        } else if let Some(value) = credit {
            parse_amount_to_cents(value, amount_locale)
                .map_err(|error| row_error(line, error))?
                .checked_abs()
                .ok_or_else(|| row_error(line, ImportError::NumericOverflow))?
        } else {
            return Err(ImportError::CsvRow {
                line,
                message: "amount is required".to_owned(),
            });
        }
    };

    Ok(ImportedTransaction {
        date,
        description,
        amount_cents,
        category_name: field_value(record, columns.category)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned),
        category_id: None,
        subcategory_id: None,
    })
}

fn field_value(record: &StringRecord, column: Option<usize>) -> Option<&str> {
    column.and_then(|index| record.get(index))
}

fn row_error(line: u64, error: ImportError) -> ImportError {
    match error {
        // Stays typed so the frontend can offer a format choice.
        ImportError::AmbiguousAmount(value) => ImportError::AmbiguousAmountRow { line, value },
        error => ImportError::CsvRow {
            line,
            message: error.to_string(),
        },
    }
}

fn source_line(contents: &[u8], byte: u64) -> u64 {
    let end = usize::try_from(byte)
        .unwrap_or(contents.len())
        .min(contents.len());
    let mut line = 1;
    let mut index = 0;
    while index < end {
        match contents[index] {
            b'\r' => {
                line += 1;
                if contents.get(index + 1) == Some(&b'\n') {
                    index += 1;
                }
            }
            b'\n' => line += 1,
            _ => {}
        }
        index += 1;
    }
    line
}

fn source_record_line(contents: &[u8], byte: u64) -> u64 {
    let mut index = usize::try_from(byte)
        .unwrap_or(contents.len())
        .min(contents.len());
    let mut line = source_line(contents, byte);
    while index < contents.len() {
        let line_end = contents[index..]
            .iter()
            .position(|byte| matches!(byte, b'\r' | b'\n'))
            .map_or(contents.len(), |offset| index + offset);
        if contents[index..line_end]
            .iter()
            .any(|byte| !byte.is_ascii_whitespace())
        {
            return line;
        }
        if line_end == contents.len() {
            return line;
        }
        index = line_end + 1;
        if contents[line_end] == b'\r' && contents.get(index) == Some(&b'\n') {
            index += 1;
        }
        line += 1;
    }
    line
}

fn detect_delimiter(contents: &str) -> Result<u8, ImportError> {
    let candidates = *b",;\t";
    let mut best = None;
    let mut first_error = None;
    for delimiter in candidates {
        let mut reader = ReaderBuilder::new()
            .delimiter(delimiter)
            .has_headers(false)
            .flexible(true)
            .from_reader(contents.as_bytes());
        let mut counts = Vec::new();
        for record in reader.records().take(12) {
            let record = match record {
                Ok(record) => record,
                Err(error) => {
                    let byte = error.position().map_or(0, |position| position.byte());
                    first_error.get_or_insert((
                        source_record_line(contents.as_bytes(), byte),
                        error.to_string(),
                    ));
                    break;
                }
            };
            if record.iter().any(|field| !field.trim().is_empty()) {
                counts.push(record.len());
            }
        }
        if let Some(width) = counts.first().copied().filter(|width| *width > 1) {
            let consistent = counts.iter().filter(|count| **count == width).count();
            let score = (consistent, counts.len(), width);
            if best.is_none_or(|(best_score, _)| score > best_score) {
                best = Some((score, delimiter));
            }
        }
    }
    if let Some((_, delimiter)) = best {
        Ok(delimiter)
    } else if let Some((line, message)) = first_error {
        Err(ImportError::CsvRow { line, message })
    } else {
        Err(ImportError::InvalidCsv(
            "unable to detect a supported delimiter".to_owned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;

    #[test]
    fn parses_quoted_csv_and_common_headers() {
        let transactions = parse_bank_csv(
            "Posted Date,Details,Transaction Amount\n2026-01-02,\"Coffee, shop\",$4.50\n2026-01-03,Refund,(12.00)",
            CsvImportOptions::default(),
        )
        .unwrap();
        assert_eq!(transactions.len(), 2);
        assert_eq!(transactions[0].description, "Coffee, shop");
        assert_eq!(transactions[0].amount_cents, 450);
        assert_eq!(transactions[1].amount_cents, -1_200);
        assert_eq!(
            transactions[0].date,
            NaiveDate::from_ymd_opt(2026, 1, 2).unwrap()
        );
    }

    #[test]
    fn parses_negative_currency_with_sign_before_symbol() {
        let transactions = parse_bank_csv(
            "Date,Description,Amount,Balance\n2026-10-12,GOOD 2 GO,-$57.28,\"$20,574.82\"",
            CsvImportOptions::default(),
        )
        .unwrap();

        assert_eq!(transactions.len(), 1);
        assert_eq!(transactions[0].amount_cents, -5_728);
    }

    #[test]
    fn detects_semicolon_and_tab_delimiters_and_strips_bom() {
        let semicolon = parse_bank_csv(
            "\u{feff}Date;Description;Amount\n2026-01-01;Store;25.00",
            CsvImportOptions::default(),
        )
        .unwrap();
        assert_eq!(semicolon[0].amount_cents, 2_500);

        let tab = parse_bank_csv(
            "Date\tDescription\tAmount\n2026-01-01\tStore\t25.00",
            CsvImportOptions::default(),
        )
        .unwrap();
        assert_eq!(tab[0].amount_cents, 2_500);
    }

    #[test]
    fn handles_debit_and_credit_columns_and_strict_headers() {
        let transactions = parse_bank_csv(
            "Date,Description,Debit,Credit\n2026-01-01,Store,25.00,\n2026-01-02,Paycheck,,1000.00",
            CsvImportOptions::default(),
        )
        .unwrap();
        assert_eq!(
            transactions
                .iter()
                .map(|transaction| transaction.amount_cents)
                .collect::<Vec<_>>(),
            [-2_500, 100_000]
        );
        let categorized = parse_bank_csv(
            "Date,Description,Amount,Transaction Category\n2026-01-01,Store,-4.50,Dining Out",
            CsvImportOptions::default(),
        )
        .unwrap();
        assert_eq!(categorized[0].category_name.as_deref(), Some("Dining Out"));
        assert!(matches!(
            parse_bank_csv(
                "Date,Name,Value\n2026-01-01,Store,1.00",
                CsvImportOptions::default()
            ),
            Err(ImportError::CsvRow { .. })
        ));
    }

    #[test]
    fn reports_source_line_numbers_after_blank_lines() {
        let error = parse_bank_csv(
            "Date,Description,Amount\n2026-01-01,Valid,1.00\n\n2026-01-02,,2.00",
            CsvImportOptions::default(),
        )
        .unwrap_err();
        assert_eq!(
            error,
            ImportError::CsvRow {
                line: 4,
                message: "description is required".to_owned(),
            }
        );
    }

    #[test]
    fn reports_source_line_for_malformed_quoted_rows() {
        let error = parse_bank_csv(
            "Date,Description,Amount\n2026-01-01,\"unterminated,1.00\n",
            CsvImportOptions::default(),
        )
        .unwrap_err();
        assert!(matches!(error, ImportError::CsvRow { line: 2, .. }));
    }

    #[test]
    fn rejects_ambiguous_file_dates_and_preserves_source_line_for_errors() {
        assert_eq!(
            parse_bank_csv(
                "Date,Description,Amount\n03/04/2025,Coffee,1.00",
                CsvImportOptions::default()
            ),
            Err(ImportError::AmbiguousDateOrder)
        );
        let error = parse_bank_csv(
            "Date,Description,Amount\n13/04/2025,Coffee,1.00\n15/04/2025,Bad,not-money",
            CsvImportOptions::default(),
        )
        .unwrap_err();
        assert!(matches!(error, ImportError::CsvRow { line: 3, .. }));
    }

    #[test]
    fn supports_date_order_proven_by_a_later_row() {
        let transactions = parse_bank_csv(
            "Date,Description,Amount\n03/04/2025,First,1.00\n15/04/2025,Second,2.00",
            CsvImportOptions::default(),
        )
        .unwrap();
        assert_eq!(transactions[0].date.to_string(), "2025-04-03");
    }

    #[test]
    fn enforces_csv_size_limit() {
        let contents = "x".repeat(MAX_CSV_BYTES + 1);
        assert!(matches!(
            parse_bank_csv(&contents, CsvImportOptions::default()),
            Err(ImportError::FileTooLarge { .. })
        ));
    }

    #[test]
    fn enforces_transaction_row_limit() {
        let mut contents = String::from("Date,Description,Amount\n");
        for _ in 0..=MAX_TRANSACTION_ROWS {
            contents.push_str("2026-01-01,Store,1.00\n");
        }
        assert!(matches!(
            parse_bank_csv(&contents, CsvImportOptions::default()),
            Err(ImportError::TooManyRows {
                limit: MAX_TRANSACTION_ROWS
            })
        ));
    }
}
