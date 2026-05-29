//! Trust system — document signing, freezing, and verification.
//!
//! Parity target: packages/core/src/trust.ts
//!
//! SHA-256 scope: all blocks EXCEPT sign/freeze/amendment.
//! Properties are sorted alphabetically for deterministic hashing.

use crate::parser::parse;
use crate::types::{FreezeState, IntentBlock, IntentDocument, Signature};
use sha2::{Digest, Sha256};
use std::fmt::Write as FmtWrite;

// ─── public API ──────────────────────────────────────────────────────────────

/// Compute the canonical SHA-256 hash of document content.
/// Excludes sign:, freeze:, and amendment: blocks.
pub fn compute_hash(document: &IntentDocument) -> String {
    let canonical = canonical_content(document);
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let result = hasher.finalize();
    format!("sha256:{}", hex::encode(result))
}

/// Add a sign: block signature to the document.
/// Returns a new document with the signature block appended.
pub fn seal(document: &IntentDocument, signer: &str, role: Option<&str>) -> IntentDocument {
    let hash = compute_hash(document);
    let at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut props = std::collections::HashMap::new();
    props.insert("hash".to_string(), hash.clone());
    props.insert("at".to_string(), at.clone());
    if let Some(r) = role {
        props.insert("role".to_string(), r.to_string());
    }

    let sign_block = IntentBlock {
        id: uuid::Uuid::new_v4().to_string(),
        block_type: "sign".to_string(),
        content: signer.to_string(),
        original_content: None,
        properties: Some(props),
        inline: None,
        children: None,
        table: None,
    };

    let mut new_doc = document.clone();
    new_doc.blocks.push(sign_block);

    // Update metadata signatures list
    let sig = Signature {
        signer: signer.to_string(),
        hash,
        at,
        role: role.map(str::to_string),
        valid: None,
    };
    let meta = new_doc.metadata.get_or_insert_with(Default::default);
    let sigs = meta.signatures.get_or_insert_with(Vec::new);
    sigs.push(sig);

    new_doc
}

/// Freeze the document, recording hash and timestamp in a freeze: block.
/// A frozen document should not be modified.
pub fn freeze(document: &IntentDocument, label: Option<&str>) -> IntentDocument {
    let hash = compute_hash(document);
    let at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut props = std::collections::HashMap::new();
    props.insert("hash".to_string(), hash.clone());
    props.insert("at".to_string(), at.clone());
    props.insert("status".to_string(), "locked".to_string());

    let label_text = label.unwrap_or("").to_string();

    let freeze_block = IntentBlock {
        id: uuid::Uuid::new_v4().to_string(),
        block_type: "freeze".to_string(),
        content: label_text.clone(),
        original_content: None,
        properties: Some(props),
        inline: None,
        children: None,
        table: None,
    };

    let mut new_doc = document.clone();
    new_doc.blocks.push(freeze_block);

    let meta = new_doc.metadata.get_or_insert_with(Default::default);
    meta.freeze = Some(FreezeState {
        hash,
        at,
        status: "locked".to_string(),
    });

    new_doc
}

/// Verify that the document's freeze hash matches the current content hash.
///
/// Returns `Ok(())` if no freeze block is present (document not frozen),
/// or if the freeze hash matches. Returns `Err(message)` if tampered.
pub fn verify(document: &IntentDocument) -> Result<(), String> {
    // Find the freeze block
    let freeze_block = document.blocks.iter().find(|b| b.block_type == "freeze");

    let freeze_hash = match freeze_block {
        None => return Ok(()), // not frozen — nothing to verify
        Some(b) => b
            .properties
            .as_ref()
            .and_then(|p| p.get("hash"))
            .cloned()
            .unwrap_or_default(),
    };

    if freeze_hash.is_empty() {
        return Err("freeze: block has no hash property".to_string());
    }

    let current_hash = compute_hash(document);
    if current_hash == freeze_hash {
        Ok(())
    } else {
        Err(format!(
            "document hash mismatch: recorded={freeze_hash}, computed={current_hash}"
        ))
    }
}

