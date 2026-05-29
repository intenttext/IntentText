//! Document diff engine — compare two IntentDocuments.
//!
//! Parity target: packages/core/src/diff.ts

use crate::types::IntentBlock;

/// A single change between two documents.
#[derive(Debug, Clone, PartialEq)]
pub struct DiffEntry {
    /// 0-based index in the left (original) document, or None for additions.
    pub left_index: Option<usize>,
    /// 0-based index in the right (modified) document, or None for removals.
    pub right_index: Option<usize>,
    /// The kind of change.
    pub kind: DiffKind,
    /// The block from the original document, if applicable.
    pub left_block: Option<IntentBlock>,
    /// The block from the modified document, if applicable.
    pub right_block: Option<IntentBlock>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DiffKind {
    /// Block is the same in both documents.
    Unchanged,
    /// Block was added in the right document.
    Added,
    /// Block was removed from the left document.
    Removed,
    /// Block content or properties changed.
    Modified,
}

/// Compute the diff between two documents' block sequences.
///
/// Uses a simple LCS-based approach keyed on (block_type, content).
pub fn diff(left: &[IntentBlock], right: &[IntentBlock]) -> Vec<DiffEntry> {
    let lcs = compute_lcs(left, right);
    build_diff(left, right, &lcs)
}

/// Returns true if one block is "semantically equal" to another for diff purposes.
#[allow(dead_code)]
fn blocks_equal(a: &IntentBlock, b: &IntentBlock) -> bool {
    a.block_type == b.block_type && a.content == b.content && a.properties == b.properties
}

/// Returns a "match key" used for LCS alignment.
fn block_key(b: &IntentBlock) -> String {
    let props_str = b
        .properties
        .as_ref()
        .map(|p| {
            let mut kv: Vec<String> = p.iter().map(|(k, v)| format!("{k}={v}")).collect();
            kv.sort();
            kv.join(",")
        })
        .unwrap_or_default();
    format!("{}:{}:{}", b.block_type, b.content, props_str)
}

/// LCS matrix — returns the lengths table.
fn compute_lcs(left: &[IntentBlock], right: &[IntentBlock]) -> Vec<Vec<usize>> {
    let m = left.len();
    let n = right.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 1..=m {
        for j in 1..=n {
            if block_key(&left[i - 1]) == block_key(&right[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }
    dp
}

fn build_diff(left: &[IntentBlock], right: &[IntentBlock], dp: &[Vec<usize>]) -> Vec<DiffEntry> {
    let mut result: Vec<DiffEntry> = Vec::new();
    let mut i = left.len();
    let mut j = right.len();

    // Walk the LCS table backwards
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && block_key(&left[i - 1]) == block_key(&right[j - 1]) {
            result.push(DiffEntry {
                left_index: Some(i - 1),
                right_index: Some(j - 1),
                kind: DiffKind::Unchanged,
                left_block: Some(left[i - 1].clone()),
                right_block: Some(right[j - 1].clone()),
            });
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            result.push(DiffEntry {
                left_index: None,
                right_index: Some(j - 1),
                kind: DiffKind::Added,
                left_block: None,
                right_block: Some(right[j - 1].clone()),
            });
            j -= 1;
        } else {
            result.push(DiffEntry {
                left_index: Some(i - 1),
                right_index: None,
                kind: DiffKind::Removed,
                left_block: Some(left[i - 1].clone()),
                right_block: None,
            });
            i -= 1;
        }
    }

    result.reverse();
    result
}

/// Returns only the changed entries from a diff.
pub fn changed_entries(entries: &[DiffEntry]) -> Vec<&DiffEntry> {
    entries
        .iter()
        .filter(|e| e.kind != DiffKind::Unchanged)
        .collect()
}

/// Apply a diff patch: start from the left document and return the right.
/// Added entries are kept, removed entries are dropped, unchanged stay.
pub fn patch(_left: &[IntentBlock], diff_entries: &[DiffEntry]) -> Vec<IntentBlock> {
    diff_entries
        .iter()
        .filter_map(|e| match e.kind {
            DiffKind::Unchanged | DiffKind::Added => e.right_block.clone(),
            DiffKind::Removed => None,
            DiffKind::Modified => e.right_block.clone(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn identical_documents_no_changes() {
        let a = parse("title: Hello\ntext: World", None);
        let b = parse("title: Hello\ntext: World", None);
        let d = diff(&a.blocks, &b.blocks);
        let changes = changed_entries(&d);
        assert!(changes.is_empty());
    }

    #[test]
    fn added_block_detected() {
        let a = parse("title: Hello", None);
        let b = parse("title: Hello\ntext: New paragraph", None);
        let d = diff(&a.blocks, &b.blocks);
        let added: Vec<_> = d.iter().filter(|e| e.kind == DiffKind::Added).collect();
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].right_block.as_ref().unwrap().block_type, "text");
    }

    #[test]
    fn removed_block_detected() {
        let a = parse("title: Hello\ntext: Remove me", None);
        let b = parse("title: Hello", None);
        let d = diff(&a.blocks, &b.blocks);
        let removed: Vec<_> = d.iter().filter(|e| e.kind == DiffKind::Removed).collect();
        assert_eq!(removed.len(), 1);
    }

    #[test]
    fn patch_reconstructs_right() {
        let a = parse("title: Hello\ntext: Old", None);
        let b = parse("title: Hello\ntext: New content\ninfo: Added note", None);
        let d = diff(&a.blocks, &b.blocks);
        let patched = patch(&a.blocks, &d);
        assert_eq!(patched.len(), b.blocks.len());
    }
}
