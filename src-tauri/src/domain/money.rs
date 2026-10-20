use super::{AmountLocaleHint, ImportError};

pub fn parse_amount_to_cents(
    value: &str,
    locale_hint: Option<AmountLocaleHint>,
) -> Result<i64, ImportError> {
    let original = value;
    let mut value = value.trim();
    if value.is_empty() {
        return Err(ImportError::InvalidAmount(original.to_owned()));
    }

    let mut credit_debit = None;
    let upper = value.to_ascii_uppercase();
    if upper.ends_with("CR") || upper.ends_with("DR") {
        let suffix = &upper[upper.len() - 2..];
        credit_debit = Some(suffix == "DR");
        value = value[..value.len() - 2].trim_end();
    }

    let parenthesized = value.starts_with('(') && value.ends_with(')');
    if value.starts_with('(') != value.ends_with(')') {
        return Err(ImportError::InvalidAmount(original.to_owned()));
    }
    if parenthesized {
        value = value[1..value.len() - 1].trim();
    }

    let value = value
        .trim()
        .trim_matches(|character| matches!(character, '$' | '€' | '£'))
        .trim();
    let (value, explicit_sign) = if let Some(rest) = value.strip_prefix('-') {
        (rest.trim(), Some(true))
    } else if let Some(rest) = value.strip_prefix('+') {
        (rest.trim(), Some(false))
    } else if let Some(rest) = value.strip_suffix('-') {
        (rest.trim(), Some(true))
    } else {
        (value, None)
    };
    let negative = parenthesized || explicit_sign == Some(true) || credit_debit == Some(true);
    if credit_debit == Some(false) && negative {
        return Err(ImportError::InvalidAmount(original.to_owned()));
    }
    if explicit_sign == Some(false) && (parenthesized || credit_debit == Some(true)) {
        return Err(ImportError::InvalidAmount(original.to_owned()));
    }
    if value.is_empty()
        || value
            .chars()
            .any(|character| !(character.is_ascii_digit() || matches!(character, '.' | ',')))
    {
        return Err(ImportError::InvalidAmount(original.to_owned()));
    }

    let separators = value
        .char_indices()
        .filter(|(_, character)| matches!(character, '.' | ','))
        .collect::<Vec<_>>();
    let last_separator = separators.last().copied();
    let decimal_separator = match separators.as_slice() {
        [] => None,
        [(index, separator)] => {
            let three_fraction_digits = value.len() - index - separator.len_utf8() == 3;
            if !three_fraction_digits {
                Some(*separator)
            } else {
                match locale_hint {
                    None if *separator == '.' => Some(*separator),
                    None if *separator == ','
                        && *index > 0
                        && *index <= 3
                        && value[..*index]
                            .chars()
                            .all(|character| character.is_ascii_digit()) =>
                    {
                        return Err(ImportError::AmbiguousAmount(original.to_owned()));
                    }
                    None => Some(*separator),
                    Some(AmountLocaleHint::DecimalDot) if *separator == ',' => None,
                    Some(AmountLocaleHint::DecimalComma) if *separator == '.' => None,
                    Some(_) => Some(*separator),
                }
            }
        }
        _ if separators.iter().all(|(_, separator)| {
            Some(*separator) == separators.first().map(|(_, first)| *first)
        }) && value
            .split(separators[0].1)
            .skip(1)
            .all(|group| group.len() == 3) =>
        {
            None
        }
        _ => last_separator.map(|(_, separator)| separator),
    };

    let (integer_part, fraction_part) = match decimal_separator {
        Some(separator) => {
            let (integer, fraction) = value.rsplit_once(separator).expect("separator was found");
            if fraction.is_empty() || !fraction.chars().all(|character| character.is_ascii_digit())
            {
                return Err(ImportError::InvalidAmount(original.to_owned()));
            }
            (integer, Some(fraction))
        }
        None => (value, None),
    };

    let grouping_separator = match decimal_separator {
        Some(separator) if separators.iter().any(|(_, current)| *current != separator) => {
            separators
                .iter()
                .find_map(|(_, current)| (*current != separator).then_some(*current))
        }
        Some(separator) if integer_part.contains(separator) => Some(separator),
        Some(_) => None,
        None if separators.len() > 1 => last_separator.map(|(_, separator)| separator),
        None => last_separator.map(|(_, separator)| separator),
    };
    let integer_digits = normalize_integer(integer_part, grouping_separator)
        .ok_or_else(|| ImportError::InvalidAmount(original.to_owned()))?;
    let whole = integer_digits
        .parse::<i64>()
        .map_err(|_| ImportError::AmountTooLarge(original.to_owned()))?;
    let whole_cents = whole
        .checked_mul(100)
        .ok_or_else(|| ImportError::AmountTooLarge(original.to_owned()))?;

    let fraction = fraction_part.unwrap_or_default();
    if !fraction.chars().all(|character| character.is_ascii_digit()) {
        return Err(ImportError::InvalidAmount(original.to_owned()));
    }
    let fraction = fraction.as_bytes();
    let first_digit = fraction.first().map_or(0, |digit| i64::from(*digit - b'0'));
    let second_digit = fraction.get(1).map_or(0, |digit| i64::from(*digit - b'0'));
    let fraction_cents = first_digit * 10 + second_digit;
    let round_up = fraction.get(2).is_some_and(|digit| *digit >= b'5');
    let cents = whole_cents
        .checked_add(fraction_cents)
        .and_then(|amount| amount.checked_add(i64::from(round_up)))
        .ok_or_else(|| ImportError::AmountTooLarge(original.to_owned()))?;
    if negative {
        cents
            .checked_neg()
            .ok_or_else(|| ImportError::AmountTooLarge(original.to_owned()))
    } else {
        Ok(cents)
    }
}

