from intenttext import parse, parse_and_merge, query, render_html, to_source, validate

source = """
title: Sprint Planning
section: Tasks
task: Write tests | owner: Ahmed | due: Friday
task: Deploy to staging | owner: Sarah | due: Monday
gate: Final approval | approver: Lead | timeout: 24h
""".strip()

doc = parse(source)

tasks = query(doc, type="task")
for task in tasks:
    print(f"{task.content} -> {task.properties.get('owner', 'unassigned')}")

validation = validate(doc)
print("Valid:", validation.valid)

html = render_html(doc)
print("Rendered HTML length:", len(html))

merged = parse_and_merge(
    "title: Invoice {{invoice.number}}\nnote: Bill To {{client.name}}",
    {"invoice": {"number": "2026-042"}, "client": {"name": "Acme Corp"}},
)
print(to_source(merged))
