//! Pure validation rules for monthly budgets.
//!
//! A budget covers one calendar month: an expected income plus an allocation
//! per expense category. Allocations may exceed income; the UI warns about
//! that, but it remains the user's decision.

use std::{
    collections::HashSet,
    fmt::{Display, Formatter},
};

/// Errors produced while validating budget input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BudgetError {
    /// The month is not a valid ISO `YYYY-MM` value.
    InvalidMonth,
    /// The input mode is neither `percent` nor `amount`.
    InvalidInputMode,
    /// The expected income is zero or negative.
    NonPositiveIncome,
    /// A category allocation is negative.
    NegativeAllocation,
    /// The same category appears more than once.
    DuplicateCategory,
}

impl Display for BudgetError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidMonth => write!(formatter, "budget month must be in YYYY-MM format"),
            Self::InvalidInputMode => {
                write!(formatter, "budget input mode must be percent or amount")
            }
            Self::NonPositiveIncome => {
                write!(formatter, "expected income must be greater than zero")
            }
            Self::NegativeAllocation => {
                write!(formatter, "budget allocations cannot be negative")
            }
            Self::DuplicateCategory => {
                write!(formatter, "a category can only be allocated once")
            }
        }
    }
}

impl std::error::Error for BudgetError {}

/// How a budget's allocations are entered, which also decides what stays fixed
/// when income changes: percents for `Percent`, amounts for `Amount`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BudgetInputMode {
    /// Allocations are entered as a share of income.
    Percent,
    /// Allocations are entered as currency amounts.
    Amount,
}

impl BudgetInputMode {
    /// Parses the stored and IPC text form of an input mode.
    pub fn parse(text: &str) -> Result<Self, BudgetError> {
        match text {
            "percent" => Ok(Self::Percent),
            "amount" => Ok(Self::Amount),
            _ => Err(BudgetError::InvalidInputMode),
        }
    }

    /// Returns the stored and IPC text form of this input mode.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Percent => "percent",
            Self::Amount => "amount",
        }
    }
}

/// Checks that a month is an ISO `YYYY-MM` value with a month from 01 to 12.
pub fn validate_month(month: &str) -> Result<(), BudgetError> {
    let bytes = month.as_bytes();
    let is_well_formed = bytes.len() == 7
        && bytes[4] == b'-'
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..].iter().all(u8::is_ascii_digit);
    if !is_well_formed {
        return Err(BudgetError::InvalidMonth);
    }
    match &month[5..] {
        "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" => Ok(()),
        _ => Err(BudgetError::InvalidMonth),
    }
}

/// Checks expected income and `(category_id, amount_cents)` allocations.
pub fn validate_budget_amounts(
    expected_income_cents: i64,
    allocations: &[(i64, i64)],
) -> Result<(), BudgetError> {
    if expected_income_cents <= 0 {
        return Err(BudgetError::NonPositiveIncome);
    }
    let mut seen = HashSet::with_capacity(allocations.len());
    for (category_id, amount_cents) in allocations {
        if *amount_cents < 0 {
            return Err(BudgetError::NegativeAllocation);
        }
        if !seen.insert(*category_id) {
            return Err(BudgetError::DuplicateCategory);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_calendar_months() {
        assert_eq!(validate_month("2026-01"), Ok(()));
        assert_eq!(validate_month("2026-12"), Ok(()));
    }

    #[test]
    fn rejects_malformed_months() {
        for month in [
            "",
            "2026",
            "2026-00",
            "2026-13",
            "2026-1",
            "26-01",
            "2026/01",
            "2026-01-01",
            "abcd-01",
        ] {
            assert_eq!(validate_month(month), Err(BudgetError::InvalidMonth));
        }
    }

    #[test]
    fn parses_only_known_input_modes() {
        assert_eq!(
            BudgetInputMode::parse("percent"),
            Ok(BudgetInputMode::Percent)
        );
        assert_eq!(
            BudgetInputMode::parse("amount"),
            Ok(BudgetInputMode::Amount)
        );
        assert_eq!(
            BudgetInputMode::parse("Percent"),
            Err(BudgetError::InvalidInputMode)
        );
    }

    #[test]
    fn input_modes_round_trip_through_their_stored_text() {
        for mode in [BudgetInputMode::Percent, BudgetInputMode::Amount] {
            assert_eq!(BudgetInputMode::parse(mode.as_str()), Ok(mode));
        }
    }

    #[test]
    fn requires_positive_income() {
        assert_eq!(
            validate_budget_amounts(0, &[]),
            Err(BudgetError::NonPositiveIncome)
        );
        assert_eq!(
            validate_budget_amounts(-1, &[]),
            Err(BudgetError::NonPositiveIncome)
        );
        assert_eq!(validate_budget_amounts(1, &[]), Ok(()));
    }

    #[test]
    fn rejects_negative_allocations_but_allows_zero() {
        assert_eq!(validate_budget_amounts(100, &[(1, 0)]), Ok(()));
        assert_eq!(
            validate_budget_amounts(100, &[(1, -1)]),
            Err(BudgetError::NegativeAllocation)
        );
    }

    #[test]
    fn rejects_duplicate_categories() {
        assert_eq!(
            validate_budget_amounts(100, &[(1, 10), (2, 10), (1, 20)]),
            Err(BudgetError::DuplicateCategory)
        );
    }

    #[test]
    fn allocations_may_exceed_income() {
        assert_eq!(validate_budget_amounts(100, &[(1, 500)]), Ok(()));
    }
}