fn normalize_integer(value: &str, grouping_separator: Option<char>) -> Option<String> {
    if value.is_empty() {
        return Some("0".to_owned());
    }
    match grouping_separator {
        Some(separator) if value.contains(separator) => {
            let mut groups = value.split(separator);
            let first = groups.next()?;
            if first.is_empty()
                || first.len() > 3
                || !first.chars().all(|character| character.is_ascii_digit())
            {
                return None;
            }
            let remaining = groups.collect::<Vec<_>>();
            if remaining.is_empty()
                || remaining.iter().any(|group| {
                    group.len() != 3 || !group.chars().all(|character| character.is_ascii_digit())
                })
            {
                return None;
            }
            Some(format!("{first}{}", remaining.join("")))
        }
        Some(separator) => {
            if value.contains(separator)
                || !value.chars().all(|character| character.is_ascii_digit())
            {
                None
            } else {
                Some(value.to_owned())
            }
        }
        None if value.chars().all(|character| character.is_ascii_digit()) => Some(value.to_owned()),
        None => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_currency_and_rounding_forms() {
        assert_eq!(parse_amount_to_cents("$1,234.56", None), Ok(123_456));
        assert_eq!(parse_amount_to_cents("(€12.34)", None), Ok(-1_234));
        assert_eq!(parse_amount_to_cents("£1.005", None), Ok(101));
        assert_eq!(parse_amount_to_cents("-1.005", None), Ok(-101));
        assert_eq!(parse_amount_to_cents("0.004", None), Ok(0));
    }

    #[test]
    fn parses_trailing_minus_and_credit_debit_suffixes() {
        assert_eq!(parse_amount_to_cents("5.00-", None), Ok(-500));
        assert_eq!(parse_amount_to_cents("25.00 CR", None), Ok(2_500));
        assert_eq!(parse_amount_to_cents("25.00 DR", None), Ok(-2_500));
        assert!(matches!(
            parse_amount_to_cents("+25.00 DR", None),
            Err(ImportError::InvalidAmount(_))
        ));
    }

    #[test]
    fn parses_both_decimal_conventions_and_rejects_ambiguous_values() {
        assert_eq!(parse_amount_to_cents("1,234.56", None), Ok(123_456));
        assert_eq!(parse_amount_to_cents("1.234,56", None), Ok(123_456));
        assert_eq!(parse_amount_to_cents("1234,567", None), Ok(123_457));
        assert_eq!(parse_amount_to_cents("1,234,567", None), Ok(123_456_700));
        assert_eq!(
            parse_amount_to_cents("1,234", Some(AmountLocaleHint::DecimalDot)),
            Ok(123_400)
        );
        assert_eq!(
            parse_amount_to_cents("1,234", Some(AmountLocaleHint::DecimalComma)),
            Ok(123)
        );
        assert_eq!(
            parse_amount_to_cents("1.234", Some(AmountLocaleHint::DecimalComma)),
            Ok(123_400)
        );
        assert!(matches!(
            parse_amount_to_cents("1,234", None),
            Err(ImportError::AmbiguousAmount(_))
        ));
    }

    #[test]
    fn rejects_invalid_grouping_and_overflow() {
        assert!(matches!(
            parse_amount_to_cents("12,34.56", None),
            Err(ImportError::InvalidAmount(_))
        ));
        assert!(matches!(
            parse_amount_to_cents("99999999999999999.00", None),
            Err(ImportError::AmountTooLarge(_))
        ));
    }
}