/// Amend a frozen document by appending an amendment: block.
/// The amendment block records the reason and a new hash of the amended document.
pub fn amend(document: &IntentDocument, reason: &str, author: Option<&str>) -> IntentDocument {
    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut props = std::collections::HashMap::new();
    props.insert("timestamp".to_string(), timestamp);
    if let Some(a) = author {
        props.insert("author".to_string(), a.to_string());
    }

    let amendment_block = IntentBlock {
        id: uuid::Uuid::new_v4().to_string(),
        block_type: "amendment".to_string(),
        content: reason.to_string(),
        original_content: None,
        properties: Some(props),
        inline: None,
        children: None,
        table: None,
    };

    let mut new_doc = document.clone();
    new_doc.blocks.push(amendment_block);
    new_doc
}

#[derive(Debug, Clone, Default)]
pub struct SealOptions {
    pub signer: String,
    pub role: Option<String>,
    pub skip_sign: bool,
}

#[derive(Debug, Clone, Default)]
pub struct SealResult {
    pub success: bool,
    pub hash: String,
    pub source: String,
    pub at: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct VerifySigner {
    pub signer: String,
    pub role: Option<String>,
    pub at: String,
    pub valid: bool,
    pub signed_current_version: bool,
}

#[derive(Debug, Clone, Default)]
pub struct VerifyResult {
    pub intact: bool,
    pub frozen: bool,
    pub frozen_at: Option<String>,
    pub signers: Vec<VerifySigner>,
    pub hash: Option<String>,
    pub expected_hash: Option<String>,
    pub error: Option<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct BlockSnapshot {
    pub id: String,
    pub block_type: String,
    pub content: String,
    pub section: String,
    pub properties: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Default)]
pub struct TrustDiff {
    pub added: Vec<BlockSnapshot>,
    pub removed: Vec<BlockSnapshot>,
    pub modified: Vec<(String, BlockSnapshot, BlockSnapshot)>,
    pub moved: Vec<(String, String, String, BlockSnapshot)>,
    pub unchanged: Vec<BlockSnapshot>,
}

pub fn compute_document_hash(source: &str) -> String {
    let boundary = find_history_boundary_in_source(source);
    let content = if boundary < 0 {
        source.to_string()
    } else {
        source.chars().take(boundary as usize).collect::<String>()
    };
    let body = content
        .lines()
        .filter(|line| {
            let t = line.trim_start();
            !(t.starts_with("sign:") || t.starts_with("freeze:") || t.starts_with("amendment:"))
        })
        .collect::<Vec<&str>>()
        .join("\n");
    let mut hasher = Sha256::new();
    hasher.update(body.trim().as_bytes());
    format!("sha256:{}", hex::encode(hasher.finalize()))
}

pub fn find_history_boundary_in_source(source: &str) -> isize {
    let mut pos: isize = 0;
    let lines: Vec<&str> = source.split('\n').collect();
    for i in 0..lines.len() {
        let trimmed = lines[i].trim();
        if trimmed == "history:" {
            return pos;
        }
        if trimmed == "---" && i + 1 < lines.len() {
            let next = lines[i + 1].trim();
            if next == "// history" || next.starts_with("// history") {
                return pos;
            }
        }
        pos += lines[i].len() as isize + 1;
    }
    -1
}

pub fn generate_block_id() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..5].to_string()
}

