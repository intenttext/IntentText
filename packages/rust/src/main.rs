use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use intenttext::{
    ask_documents, build_index_entry, convert_html_to_intenttext, convert_markdown_to_intenttext,
    find_history_boundary_in_source, format_csv, format_json, format_query_result, format_table,
    parse, parse_history_section, parse_query, query_document, register_workspace, render,
    seal_document, to_source, validate, verify_document, AskOptions, ComposedResult, SealOptions,
};

fn print_usage() {
    println!(
        "IntentText Rust CLI\n\nUsage:\n  intenttext-cli <file.it>                 Parse and print JSON\n  intenttext-cli <file.it> --html          Render HTML to stdout\n  intenttext-cli <file.it> --output        Write <file>.html\n  intenttext-cli <file.md> --to-it         Convert Markdown to IntentText\n  intenttext-cli <file.html> --to-it       Convert HTML to IntentText\n  intenttext-cli <file> --to-it --output   Write converted .it next to source\n\n  intenttext-cli validate <file.it> [--json]\n  intenttext-cli query <file.it> <query> [--json]\n  intenttext-cli index <dir> [--recursive]\n  intenttext-cli ask <dir> <question> [--format text|json]\n  intenttext-cli seal <file.it> --signer <name> [--role <role>] [--no-sign]\n  intenttext-cli verify <file.it>\n  intenttext-cli history <file.it> [--json] [--by <name>] [--section <name>] [--block <id>]\n  intenttext-cli amend <file.it> --now <text> --ref <ref> [--section <name>] [--was <text>] [--by <name>]\n"
    );
}

fn arg_value(args: &[String], key: &str) -> Option<String> {
    args.iter()
        .position(|a| a == key)
        .and_then(|idx| args.get(idx + 1).cloned())
}

fn collect_it_files(target: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if target.is_file() {
        if target.extension().and_then(|v| v.to_str()) == Some("it") {
            files.push(target.to_path_buf());
        }
        return files;
    }

    if !target.is_dir() {
        return files;
    }

    let mut stack = vec![target.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(v) => v,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.extension().and_then(|v| v.to_str()) == Some("it") {
                files.push(p);
            }
        }
    }
    files
}

fn collect_subdirs(root: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![root.to_path_buf()];
    let mut out = Vec::new();
    while let Some(dir) = dirs.pop() {
        out.push(dir.clone());
        let entries = match fs::read_dir(&dir) {
            Ok(v) => v,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                dirs.push(p);
            }
        }
    }
    out
}

