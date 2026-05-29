//! Workflow graph extraction.
//!
//! Parity target: packages/core/src/workflow.ts

use std::collections::{HashMap, HashSet};

use crate::types::{IntentBlock, IntentDocument};

#[derive(Debug, Clone)]
pub struct WorkflowStep {
    pub block: IntentBlock,
    pub depends_on: Vec<String>,
    pub depended_on_by: Vec<String>,
    pub is_gate: bool,
    pub is_terminal: bool,
    pub is_parallel: bool,
}

#[derive(Debug, Clone)]
pub struct WorkflowGraph {
    pub entry_points: Vec<String>,
    pub steps: HashMap<String, WorkflowStep>,
    pub execution_order: Vec<Vec<String>>,
    pub gate_positions: Vec<usize>,
    pub has_terminal: bool,
    pub warnings: Vec<String>,
}

const WORKFLOW_TYPES: &[&str] = &[
    "step",
    "gate",
    "decision",
    "parallel",
    "wait",
    "result",
    "checkpoint",
    "retry",
    "call",
    "handoff",
    "trigger",
    "loop",
    "signal",
    "error",
    "audit",
];

pub fn extract_workflow(doc: &IntentDocument) -> WorkflowGraph {
    if doc.blocks.is_empty() {
        return WorkflowGraph {
            entry_points: vec![],
            steps: HashMap::new(),
            execution_order: vec![],
            gate_positions: vec![],
            has_terminal: false,
            warnings: vec!["Empty or invalid document".to_string()],
        };
    }

    let mut warnings = Vec::new();
    let mut workflow_blocks: Vec<(IntentBlock, bool)> = Vec::new();
    collect_workflow_blocks(&doc.blocks, false, &mut workflow_blocks);

    if workflow_blocks.is_empty() {
        return WorkflowGraph {
            entry_points: vec![],
            steps: HashMap::new(),
            execution_order: vec![],
            gate_positions: vec![],
            has_terminal: false,
            warnings: vec!["No workflow blocks found".to_string()],
        };
    }

    let mut steps: HashMap<String, WorkflowStep> = HashMap::new();
    for (block, is_parallel) in workflow_blocks {
        let step_id = block
            .properties
            .as_ref()
            .and_then(|p| p.get("id").cloned())
            .unwrap_or_else(|| block.id.clone());

        if steps.contains_key(&step_id) {
            warnings.push(format!("Duplicate step ID: {step_id}"));
            continue;
        }

        steps.insert(
            step_id,
            WorkflowStep {
                is_gate: block.block_type == "gate",
                is_terminal: block.block_type == "result",
                block,
                depends_on: vec![],
                depended_on_by: vec![],
                is_parallel,
            },
        );
    }

    let ids: Vec<String> = steps.keys().cloned().collect();
    for id in &ids {
        let depends_raw = steps
            .get(id)
            .and_then(|s| s.block.properties.as_ref())
            .and_then(|p| p.get("depends").cloned());

        if let Some(depends) = depends_raw {
            let deps: Vec<String> = depends
                .split(',')
                .map(|d| d.trim().to_string())
                .filter(|d| !d.is_empty())
                .collect();
            for dep in deps {
                if !steps.contains_key(&dep) {
                    warnings.push(format!("Step \"{id}\" depends on unknown step \"{dep}\""));
                    continue;
                }
                if let Some(step) = steps.get_mut(id) {
                    step.depends_on.push(dep.clone());
                }
                if let Some(step_dep) = steps.get_mut(&dep) {
                    step_dep.depended_on_by.push(id.clone());
                }
            }
        }
    }

    let mut in_degree: HashMap<String, usize> = HashMap::new();
    for (id, step) in &steps {
        in_degree.insert(id.clone(), step.depends_on.len());
    }

    let mut execution_order: Vec<Vec<String>> = Vec::new();
    let mut processed: HashSet<String> = HashSet::new();
    let total = steps.len();
    let mut guard = 0usize;

    while processed.len() < total && guard < total + 1 {
        guard += 1;
        let mut batch: Vec<String> = steps
            .keys()
            .filter(|id| !processed.contains(*id) && in_degree.get(*id).copied().unwrap_or(0) == 0)
            .cloned()
            .collect();
        batch.sort();

        if batch.is_empty() {
            let mut remaining: Vec<String> = steps
                .keys()
                .filter(|id| !processed.contains(*id))
                .cloned()
                .collect();
            remaining.sort();
            warnings.push(format!(
                "Cycle detected involving: {}",
                remaining.join(", ")
            ));
            execution_order.push(remaining.clone());
            for id in remaining {
                processed.insert(id);
            }
            break;
        }

        execution_order.push(batch.clone());
        for id in batch {
            processed.insert(id.clone());
            if let Some(step) = steps.get(&id) {
                for dependent in &step.depended_on_by {
                    if let Some(v) = in_degree.get_mut(dependent) {
                        *v = v.saturating_sub(1);
                    }
                }
            }
        }
    }

    let mut entry_points: Vec<String> = steps
        .iter()
        .filter_map(|(id, step)| {
            if step.depends_on.is_empty() {
                Some(id.clone())
            } else {
                None
            }
        })
        .collect();
    entry_points.sort();

    let mut gate_positions = Vec::new();
    for (idx, batch) in execution_order.iter().enumerate() {
        if batch
            .iter()
            .any(|id| steps.get(id).map(|s| s.is_gate).unwrap_or(false))
        {
            gate_positions.push(idx);
        }
    }

    let has_terminal = steps.values().any(|s| s.is_terminal);

    WorkflowGraph {
        entry_points,
        steps,
        execution_order,
        gate_positions,
        has_terminal,
        warnings,
    }
}

fn collect_workflow_blocks(
    blocks: &[IntentBlock],
    inside_parallel: bool,
    out: &mut Vec<(IntentBlock, bool)>,
) {
    for block in blocks {
        let in_parallel = inside_parallel || block.block_type == "parallel";
        if WORKFLOW_TYPES.contains(&block.block_type.as_str()) {
            out.push((block.clone(), in_parallel));
        }
        if let Some(children) = &block.children {
            collect_workflow_blocks(children, in_parallel, out);
        }
    }
}