pub fn block_fingerprint(content: &str) -> String {
    content
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

pub fn match_blocks_to_registry(
    blocks: &[(String, String, String)],
    registry: &[crate::types::RegistryEntry],
) -> std::collections::HashMap<usize, String> {
    let mut result = std::collections::HashMap::new();
    let mut used = std::collections::HashSet::new();

    for (i, (block_type, content, section)) in blocks.iter().enumerate() {
        let fp = block_fingerprint(content);
        if let Some(entry) = registry.iter().find(|r| {
            !r.dead.unwrap_or(false)
                && !used.contains(&r.id)
                && r.block_type == *block_type
                && r.section == *section
                && r.fingerprint == fp
        }) {
            used.insert(entry.id.clone());
            result.insert(i, entry.id.clone());
        }
    }
    result
}

pub fn compute_trust_diff(before: &[BlockSnapshot], after: &[BlockSnapshot]) -> TrustDiff {
    let mut out = TrustDiff::default();
    let before_by_id: std::collections::HashMap<String, BlockSnapshot> =
        before.iter().cloned().map(|b| (b.id.clone(), b)).collect();
    let after_by_id: std::collections::HashMap<String, BlockSnapshot> =
        after.iter().cloned().map(|b| (b.id.clone(), b)).collect();

    for (id, b) in &before_by_id {
        match after_by_id.get(id) {
            None => out.removed.push(b.clone()),
            Some(a) => {
                if b.content != a.content {
                    out.modified.push((id.clone(), b.clone(), a.clone()));
                } else if b.section != a.section {
                    out.moved
                        .push((id.clone(), b.section.clone(), a.section.clone(), a.clone()));
                } else {
                    out.unchanged.push(a.clone());
                }
            }
        }
    }

    for (id, a) in &after_by_id {
        if !before_by_id.contains_key(id) {
            out.added.push(a.clone());
        }
    }

    out
}

pub fn increment_version(current: &str, change_type: &str) -> String {
    let mut parts = current
        .split('.')
        .map(|s| s.parse::<u64>().unwrap_or(0))
        .collect::<Vec<u64>>();
    if parts.is_empty() {
        parts.push(1);
        parts.push(0);
    } else if parts.len() == 1 {
        parts.push(0);
    }
    if change_type == "major" {
        format!("{}.0", parts[0] + 1)
    } else {
        format!("{}.{}", parts[0], parts[1] + 1)
    }
}

pub fn seal_document(source: &str, options: &SealOptions) -> SealResult {
    let hash = compute_document_hash(source);
    let at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let boundary = find_history_boundary_in_source(source);

    let sign_line = if options.skip_sign {
        String::new()
    } else {
        format!(
            "sign: {}{} | at: {} | hash: {}\n",
            options.signer,
            options
                .role
                .as_ref()
                .map(|r| format!(" | role: {r}"))
                .unwrap_or_default(),
            at,
            hash
        )
    };
    let freeze_line = format!("freeze: | at: {} | hash: {} | status: locked\n", at, hash);
    let insertion = format!("{}{}", sign_line, freeze_line);

    let updated = if boundary < 0 {
        format!(
            "{}{}{}",
            source,
            if source.ends_with('\n') { "" } else { "\n" },
            insertion
        )
    } else {
        let idx = boundary as usize;
        let before = &source[..idx];
        let after = &source[idx..];
        format!(
            "{}{}{}{}",
            before,
            if before.ends_with('\n') || before.is_empty() {
                ""
            } else {
                "\n"
            },
            insertion,
            after
        )
    };

    SealResult {
        success: true,
        hash,
        source: updated,
        at,
        error: None,
    }
}

pub fn verify_document(source: &str) -> VerifyResult {
    let doc = parse(source, None);
    let freeze = doc.metadata.as_ref().and_then(|m| m.freeze.as_ref());
    if freeze.is_none() {
        return VerifyResult {
            intact: false,
            frozen: false,
            warning: Some("Document is not sealed. No freeze: block found.".to_string()),
            ..Default::default()
        };
    }

    let current_hash = compute_document_hash(source);
    let expected_hash = freeze.map(|f| f.hash.clone()).unwrap_or_default();
    let intact = current_hash == expected_hash;

    let mut signers = Vec::new();
    if let Some(sigs) = doc.metadata.as_ref().and_then(|m| m.signatures.as_ref()) {
        for sig in sigs {
            signers.push(VerifySigner {
                signer: sig.signer.clone(),
                role: sig.role.clone(),
                at: sig.at.clone(),
                valid: sig.hash == expected_hash,
                signed_current_version: sig.hash == current_hash,
            });
        }
    }

    VerifyResult {
        intact,
        frozen: true,
        frozen_at: freeze.map(|f| f.at.clone()),
        signers,
        hash: Some(current_hash),
        expected_hash: Some(expected_hash),
        error: if intact {
            None
        } else {
            Some("Document has been modified since sealing.".to_string())
        },
        warning: None,
    }
}

// ─── canonical content ────────────────────────────────────────────────────────

/// Produce a deterministic canonical string for hashing.
/// Block types: sign, freeze, amendment are excluded.
fn canonical_content(document: &IntentDocument) -> String {
    let excluded = ["sign", "freeze", "amendment"];
    let mut out = String::new();

    for block in &document.blocks {
        if excluded.contains(&block.block_type.as_str()) {
            continue;
        }

        // block_type
        out.push_str(&block.block_type);
        out.push('\n');

        // content
        out.push_str(&block.content);
        out.push('\n');

        // sorted properties
        if let Some(props) = &block.properties {
            let mut sorted: Vec<(&String, &String)> = props.iter().collect();
            sorted.sort_by_key(|(k, _)| k.as_str());
            for (k, v) in sorted {
                let _ = writeln!(out, "{k}={v}");
            }
        }

        out.push('\0');
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn hash_is_deterministic() {
        let doc = parse("title: My Doc\ntext: Hello World", None);
        let h1 = compute_hash(&doc);
        let h2 = compute_hash(&doc);
        assert_eq!(h1, h2);
        assert!(h1.starts_with("sha256:"));
    }

    #[test]
    fn hash_changes_on_content_change() {
        let doc1 = parse("text: Hello", None);
        let doc2 = parse("text: Different", None);
        assert_ne!(compute_hash(&doc1), compute_hash(&doc2));
    }

    #[test]
    fn sign_appends_sign_block() {
        let doc = parse("title: Contract", None);
        let signed = seal(&doc, "Alice", Some("reviewer"));
        assert!(signed.blocks.iter().any(|b| b.block_type == "sign"));
    }

    #[test]
    fn freeze_and_verify() {
        let doc = parse("title: Report\ntext: Contents here.", None);
        let frozen = freeze(&doc, Some("v1.0"));
        assert!(verify(&frozen).is_ok());
    }

    #[test]
    fn verification_fails_after_tampering() {
        let doc = parse("title: Report\ntext: Contents here.", None);
        let mut frozen = freeze(&doc, None);
        // Tamper: change content of a block
        frozen.blocks[0].content = "Tampered".to_string();
        assert!(verify(&frozen).is_err());
    }

    #[test]
    fn sign_excluded_from_hash() {
        let doc = parse("title: Doc\ntext: Body", None);
        let h_before = compute_hash(&doc);
        let signed = seal(&doc, "Bob", None);
        let h_after = compute_hash(&signed);
        // hash should NOT change when only sign: is added (it's excluded)
        assert_eq!(h_before, h_after);
    }

    #[test]
    fn amend_adds_amendment_block() {
        let doc = parse("title: Policy\ntext: Original.", None);
        let frozen = freeze(&doc, None);
        let amended = amend(&frozen, "Clarified section 2", Some("Editor"));
        assert!(amended.blocks.iter().any(|b| b.block_type == "amendment"));
    }

    #[test]
    fn source_hash_ignores_sign_and_freeze_lines() {
        let src = "title: A\ntext: B\nsign: Alice | at: now | hash: x\nfreeze: | at: now | hash: y | status: locked\n";
        let h1 = compute_document_hash(src);
        let h2 = compute_document_hash("title: A\ntext: B\n");
        assert_eq!(h1, h2);
    }

    #[test]
    fn verify_document_reports_non_frozen() {
        let v = verify_document("title: A\ntext: B");
        assert!(!v.frozen);
        assert!(v.warning.is_some());
    }
}
