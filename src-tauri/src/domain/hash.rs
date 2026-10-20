use sha2::{Digest, Sha256};

pub fn dedupe_hash(
    date: &str,
    amount_cents: i64,
    description_normalized: &str,
    occurrence_index: u32,
) -> String {
    let description = normalize_description(description_normalized);
    let mut hasher = Sha256::new();
    hash_field(&mut hasher, date.as_bytes());
    hash_field(&mut hasher, amount_cents.to_string().as_bytes());
    hash_field(&mut hasher, description.as_bytes());
    hash_field(&mut hasher, occurrence_index.to_string().as_bytes());

    let digest = hasher.finalize();
    let mut output = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write;
        write!(output, "{byte:02x}").expect("writing to a String cannot fail");
    }
    output
}

fn hash_field(hasher: &mut Sha256, value: &[u8]) {
    hasher.update((value.len() as u64).to_be_bytes());
    hasher.update(value);
}

fn normalize_description(description: &str) -> String {
    description
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_imported_rows_have_stable_hashes() {
        let first = dedupe_hash("2026-01-01", -1_200, "Coffee shop", 0);
        let reimport = dedupe_hash("2026-01-01", -1_200, " COFFEE   SHOP ", 0);
        assert_eq!(first, reimport);
        assert_eq!(first.len(), 64);
    }

    #[test]
    fn occurrence_index_distinguishes_same_file_duplicates() {
        let first = dedupe_hash("2026-01-01", -1_200, "Coffee shop", 0);
        let second = dedupe_hash("2026-01-01", -1_200, "Coffee shop", 1);
        assert_ne!(first, second);
    }
}
