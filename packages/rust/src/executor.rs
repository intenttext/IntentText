//! Workflow executor — runs IntentText workflow documents.
//!
//! Parity target: packages/core/src/executor.ts
//!
//! The executor is synchronous-by-default in Rust (async behind a feature flag).
//! Callers provide tool handlers as boxed closures.

use crate::types::{IntentBlock, IntentDocument};
use std::collections::HashMap;

// ─── Public types ─────────────────────────────────────────────────────────────

/// The result from executing a workflow.
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    /// The document with status: written back to each processed block.
    pub document: IntentDocument,
    /// Final execution context (all variables and outputs).
    pub context: HashMap<String, serde_json::Value>,
    /// Execution log — one entry per block processed.
    pub log: Vec<ExecutionLogEntry>,
    /// Overall status.
    pub status: ExecutionStatus,
    /// Error message if status is `Error`.
    pub error: Option<String>,
    /// The gate block that blocked execution, if `GateBlocked`.
    pub blocked_at: Option<IntentBlock>,
    /// The policy block that blocked execution, if `PolicyBlocked`.
    pub blocked_by_policy: Option<IntentBlock>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExecutionStatus {
    Completed,
    GateBlocked,
    PolicyBlocked,
    Error,
    DryRun,
}

impl ExecutionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExecutionStatus::Completed => "completed",
            ExecutionStatus::GateBlocked => "gate_blocked",
            ExecutionStatus::PolicyBlocked => "policy_blocked",
            ExecutionStatus::Error => "error",
            ExecutionStatus::DryRun => "dry_run",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExecutionLogEntry {
    pub block_id: String,
    pub block_type: String,
    pub content: String,
    pub status: LogEntryStatus,
    pub input: Option<serde_json::Value>,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub duration_ms: Option<u64>,
    pub timestamp: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LogEntryStatus {
    Skipped,
    Running,
    Completed,
    Failed,
    Blocked,
    DryRun,
}

/// Options controlling execution behaviour.
#[derive(Debug, Clone)]
pub struct ExecutionOptions {
    /// Maximum steps to execute. Default: 1000.
    pub max_steps: usize,
    /// What to do when a tool is not registered. Default: `Warn`.
    pub unknown_tool: UnknownToolPolicy,
    /// Evaluate decisions and validate but do not call tools. Default: false.
    pub dry_run: bool,
}

impl Default for ExecutionOptions {
    fn default() -> Self {
        Self {
            max_steps: 1000,
            unknown_tool: UnknownToolPolicy::Warn,
            dry_run: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UnknownToolPolicy {
    Skip,
    Error,
    Warn,
}

/// A synchronous tool handler.
pub type ToolHandler = Box<
    dyn Fn(
        &serde_json::Value,
        &HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, String>,
>;

/// Gate approval callback used by `gate:` blocks.
pub type GateHandler = Box<dyn Fn(&IntentBlock, &HashMap<String, serde_json::Value>) -> bool>;

/// Runtime provided by the caller.
#[derive(Default)]
pub struct WorkflowRuntime {
    /// Tool implementations keyed by `tool:` property value.
    pub tools: HashMap<String, ToolHandler>,
    /// Initial context variables.
    pub context: HashMap<String, serde_json::Value>,
    /// Gate handler — called when a gate: block is reached.
    /// Returns true (approved) or false (rejected).
    pub on_gate: Option<GateHandler>,
    /// Options.
    pub options: ExecutionOptions,
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/// Execute a workflow document synchronously.
///
/// Steps are executed in document order. Each `step:` block calls the
/// registered tool handler. `gate:` blocks pause execution if no `on_gate`
/// handler is provided, or if the handler returns false.
pub fn execute_workflow(document: &IntentDocument, runtime: &WorkflowRuntime) -> ExecutionResult {
    let options = &runtime.options;
    let mut ctx = runtime.context.clone();

    // Merge document context: blocks into ctx
    for block in &document.blocks {
        if block.block_type == "context" {
            if let Some(props) = &block.properties {
                for (k, v) in props {
                    ctx.insert(k.clone(), serde_json::Value::String(v.clone()));
                }
            }
            // Also support inline context content: "context: key = value".
            if block
                .properties
                .as_ref()
                .map(|p| p.is_empty())
                .unwrap_or(true)
            {
                if let Some((k, v)) = parse_inline_context_assignment(&block.content) {
                    ctx.insert(k, serde_json::Value::String(v));
                }
            }
        }
    }

    // Collect policy: blocks
    let policies: Vec<&IntentBlock> = document
        .blocks
        .iter()
        .filter(|b| b.block_type == "policy")
        .collect();

    // ── Policy enforcement (requires: gate) ────────────────────────────────
    for policy in &policies {
        let requires = policy
            .properties
            .as_ref()
            .and_then(|p| p.get("requires"))
            .map(String::as_str);

        if requires != Some("gate") {
            continue;
        }

        let condition = policy.properties.as_ref().and_then(|p| {
            p.get("if").cloned().or_else(|| {
                if p.contains_key("always") {
                    Some("true".to_string())
                } else {
                    None
                }
            })
        });

        if !evaluate_condition(condition.as_deref(), &ctx) {
            continue;
        }

        // Check if any gate block has status: approved
        let has_approved_gate = document.blocks.iter().any(|b| {
            b.block_type == "gate"
                && b.properties
                    .as_ref()
                    .and_then(|p| p.get("status"))
                    .map(String::as_str)
                    == Some("approved")
        });

        if !has_approved_gate {
            return ExecutionResult {
                document: document.clone(),
                context: ctx,
                log: vec![],
                status: ExecutionStatus::PolicyBlocked,
                error: Some(format!(
                    "Policy \"{}\" requires an approved gate but none found",
                    policy.content
                )),
                blocked_at: None,
                blocked_by_policy: Some((*policy).clone()),
            };
        }
    }

    // ── Execution loop ─────────────────────────────────────────────────────
    let mut log: Vec<ExecutionLogEntry> = Vec::new();
    let mut result_doc = document.clone();
    let mut step_count = 0usize;

    let block_count = document.blocks.len();
    for idx in 0..block_count {
        if step_count >= options.max_steps {
            return ExecutionResult {
                document: result_doc,
                context: ctx,
                log,
                status: ExecutionStatus::Error,
                error: Some(format!("Max steps ({}) reached", options.max_steps)),
                blocked_at: None,
                blocked_by_policy: None,
            };
        }

        let block = &document.blocks[idx];
        let ts = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

        let block_id = block
            .properties
            .as_ref()
            .and_then(|p| p.get("id"))
            .cloned()
            .unwrap_or_else(|| format!("block-{idx}"));

        let mut entry = ExecutionLogEntry {
            block_id: block_id.clone(),
            block_type: block.block_type.clone(),
            content: block.content.clone(),
            status: LogEntryStatus::Running,
            input: None,
            output: None,
            error: None,
            duration_ms: None,
            timestamp: ts,
        };

        let t_start = std::time::Instant::now();

        match block.block_type.as_str() {
            "step" => {
                let tool_name = block
                    .properties
                    .as_ref()
                    .and_then(|p| p.get("tool"))
                    .cloned();
                let input_key = block
                    .properties
                    .as_ref()
                    .and_then(|p| p.get("input"))
                    .cloned();
                let output_key = block
                    .properties
                    .as_ref()
                    .and_then(|p| p.get("output"))
                    .cloned();

                let input = input_key
                    .as_deref()
                    .map(|k| resolve_value(k, &ctx))
                    .unwrap_or(serde_json::Value::Null);

                entry.input = Some(input.clone());

                if options.dry_run {
                    entry.status = LogEntryStatus::DryRun;
                    write_status_on_doc(&mut result_doc, idx, "dry_run");
                } else {
                    match tool_name {
                        None => {
                            entry.status = LogEntryStatus::Skipped;
                            write_status_on_doc(&mut result_doc, idx, "skipped");
                        }
                        Some(tn) => match runtime.tools.get(&tn) {
                            None => match options.unknown_tool {
                                UnknownToolPolicy::Error => {
                                    let err_msg = format!("No tool handler registered for: {tn}");
                                    entry.status = LogEntryStatus::Failed;
                                    entry.error = Some(err_msg.clone());
                                    entry.duration_ms = Some(t_start.elapsed().as_millis() as u64);
                                    log.push(entry);
                                    return ExecutionResult {
                                        document: result_doc,
                                        context: ctx,
                                        log,
                                        status: ExecutionStatus::Error,
                                        error: Some(err_msg),
                                        blocked_at: None,
                                        blocked_by_policy: None,
                                    };
                                }
                                _ => {
                                    entry.status = LogEntryStatus::Skipped;
                                    write_status_on_doc(&mut result_doc, idx, "skipped");
                                }
                            },
                            Some(handler) => match handler(&input, &ctx) {
                                Ok(output) => {
                                    if let Some(ok) = &output_key {
                                        ctx.insert(ok.clone(), output.clone());
                                    }
                                    entry.output = Some(output);
                                    entry.status = LogEntryStatus::Completed;
                                    write_status_on_doc(&mut result_doc, idx, "done");
                                    step_count += 1;
                                }
                                Err(e) => {
                                    entry.status = LogEntryStatus::Failed;
                                    entry.error = Some(e.clone());
                                    entry.duration_ms = Some(t_start.elapsed().as_millis() as u64);
                                    log.push(entry);
                                    return ExecutionResult {
                                        document: result_doc,
                                        context: ctx,
                                        log,
                                        status: ExecutionStatus::Error,
                                        error: Some(e),
                                        blocked_at: None,
                                        blocked_by_policy: None,
                                    };
                                }
                            },
                        },
                    }
                }
            }

            "decision" => {
                let condition = block
                    .properties
                    .as_ref()
                    .and_then(|p| p.get("if"))
                    .map(String::as_str);
                let then_target = block
                    .properties
                    .as_ref()
                    .and_then(|p| p.get("then"))
                    .cloned();
                let else_target = block
                    .properties
                    .as_ref()
                    .and_then(|p| p.get("else"))
                    .cloned();

                let result = evaluate_condition(condition, &ctx);
                let branch = if result { then_target } else { else_target };

                ctx.insert(
                    "__lastDecision".to_string(),
                    serde_json::json!({
                        "condition": condition,
                        "result": result,
                        "took": branch
                    }),
                );

                entry.status = LogEntryStatus::Completed;
                write_status_on_doc(&mut result_doc, idx, "done");
            }

            "gate" => {
                if options.dry_run {
                    entry.status = LogEntryStatus::DryRun;
                    write_status_on_doc(&mut result_doc, idx, "dry_run");
                } else {
                    let gate_block = block.clone();
                    match &runtime.on_gate {
                        None => {
                            write_status_on_doc(&mut result_doc, idx, "blocked");
                            entry.status = LogEntryStatus::Blocked;
                            entry.duration_ms = Some(t_start.elapsed().as_millis() as u64);
                            log.push(entry);
                            return ExecutionResult {
                                document: result_doc,
                                context: ctx,
                                log,
                                status: ExecutionStatus::GateBlocked,
                                error: None,
                                blocked_at: Some(gate_block),
                                blocked_by_policy: None,
                            };
                        }
                        Some(handler) => {
                            let approved = handler(&gate_block, &ctx);
                            if !approved {
                                write_status_on_doc(&mut result_doc, idx, "rejected");
                                entry.status = LogEntryStatus::Blocked;
                                entry.duration_ms = Some(t_start.elapsed().as_millis() as u64);
                                log.push(entry);
                                return ExecutionResult {
                                    document: result_doc,
                                    context: ctx,
                                    log,
                                    status: ExecutionStatus::GateBlocked,
                                    error: None,
                                    blocked_at: Some(gate_block),
                                    blocked_by_policy: None,
                                };
                            }
                            write_status_on_doc(&mut result_doc, idx, "approved");
                            entry.status = LogEntryStatus::Completed;
                        }
                    }
                }
            }

            "audit" | "result" => {
                let resolved = resolve_template(&block.content, &ctx);
                result_doc.blocks[idx].content = resolved;
                entry.status = LogEntryStatus::Completed;
                write_status_on_doc(&mut result_doc, idx, "done");
            }

            "trigger" => {
                entry.status = LogEntryStatus::Completed;
                write_status_on_doc(&mut result_doc, idx, "done");
            }

            _ => {
                entry.status = LogEntryStatus::Skipped;
            }
        }

        entry.duration_ms = Some(t_start.elapsed().as_millis() as u64);
        log.push(entry);
    }

    ExecutionResult {
        document: result_doc,
        context: ctx,
        log,
        status: if options.dry_run {
            ExecutionStatus::DryRun
        } else {
            ExecutionStatus::Completed
        },
        error: None,
        blocked_at: None,
        blocked_by_policy: None,
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn write_status_on_doc(doc: &mut IntentDocument, idx: usize, status: &str) {
    if let Some(block) = doc.blocks.get_mut(idx) {
        let props = block.properties.get_or_insert_with(HashMap::new);
        props.insert("status".to_string(), status.to_string());
    }
}

/// Resolve a value expression from context.
/// Single `{{var}}` returns the JSON value. Mixed templates stringify.
fn resolve_value(expr: &str, ctx: &HashMap<String, serde_json::Value>) -> serde_json::Value {
    let trimmed = expr.trim();
    // Exact single reference: {{var}}
    if let Some(caps) = trimmed
        .strip_prefix("{{")
        .and_then(|s| s.strip_suffix("}}"))
    {
        let path = caps.trim();
        if let Some(v) = get_by_path(ctx, path) {
            return v;
        }
    }
    serde_json::Value::String(resolve_template(trimmed, ctx))
}

/// Replace all `{{var}}` in a template string with context values.
fn resolve_template(template: &str, ctx: &HashMap<String, serde_json::Value>) -> String {
    if !template.contains("{{") {
        return template.to_string();
    }
    let mut result = String::with_capacity(template.len());
    let mut rest = template;
    while let Some(start) = rest.find("{{") {
        result.push_str(&rest[..start]);
        rest = &rest[start + 2..];
        if let Some(end) = rest.find("}}") {
            let path = rest[..end].trim();
            if let Some(v) = get_by_path(ctx, path) {
                match &v {
                    serde_json::Value::String(s) => result.push_str(s),
                    other => result.push_str(&other.to_string()),
                }
            } else {
                result.push_str("{{");
                result.push_str(&rest[..end]);
                result.push_str("}}");
            }
            rest = &rest[end + 2..];
        } else {
            result.push_str("{{");
        }
    }
    result.push_str(rest);
    result
}

/// Safe dotted-path resolution — guards against `__proto__`/prototype.
fn get_by_path(ctx: &HashMap<String, serde_json::Value>, path: &str) -> Option<serde_json::Value> {
    const DANGEROUS: &[&str] = &["__proto__", "constructor", "prototype"];
    let parts: Vec<&str> = path.splitn(20, '.').collect();

    // Top-level key from HashMap
    let first = parts[0];
    if DANGEROUS.contains(&first) {
        return None;
    }
    let mut cur = ctx.get(first);

    for part in &parts[1..] {
        if DANGEROUS.contains(part) {
            return None;
        }
        cur = match cur? {
            serde_json::Value::Object(map) => map.get(*part),
            serde_json::Value::Array(arr) => {
                let idx: usize = part.parse().ok()?;
                arr.get(idx)
            }
            _ => return None,
        };
    }
    cur.cloned()
}

fn parse_inline_context_assignment(content: &str) -> Option<(String, String)> {
    let mut parts = content.splitn(2, '=');
    let key = parts.next()?.trim();
    let value = parts.next()?.trim();
    if key.is_empty() {
        return None;
    }
    Some((key.to_string(), value.to_string()))
}

/// Evaluate a simple boolean condition string against context.
/// Supports: `{{var}} == value`, `&&`, `||`, literals (true/false/null/numbers/strings).
fn evaluate_condition(condition: Option<&str>, ctx: &HashMap<String, serde_json::Value>) -> bool {
    let cond = match condition {
        None | Some("") => return true,
        Some(c) => c.trim(),
    };

    // "true" / "always"
    if cond.eq_ignore_ascii_case("true") || cond.eq_ignore_ascii_case("always") {
        return true;
    }
    if cond.eq_ignore_ascii_case("false") {
        return false;
    }

    // Handle `||` at top level
    if let Some((left, right)) = split_binary_op(cond, "||") {
        return evaluate_condition(Some(left), ctx) || evaluate_condition(Some(right), ctx);
    }
    // Handle `&&`
    if let Some((left, right)) = split_binary_op(cond, "&&") {
        return evaluate_condition(Some(left), ctx) && evaluate_condition(Some(right), ctx);
    }

    // Comparison expressions: LHS OP RHS
    for op in &["==", "!=", "<=", ">=", "<", ">"] {
        if let Some((lhs, rhs)) = split_binary_op(cond, op) {
            let lv = eval_atom(lhs.trim(), ctx);
            let rv = eval_atom(rhs.trim(), ctx);
            return compare_values(op, &lv, &rv);
        }
    }

    // Truthy check on a single atom
    let val = eval_atom(cond, ctx);
    is_truthy(&val)
}

fn split_binary_op<'a>(s: &'a str, op: &str) -> Option<(&'a str, &'a str)> {
    let idx = s.find(op)?;
    // Make sure the `<`/`>` aren't part of `<=`/`>=`
    if op == "<" || op == ">" {
        let after = s.get(idx + 1..).unwrap_or("");
        if after.starts_with('=') {
            return None;
        }
    }
    Some((&s[..idx], &s[idx + op.len()..]))
}

fn eval_atom(s: &str, ctx: &HashMap<String, serde_json::Value>) -> serde_json::Value {
    let s = s.trim();
    if s.starts_with("{{") && s.ends_with("}}") {
        let path = s[2..s.len() - 2].trim();
        return get_by_path(ctx, path).unwrap_or(serde_json::Value::Null);
    }
    if s.eq_ignore_ascii_case("true") {
        return serde_json::Value::Bool(true);
    }
    if s.eq_ignore_ascii_case("false") {
        return serde_json::Value::Bool(false);
    }
    if s.eq_ignore_ascii_case("null") {
        return serde_json::Value::Null;
    }
    if let Ok(n) = s.parse::<f64>() {
        return serde_json::json!(n);
    }
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        return serde_json::Value::String(s[1..s.len() - 1].to_string());
    }
    serde_json::Value::String(s.to_string())
}

fn compare_values(op: &str, left: &serde_json::Value, right: &serde_json::Value) -> bool {
    match op {
        "==" => json_eq(left, right),
        "!=" => !json_eq(left, right),
        "<" | ">" | "<=" | ">=" => {
            let l = to_f64(left);
            let r = to_f64(right);
            match op {
                "<" => l < r,
                ">" => l > r,
                "<=" => l <= r,
                ">=" => l >= r,
                _ => false,
            }
        }
        _ => false,
    }
}

fn json_eq(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    // Loose equality: coerce strings/numbers
    match (a, b) {
        (serde_json::Value::String(sa), serde_json::Value::String(sb)) => sa == sb,
        (serde_json::Value::Number(na), serde_json::Value::Number(nb)) => na == nb,
        (serde_json::Value::Bool(ba), serde_json::Value::Bool(bb)) => ba == bb,
        (serde_json::Value::Null, serde_json::Value::Null) => true,
        // Cross-type: compare string representations
        _ => to_string_val(a) == to_string_val(b),
    }
}

fn to_string_val(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

fn to_f64(v: &serde_json::Value) -> f64 {
    match v {
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        serde_json::Value::String(s) => s.parse().unwrap_or(f64::NAN),
        serde_json::Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        _ => f64::NAN,
    }
}

fn is_truthy(v: &serde_json::Value) -> bool {
    match v {
        serde_json::Value::Null => false,
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
        serde_json::Value::String(s) => !s.is_empty() && s != "false" && s != "0",
        serde_json::Value::Array(a) => !a.is_empty(),
        serde_json::Value::Object(o) => !o.is_empty(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn simple_workflow_completes() {
        let doc = parse("step: greet | tool: greet", None);
        let mut runtime = WorkflowRuntime::default();
        runtime.tools.insert(
            "greet".to_string(),
            Box::new(|_input, _ctx| Ok(serde_json::json!("hello"))),
        );
        let result = execute_workflow(&doc, &runtime);
        assert_eq!(result.status, ExecutionStatus::Completed);
    }

    #[test]
    fn policy_blocked_without_approved_gate() {
        let doc = parse(
            "policy: Needs approval | requires: gate | always: true | action: reject\nstep: do work | tool: do_it",
            None,
        );
        let runtime = WorkflowRuntime::default();
        let result = execute_workflow(&doc, &runtime);
        assert_eq!(result.status, ExecutionStatus::PolicyBlocked);
        assert!(result.blocked_by_policy.is_some());
    }

    #[test]
    fn gate_blocks_without_handler() {
        let doc = parse("gate: Need approval | approver: alice", None);
        let runtime = WorkflowRuntime::default();
        let result = execute_workflow(&doc, &runtime);
        assert_eq!(result.status, ExecutionStatus::GateBlocked);
    }

    #[test]
    fn gate_passes_with_approving_handler() {
        let doc = parse(
            "gate: Need approval | approver: alice\nstep: post-gate | tool: work",
            None,
        );
        let mut runtime = WorkflowRuntime::default();
        runtime.tools.insert(
            "work".to_string(),
            Box::new(|_, _| Ok(serde_json::json!("done"))),
        );
        runtime.on_gate = Some(Box::new(|_gate, _ctx| true));
        let result = execute_workflow(&doc, &runtime);
        assert_eq!(result.status, ExecutionStatus::Completed);
    }

    #[test]
    fn dry_run_does_not_call_tools() {
        let doc = parse("step: important | tool: dangerous", None);
        let mut runtime = WorkflowRuntime::default();
        runtime.options.dry_run = true;
        runtime.tools.insert(
            "dangerous".to_string(),
            Box::new(|_, _| panic!("Should not be called in dry run")),
        );
        let result = execute_workflow(&doc, &runtime);
        assert_eq!(result.status, ExecutionStatus::DryRun);
    }

    #[test]
    fn context_variable_resolved_in_audit() {
        let doc = parse("context: name = Alice\naudit: Reviewed by {{name}}", None);
        let runtime = WorkflowRuntime::default();
        let result = execute_workflow(&doc, &runtime);
        let audit = result
            .document
            .blocks
            .iter()
            .find(|b| b.block_type == "audit")
            .unwrap();
        assert_eq!(audit.content, "Reviewed by Alice");
    }

    #[test]
    fn decision_evaluates_condition() {
        let doc = parse(
            "decision: Route | if: {{score}} >= 90 | then: high | else: low",
            None,
        );
        let mut runtime = WorkflowRuntime::default();
        runtime
            .context
            .insert("score".to_string(), serde_json::json!(95));
        let result = execute_workflow(&doc, &runtime);
        assert_eq!(result.status, ExecutionStatus::Completed);
        let decision = result.context.get("__lastDecision").unwrap();
        assert_eq!(decision["result"], serde_json::json!(true));
    }
}
