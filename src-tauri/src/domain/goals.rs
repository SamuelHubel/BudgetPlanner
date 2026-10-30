//! Pure validation and progress rules for user financial goals.
//!
//! A goal is free text (for example "Spend less on dining out"). It may
//! optionally be linked to an expense category with a monthly spending limit,
//! in which case progress is derived from that category's net spending.

use std::fmt::{Display, Formatter};

/// Maximum number of characters accepted in a goal's text.
pub const MAX_GOAL_TITLE_CHARS: usize = 500;

/// Errors produced while validating goal input or computing goal progress.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GoalError {
    /// The goal text is empty after trimming whitespace.
    EmptyTitle,
    /// The goal text exceeds [`MAX_GOAL_TITLE_CHARS`].
    TitleTooLong,
    /// Only one of the category and spending limit was supplied.
    IncompleteLink,
    /// The spending limit is zero or negative.
    NonPositiveLimit,
    /// A spending calculation exceeded the supported range.
    NumericOverflow,
}

impl Display for GoalError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyTitle => write!(formatter, "goal text cannot be empty"),
            Self::TitleTooLong => write!(
                formatter,
                "goal text cannot exceed {MAX_GOAL_TITLE_CHARS} characters"
            ),
            Self::IncompleteLink => write!(
                formatter,
                "a tracked goal needs both a category and a monthly limit"
            ),
            Self::NonPositiveLimit => {
                write!(formatter, "the monthly limit must be greater than zero")
            }
            Self::NumericOverflow => write!(formatter, "goal spending is out of range"),
        }
    }
}

impl std::error::Error for GoalError {}

/// Trims goal text and checks that it is non-empty and within the length limit.
pub fn normalize_goal_title(title: &str) -> Result<String, GoalError> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(GoalError::EmptyTitle);
    }
    // Count characters rather than bytes so non-ASCII text is not penalized.
    if trimmed.chars().count() > MAX_GOAL_TITLE_CHARS {
        return Err(GoalError::TitleTooLong);
    }
    Ok(trimmed.to_owned())
}

/// Checks that a goal is either untracked or fully linked to a positive limit.
pub fn validate_goal_link(
    category_id: Option<i64>,
    limit_cents: Option<i64>,
) -> Result<(), GoalError> {
    match (category_id, limit_cents) {
        (None, None) => Ok(()),
        (Some(_), Some(limit)) if limit > 0 => Ok(()),
        (Some(_), Some(_)) => Err(GoalError::NonPositiveLimit),
        _ => Err(GoalError::IncompleteLink),
    }
}

/// Converts a category's signed net amount into non-negative spending.
///
/// Expenses are stored as negative cents, so spending is the negated net.
/// Refunds are positive and offset spending; if refunds exceed purchases the
/// result is clamped to zero rather than reported as negative spending.
pub fn spent_from_net(net_cents: i64) -> Result<i64, GoalError> {
    net_cents
        .checked_neg()
        .map(|spent| spent.max(0))
        .ok_or(GoalError::NumericOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_and_accepts_goal_text() {
        assert_eq!(
            normalize_goal_title("  Spend less on dining out \n").unwrap(),
            "Spend less on dining out"
        );
    }

    #[test]
    fn rejects_empty_or_whitespace_goal_text() {
        assert_eq!(normalize_goal_title(""), Err(GoalError::EmptyTitle));
        assert_eq!(normalize_goal_title(" \t\n "), Err(GoalError::EmptyTitle));
    }

    #[test]
    fn enforces_the_character_limit_at_the_boundary() {
        let at_limit = "é".repeat(MAX_GOAL_TITLE_CHARS);
        assert_eq!(normalize_goal_title(&at_limit).unwrap(), at_limit);
        let over_limit = "a".repeat(MAX_GOAL_TITLE_CHARS + 1);
        assert_eq!(
            normalize_goal_title(&over_limit),
            Err(GoalError::TitleTooLong)
        );
    }

    #[test]
    fn requires_category_and_limit_together() {
        assert_eq!(validate_goal_link(None, None), Ok(()));
        assert_eq!(validate_goal_link(Some(4), Some(30_000)), Ok(()));
        assert_eq!(
            validate_goal_link(Some(4), None),
            Err(GoalError::IncompleteLink)
        );
        assert_eq!(
            validate_goal_link(None, Some(30_000)),
            Err(GoalError::IncompleteLink)
        );
    }

    #[test]
    fn rejects_zero_or_negative_limits() {
        assert_eq!(
            validate_goal_link(Some(4), Some(0)),
            Err(GoalError::NonPositiveLimit)
        );
        assert_eq!(
            validate_goal_link(Some(4), Some(-1)),
            Err(GoalError::NonPositiveLimit)
        );
    }

    #[test]
    fn derives_spending_from_signed_net_amounts() {
        assert_eq!(spent_from_net(-21_000), Ok(21_000));
        assert_eq!(spent_from_net(0), Ok(0));
        // Refunds larger than purchases do not produce negative spending.
        assert_eq!(spent_from_net(500), Ok(0));
        assert_eq!(spent_from_net(i64::MIN), Err(GoalError::NumericOverflow));
    }
}
