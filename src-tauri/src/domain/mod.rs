pub mod categorize;
pub mod csv_import;
pub mod dates;
pub mod hash;
pub mod money;
pub mod summary;

use std::fmt::{Display, Formatter};

use chrono::NaiveDate;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportError {
    InvalidAmount(String),
    AmbiguousAmount(String),
    AmountTooLarge(String),
    InvalidDate(String),
    AmbiguousDateOrder,
    ConflictingDateOrder,
    InvalidKeywordRule(String),
    InvalidCsv(String),
    MissingColumns,
    FileTooLarge { limit_bytes: usize },
    TooManyRows { limit: usize },
    CsvRow { line: u64, message: String },
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DateOrder {
    #[default]
    Auto,
    Mdy,
    Dmy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AmountLocaleHint {
    DecimalDot,
    DecimalComma,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CategoryType {
    Income,
    Expense,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub category_type: CategoryType,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedTransaction {
    pub date: NaiveDate,
    pub description: String,
    pub amount_cents: i64,
    pub category_name: Option<String>,
    pub category_id: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeywordCategory {
    pub keyword: String,
    pub category_id: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialTransaction {
    pub date: NaiveDate,
    pub amount_cents: i64,
    pub description: Option<String>,
    pub category_id: Option<i64>,
}
