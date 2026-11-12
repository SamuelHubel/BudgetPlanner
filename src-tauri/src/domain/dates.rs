use chrono::{Datelike, NaiveDate};

use super::{DateOrder, ImportError};

/// Infers a common month/day order from a collection of date strings.
pub fn detect_date_order<'a>(
    dates: impl IntoIterator<Item = &'a str>,
) -> Result<DateOrder, ImportError> {
    let mut detected = None;
    let mut has_ambiguous_numeric_date = false;

    for value in dates {
        let value = value.trim();
        if parse_unambiguous_date(value).is_some() || !value.contains('/') {
            continue;
        }
        let Some((first, second)) = numeric_date_parts(value) else {
            continue;
        };
        let order = match (first > 12, second > 12) {
            (true, false) => Some(DateOrder::Dmy),
            (false, true) => Some(DateOrder::Mdy),
            (false, false) => {
                has_ambiguous_numeric_date = true;
                None
            }
            (true, true) => return Err(ImportError::InvalidDate(value.to_owned())),
        };
        if let Some(order) = order {
            if detected.is_some_and(|existing| existing != order) {
                return Err(ImportError::ConflictingDateOrder);
            }
            detected = Some(order);
        }
    }

    if let Some(order) = detected {
        Ok(order)
    } else if has_ambiguous_numeric_date {
        Err(ImportError::AmbiguousDateOrder)
    } else {
        Ok(DateOrder::Auto)
    }
}

/// Parses a supported date string using the requested order.
pub fn parse_date(value: &str, order: DateOrder) -> Result<NaiveDate, ImportError> {
    let value = value.trim();
    let date = parse_numeric_or_named_date(value, order)?;
    // chrono's `%Y` accepts 1-4 digits, so a short year must never be stored as 00yy.
    if date.year() < 1000 {
        return Err(ImportError::InvalidDate(value.to_owned()));
    }
    Ok(date)
}

fn parse_numeric_or_named_date(value: &str, order: DateOrder) -> Result<NaiveDate, ImportError> {
    if let Some(date) = parse_unambiguous_date(value) {
        return Ok(date);
    }

    let Some((first, second, year)) = numeric_date_parts_with_year(value) else {
        return Err(ImportError::InvalidDate(value.to_owned()));
    };
    let resolved_order = match order {
        DateOrder::Auto if first > 12 && second <= 12 => DateOrder::Dmy,
        DateOrder::Auto if second > 12 && first <= 12 => DateOrder::Mdy,
        DateOrder::Auto => return Err(ImportError::AmbiguousDateOrder),
        explicit => explicit,
    };
    let (month, day) = match resolved_order {
        DateOrder::Mdy => (first, second),
        DateOrder::Dmy => (second, first),
        DateOrder::Auto => return Err(ImportError::AmbiguousDateOrder),
    };
    NaiveDate::from_ymd_opt(year, month, day).ok_or_else(|| ImportError::InvalidDate(value.into()))
}

fn parse_unambiguous_date(value: &str) -> Option<NaiveDate> {
    // "26-01-05" could be YY-MM-DD or DD-MM-YY, so ISO needs a 4-digit year.
    let four_digit_iso_year = value.split('-').next().is_some_and(|year| year.len() == 4);
    let compact = value.len() == 8 && value.bytes().all(|byte| byte.is_ascii_digit());
    four_digit_iso_year
        .then(|| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .flatten()
        .or_else(|| {
            compact
                .then(|| NaiveDate::parse_from_str(value, "%Y%m%d").ok())
                .flatten()
        })
        .or_else(|| NaiveDate::parse_from_str(value, "%b %d, %Y").ok())
        .or_else(|| NaiveDate::parse_from_str(value, "%B %d, %Y").ok())
}

fn numeric_date_parts(value: &str) -> Option<(u32, u32)> {
    let (first, second, _) = numeric_date_parts_with_year(value)?;
    Some((first, second))
}

fn numeric_date_parts_with_year(value: &str) -> Option<(u32, u32, i32)> {
    let mut parts = value.split('/');
    let first = parts.next()?.parse::<u32>().ok()?;
    let second = parts.next()?.parse::<u32>().ok()?;
    let year_text = parts.next()?;
    let year = year_text.parse::<i32>().ok()?;
    if parts.next().is_some() || !year_text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let year = match year_text.len() {
        // shortcut: two-digit years are read as 20yy; bank exports do not reach before 2000.
        2 => 2000 + year,
        4 => year,
        _ => return None,
    };
    Some((first, second, year))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_supported_date_formats() {
        let expected = NaiveDate::from_ymd_opt(2025, 3, 15).unwrap();
        assert_eq!(parse_date("2025-03-15", DateOrder::Auto), Ok(expected));
        assert_eq!(parse_date("Mar 15, 2025", DateOrder::Auto), Ok(expected));
        assert_eq!(parse_date("March 15, 2025", DateOrder::Auto), Ok(expected));
        assert_eq!(parse_date("03/15/2025", DateOrder::Mdy), Ok(expected));
        assert_eq!(parse_date("15/03/2025", DateOrder::Dmy), Ok(expected));
        assert_eq!(parse_date("20250315", DateOrder::Auto), Ok(expected));
        assert_eq!(parse_date("03/15/25", DateOrder::Mdy), Ok(expected));
        assert_eq!(detect_date_order(["15/03/25"]), Ok(DateOrder::Dmy));
    }

    #[test]
    fn short_years_are_never_stored_as_the_first_century() {
        for value in ["25-03-15", "Mar 15, 25", "3/15/025", "03/15/0025"] {
            assert!(
                matches!(
                    parse_date(value, DateOrder::Mdy),
                    Err(ImportError::InvalidDate(_))
                ),
                "{value}"
            );
        }
    }

    #[test]
    fn detects_order_from_unambiguous_values_in_the_whole_file() {
        assert_eq!(
            detect_date_order(["03/04/2025", "15/04/2025"]),
            Ok(DateOrder::Dmy)
        );
        assert_eq!(
            detect_date_order(["03/04/2025", "04/15/2025"]),
            Ok(DateOrder::Mdy)
        );
        assert_eq!(
            detect_date_order(["2025-03-15", "Mar 15, 2025"]),
            Ok(DateOrder::Auto)
        );
    }

    #[test]
    fn refuses_ambiguous_or_conflicting_orders_and_invalid_dates() {
        assert_eq!(
            detect_date_order(["03/04/2025"]),
            Err(ImportError::AmbiguousDateOrder)
        );
        assert_eq!(
            detect_date_order(["13/04/2025", "04/15/2025"]),
            Err(ImportError::ConflictingDateOrder)
        );
        assert!(matches!(
            parse_date("02/30/2025", DateOrder::Mdy),
            Err(ImportError::InvalidDate(_))
        ));
        assert!(matches!(
            parse_date("03/04/2025", DateOrder::Auto),
            Err(ImportError::AmbiguousDateOrder)
        ));
    }
}
