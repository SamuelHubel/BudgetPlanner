/// Transaction categorization rules and helpers.
pub mod categorize;
/// CSV parsing and import limits.
pub mod csv_import;
/// Date parsing and order detection.
pub mod dates;
/// Stable transaction deduplication hashes.
pub mod hash;
/// Currency amount parsing and validation.
pub mod money;
/// Financial summary aggregation.
pub mod summary;

use std::fmt::{Display, Formatter};

use chrono::NaiveDate;

/// Errors that can occur while parsing or aggregating imported financial data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportError {
    /// An amount string could not be parsed.
    InvalidAmount(String),
    /// An amount requires an explicit locale hint to disambiguate separators.
    AmbiguousAmount(String),
    /// An amount exceeds the supported integer range.
    AmountTooLarge(String),
    /// A date string could not be parsed.
    InvalidDate(String),
    /// The statement contains dates that do not determine a unique date order.
    AmbiguousDateOrder,
    /// Dates in one statement use conflicting month/day orders.
    ConflictingDateOrder,
    /// A categorization keyword rule is invalid.
    InvalidKeywordRule(String),
    /// The CSV input is malformed.
    InvalidCsv(String),
    /// Required date, description, or amount columns are absent.
    MissingColumns,
    /// The CSV exceeds the supplied byte limit.
    FileTooLarge {
        /// Maximum accepted file size in bytes.
        limit_bytes: usize,
    },
    /// The CSV exceeds the supplied transaction row limit.
    TooManyRows {
        /// Maximum accepted transaction rows.
        limit: usize,
    },
    /// A CSV record contains an error and its source line.
    CsvRow {
        /// Source line number of the invalid record.
        line: u64,
        /// Description of the CSV record error.
        message: String,
    },
    /// A monetary calculation exceeded the supported range.
    NumericOverflow,
}

impl Display for ImportError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidAmount(value) => write!(formatter, "invalid amount: {value:?}"),
            Self::AmbiguousAmount(value) => {
                write!(
                    formatter,
                    "ambiguous amount requires a locale hint: {value:?}"
                )
            }
            Self::AmountTooLarge(value) => write!(formatter, "amount is too large: {value:?}"),
            Self::InvalidDate(value) => write!(formatter, "invalid date: {value:?}"),
            Self::AmbiguousDateOrder => write!(formatter, "date order is ambiguous"),
            Self::ConflictingDateOrder => {
                write!(formatter, "dates use conflicting day and month orders")
            }
            Self::InvalidKeywordRule(keyword) => {
                write!(formatter, "invalid keyword rule: {keyword:?}")
            }
            Self::InvalidCsv(message) => write!(formatter, "invalid CSV: {message}"),
            Self::MissingColumns => {
                write!(
                    formatter,
                    "CSV must include date, description, and amount columns"
                )
            }
            Self::FileTooLarge { limit_bytes } => {
                write!(formatter, "CSV exceeds the {limit_bytes}-byte size limit")
            }
            Self::TooManyRows { limit } => {
                write!(formatter, "CSV exceeds the {limit}-row transaction limit")
            }
            Self::CsvRow { line, message } => write!(formatter, "row {line}: {message}"),
            Self::NumericOverflow => {
                write!(formatter, "financial total exceeds the supported range")
            }
        }
    }
}

impl std::error::Error for ImportError {}

/// Controls how numeric date strings are interpreted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DateOrder {
    /// Infer the order from unambiguous dates when possible.
    #[default]
    Auto,
    /// Interpret ambiguous dates as month/day/year.
    Mdy,
    /// Interpret ambiguous dates as day/month/year.
    Dmy,
}

/// Optional locale hint for parsing decimal and grouping separators.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AmountLocaleHint {
    /// A period is the decimal separator.
    DecimalDot,
    /// A comma is the decimal separator.
    DecimalComma,
}

/// The financial direction assigned to a category.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CategoryType {
    /// Money received.
    Income,
    /// Money spent.
    Expense,
}

/// A transaction category used by domain calculations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Category {
    /// Database identifier for the category.
    pub id: i64,
    /// User-facing category name.
    pub name: String,
    /// Whether the category represents income or expense.
    pub category_type: CategoryType,
}

/// A parsed transaction ready for categorization and import preview.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedTransaction {
    /// Transaction date.
    pub date: NaiveDate,
    /// Description from the statement.
    pub description: String,
    /// Signed transaction amount in integer cents.
    pub amount_cents: i64,
    /// Category name supplied by the statement, if any.
    pub category_name: Option<String>,
    /// Matched database category identifier, if any.
    pub category_id: Option<i64>,
}

/// A keyword-to-category rule.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeywordCategory {
    /// Keyword used to match transaction descriptions.
    pub keyword: String,
    /// Database identifier of the matching category.
    pub category_id: i64,
}

/// A transaction input to financial summary calculations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialTransaction {
    /// Transaction date.
    pub date: NaiveDate,
    /// Signed transaction amount in integer cents.
    pub amount_cents: i64,
    /// Optional transaction description.
    pub description: Option<String>,
    /// Database category identifier, or `None` when uncategorized.
    pub category_id: Option<i64>,
}