fn with_extension(path: &Path, ext: &str) -> PathBuf {
    let mut out = path.to_path_buf();
    out.set_extension(ext);
    out
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();

    if args.is_empty() || args.iter().any(|a| a == "--help" || a == "-h") {
        print_usage();
        return;
    }

    if args[0] == "validate" {
        if args.len() < 2 {
            eprintln!("Missing input file: intenttext-cli validate <file.it> [--json]");
            std::process::exit(2);
        }
        let input = &args[1];
        let as_json = args.iter().any(|a| a == "--json");
        let source = match fs::read_to_string(input) {
            Ok(v) => v,
            Err(err) => {
                eprintln!("Failed to read {}: {err}", input);
                std::process::exit(1);
            }
        };

        let document = parse(&source, None);
        let diagnostics = validate(&document);
        if as_json {
            match serde_json::to_string_pretty(&diagnostics) {
                Ok(json) => println!("{}", json),
                Err(err) => {
                    eprintln!("Failed to serialize diagnostics: {err}");
                    std::process::exit(1);
                }
            }
            return;
        }

        if diagnostics.is_empty() {
            println!("No semantic issues.");
            return;
        }

        for d in diagnostics {
            println!("[{}] {}", d.code.as_str(), d.message);
        }
        return;
    }

    if args[0] == "query" {
        if args.len() < 3 {
            eprintln!("Missing arguments: intenttext-cli query <file.it> <query> [--json]");
            std::process::exit(2);
        }
        let input = &args[1];
        let as_json = args.iter().any(|a| a == "--json");
        let query_string = args[2..]
            .iter()
            .filter(|a| a.as_str() != "--json")
            .cloned()
            .collect::<Vec<String>>()
            .join(" ");

        let source = match fs::read_to_string(input) {
            Ok(v) => v,
            Err(err) => {
                eprintln!("Failed to read {}: {err}", input);
                std::process::exit(1);
            }
        };
        let document = parse(&source, None);
        let parsed = parse_query(&query_string);
        let result = query_document(&document, &query_string);

        if as_json {
            let mut rows: Vec<serde_json::Value> = Vec::new();
            for b in result.blocks {
                rows.push(serde_json::json!({
                    "type": b.block_type,
                    "content": b.content,
                    "properties": b.properties,
                }));
            }
            let payload = serde_json::json!({
                "query": query_string,
                "options": {
                    "type": parsed.block_type,
                    "search": parsed.search,
                    "limit": parsed.limit,
                    "offset": parsed.offset,
                    "sortBy": parsed.sort_by,
                    "sortOrder": parsed.sort_order,
                },
                "total": result.total,
                "results": rows,
            });
            match serde_json::to_string_pretty(&payload) {
                Ok(json) => println!("{}", json),
                Err(err) => {
                    eprintln!("Failed to serialize query results: {err}");
                    std::process::exit(1);
                }
            }
            return;
        }

        println!("{}", format_query_result(&result));
        return;
    }

    if args[0] == "index" {
        if args.len() < 2 {
            eprintln!("Missing directory: intenttext-cli index <dir> [--recursive]");
            std::process::exit(2);
        }
        let target = Path::new(&args[1]);
        if !target.exists() || !target.is_dir() {
            eprintln!("Not a directory: {}", target.display());
            std::process::exit(2);
        }

        let recursive = args.iter().any(|a| a == "--recursive");
        let dirs = if recursive {
            collect_subdirs(target)
        } else {
            vec![target.to_path_buf()]
        };

        for dir in dirs {
            let info = match register_workspace(&dir) {
                Ok(v) => v,
                Err(err) => {
                    eprintln!("Failed to index {}: {err}", dir.display());
                    std::process::exit(1);
                }
            };
            println!(
                "Indexed {} (collections={}, docs={}) -> {}",
                info.path, info.collection_count, info.document_count, info.index_path
            );
        }
        return;
    }

    if args[0] == "ask" {
        if args.len() < 3 {
            eprintln!(
                "Missing arguments: intenttext-cli ask <dir> <question> [--format text|json]"
            );
            std::process::exit(2);
        }

        let target = Path::new(&args[1]);
        let format_idx = args.iter().position(|a| a == "--format");
        let format = format_idx
            .and_then(|idx| args.get(idx + 1).cloned())
            .unwrap_or_else(|| "text".to_string());
        let question_tokens = if let Some(idx) = format_idx {
            args[2..idx].to_vec()
        } else {
            args[2..].to_vec()
        };
        let question = question_tokens.join(" ");

        let files = collect_it_files(target);
        if files.is_empty() {
            println!("No .it files found.");
            return;
        }

        let mut composed: Vec<ComposedResult> = Vec::new();
        for file in files {
            let source = match fs::read_to_string(&file) {
                Ok(v) => v,
                Err(err) => {
                    eprintln!("Failed to read {}: {err}", file.display());
                    std::process::exit(1);
                }
            };
            let doc = parse(&source, None);
            let rel = file
                .strip_prefix(std::env::current_dir().unwrap_or_default())
                .unwrap_or(&file)
                .display()
                .to_string();
            let entry = build_index_entry(&doc, &source, &chrono::Utc::now().to_rfc3339());
            for block in entry.blocks {
                composed.push(ComposedResult {
                    file: rel.clone(),
                    block,
                });
            }
        }

        let answer = ask_documents(
            &composed,
            &question,
            Some(AskOptions {
                format: Some(format.clone()),
                ..Default::default()
            }),
        );

        if format == "json" {
            let payload = serde_json::json!({
                "question": question,
                "resultCount": composed.len(),
                "answer": answer,
                "preview": {
                    "table": format_table(&composed.iter().take(5).cloned().collect::<Vec<_>>()),
                    "json": serde_json::from_str::<serde_json::Value>(&format_json(&composed.iter().take(5).cloned().collect::<Vec<_>>())).unwrap_or(serde_json::json!([])),
                    "csv": format_csv(&composed.iter().take(5).cloned().collect::<Vec<_>>()),
                }
            });
            println!(
                "{}",
                serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
            );
        } else {
            println!("{}", answer);
        }
        return;
    }

    if args[0] == "seal" || args[0] == "verify" || args[0] == "history" {
        if args.len() < 2 {
            eprintln!("Missing file argument for {} command", args[0]);
            std::process::exit(2);
        }
        let input = &args[1];
        let source = match fs::read_to_string(input) {
            Ok(v) => v,
            Err(err) => {
                eprintln!("Failed to read {}: {err}", input);
                std::process::exit(1);
            }
        };

        if args[0] == "seal" {
            let signer = arg_value(&args, "--signer");
            let role = arg_value(&args, "--role");
            let skip_sign = args.iter().any(|a| a == "--no-sign");
            if signer.is_none() && !skip_sign {
                eprintln!("--signer is required for seal command (or use --no-sign)");
                std::process::exit(2);
            }

            let options = SealOptions {
                signer: signer.unwrap_or_default(),
                role,
                skip_sign,
            };
            let result = seal_document(&source, &options);
            if !result.success {
                eprintln!("Seal failed: {}", result.error.unwrap_or_default());
                std::process::exit(1);
            }
            if let Err(err) = fs::write(input, result.source) {
                eprintln!("Failed to write {}: {err}", input);
                std::process::exit(1);
            }
            println!("Document sealed");
            println!("Hash: {}", result.hash);
            println!("Frozen: {}", result.at);
            return;
        }

        if args[0] == "verify" {
            let result = verify_document(&source);
            if !result.frozen {
                println!(
                    "{}",
                    result
                        .warning
                        .unwrap_or_else(|| "Document is not sealed.".to_string())
                );
                return;
            }

            if result.intact {
                println!("Document intact");
                if let Some(at) = result.frozen_at {
                    println!("Sealed: {}", at);
                }
                if let Some(hash) = result.hash {
                    println!("Hash: {}", hash);
                }
                return;
            }

            println!("Document has been modified since sealing");
            if let Some(expected) = result.expected_hash {
                println!("Expected: {}", expected);
            }
            if let Some(current) = result.hash {
                println!("Current: {}", current);
            }
            std::process::exit(1);
        }

        // history command
        let as_json = args.iter().any(|a| a == "--json");
        let by_filter = arg_value(&args, "--by");
        let section_filter = arg_value(&args, "--section");
        let block_filter = arg_value(&args, "--block");

        let boundary = find_history_boundary_in_source(&source);
        if boundary < 0 {
            println!("No history found. Document may not be tracked.");
            return;
        }
        let raw = source.chars().skip(boundary as usize).collect::<String>();
        let parsed = parse_history_section(&raw);

        let revisions = parsed
            .revisions
            .into_iter()
            .filter(|r| by_filter.as_ref().map(|v| v == &r.by).unwrap_or(true))
            .filter(|r| {
                section_filter
                    .as_ref()
                    .map(|v| r.section.as_ref().map(|s| s == v).unwrap_or(false))
                    .unwrap_or(true)
            })
            .filter(|r| block_filter.as_ref().map(|v| v == &r.id).unwrap_or(true))
            .collect::<Vec<_>>();

        if as_json {
            let payload = serde_json::json!({
                "revisions": revisions,
                "registry": parsed.registry,
            });
            println!(
                "{}",
                serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
            );
            return;
        }

        for r in revisions {
            let date = if r.at.len() >= 10 { &r.at[..10] } else { &r.at };
            let section = r.section.unwrap_or_default();
            println!(
                "{} {} {} [{}] {} {}",
                r.version, date, r.by, r.change, r.block, section
            );
        }
        return;
    }

    if args[0] == "amend" {
        if args.len() < 2 {
            eprintln!("Missing file argument for amend command");
            std::process::exit(2);
        }
        let input = &args[1];
        let source = match fs::read_to_string(input) {
            Ok(v) => v,
            Err(err) => {
                eprintln!("Failed to read {}: {err}", input);
                std::process::exit(1);
            }
        };

        let section = arg_value(&args, "--section");
        let was = arg_value(&args, "--was");
        let now = arg_value(&args, "--now");
        let reference = arg_value(&args, "--ref");
        let by = arg_value(&args, "--by");

        if now.is_none() || reference.is_none() {
            eprintln!("amend requires --now and --ref");
            std::process::exit(2);
        }

        let document = parse(&source, None);
        let has_freeze = document.blocks.iter().any(|b| b.block_type == "freeze")
            || document
                .metadata
                .as_ref()
                .and_then(|m| m.freeze.as_ref())
                .is_some();
        if !has_freeze {
            eprintln!("Cannot amend: document is not frozen. Seal the document first.");
            std::process::exit(1);
        }

        let at = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let amend_line = format!(
            "amendment: Amendment{}{} | now: {} | ref: {}{} | at: {}",
            section
                .as_ref()
                .map(|s| format!(" | section: {s}"))
                .unwrap_or_default(),
            was.as_ref()
                .map(|w| format!(" | was: {w}"))
                .unwrap_or_default(),
            now.unwrap_or_default(),
            reference.unwrap_or_default(),
            by.map(|v| format!(" | by: {v}")).unwrap_or_default(),
            at
        );

        let history_pos = find_history_boundary_in_source(&source);
        let content_end = if history_pos < 0 {
            source.len()
        } else {
            history_pos as usize
        };
        let content_part = &source[..content_end];
        let lines = content_part.lines().collect::<Vec<_>>();
        let mut insert_after = None;
        for (idx, line) in lines.iter().enumerate().rev() {
            let t = line.trim();
            if t.starts_with("freeze:") || t.starts_with("sign:") || t.starts_with("amendment:") {
                insert_after = Some(idx);
                break;
            }
        }

        let Some(insert_idx) = insert_after else {
            eprintln!("Cannot find freeze/sign/amendment anchor in source");
            std::process::exit(1);
        };

        let mut out = String::new();
        for (idx, line) in lines.iter().enumerate() {
            out.push_str(line);
            out.push('\n');
            if idx == insert_idx {
                out.push_str(&amend_line);
                out.push('\n');
            }
        }
        if history_pos >= 0 {
            out.push_str(&source[history_pos as usize..]);
        }

        if let Err(err) = fs::write(input, out) {
            eprintln!("Failed to write {}: {err}", input);
            std::process::exit(1);
        }
        println!("Amendment added");
        return;
    }

    let input = &args[0];
    let input_path = Path::new(input);
    let output = args.iter().any(|a| a == "--output");
    let to_it = args.iter().any(|a| a == "--to-it");
    let html = args.iter().any(|a| a == "--html");

    let source = match fs::read_to_string(input_path) {
        Ok(v) => v,
        Err(err) => {
            eprintln!("Failed to read {}: {err}", input);
            std::process::exit(1);
        }
    };

    if to_it {
        let ext = input_path
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        let converted = if ext == "md" || ext == "markdown" {
            convert_markdown_to_intenttext(&source)
        } else if ext == "html" || ext == "htm" {
            convert_html_to_intenttext(&source)
        } else {
            eprintln!("--to-it supports .md/.markdown/.html/.htm inputs");
            std::process::exit(2);
        };

        if output {
            let out = with_extension(input_path, "it");
            if let Err(err) = fs::write(&out, converted) {
                eprintln!("Failed to write {}: {err}", out.display());
                std::process::exit(1);
            }
            println!("Wrote {}", out.display());
        } else {
            print!("{}", converted);
        }
        return;
    }

    let document = parse(&source, None);

    if html {
        let rendered = render(&document, None);
        if output {
            let out = with_extension(input_path, "html");
            if let Err(err) = fs::write(&out, rendered) {
                eprintln!("Failed to write {}: {err}", out.display());
                std::process::exit(1);
            }
            println!("Wrote {}", out.display());
        } else {
            print!("{}", rendered);
        }
        return;
    }

    if output {
        let out = with_extension(input_path, "it");
        let normalized = to_source(&document);
        if let Err(err) = fs::write(&out, normalized) {
            eprintln!("Failed to write {}: {err}", out.display());
            std::process::exit(1);
        }
        println!("Wrote {}", out.display());
        return;
    }

    match serde_json::to_string_pretty(&document) {
        Ok(json) => println!("{}", json),
        Err(err) => {
            eprintln!("Failed to serialize parsed document: {err}");
            std::process::exit(1);
        }
    }
}
