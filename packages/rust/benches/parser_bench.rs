use criterion::{criterion_group, criterion_main, Criterion};
use intenttext::parser::parse;

fn bench_parse_simple(c: &mut Criterion) {
    let source = "title: Hello World\nsection: Overview\ntext: This is a description of the project.\ntask: Buy milk\ntask: Write tests\ndone: Setup CI";
    c.bench_function("parse_simple", |b| b.iter(|| parse(source, None)));
}

fn bench_parse_with_inline(c: &mut Criterion) {
    let source = "title: **Hello** World\ntext: A _complex_ document with `inline code` and ==highlights==.\ninfo: This is a note with @mention and #tag";
    c.bench_function("parse_with_inline", |b| b.iter(|| parse(source, None)));
}

criterion_group!(benches, bench_parse_simple, bench_parse_with_inline);
criterion_main!(benches);
