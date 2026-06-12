export interface DemoDoc {
  id: string;
  title: string;
  section: "invoices" | "contracts" | "projects" | "workflows" | "hr";
  source: string;
}

export const DEMO_DOCS: DemoDoc[] = [
  {
    id: "invoice-template",
    title: "Invoice Template — {{variables}} + each: loop",
    section: "invoices",
    // A merge TEMPLATE (what an ERP stores per company): {{path}} placeholders
    // and a repeating table row. Open the Template panel to test it with sample
    // data and produce a merged PDF — the same pipeline production uses.
    source: `page: | size: A4
header: {{company.name}}
footer: {{invoice.number}} · Page {{page}} of {{pages}}

title: Invoice {{invoice.number}}
summary: {{company.name}} → {{customer.name}}
meta: | date: {{invoice.date}} | status: {{invoice.status}}

section: From
contact: {{company.name}} | email: {{company.email}} | vat: {{company.vat}}

section: Bill To
contact: {{customer.name}} | email: {{customer.email}}

section: Line Items
| Description | Qty | Unit Price | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.unitPrice}} | {{item.total}} |

section: Totals
metric: Subtotal | value: {{totals.subtotal}}
metric: Tax ({{totals.taxRate}}%) | value: {{totals.tax}}
metric: Total Due | value: {{totals.due}}

section: Payment
text: Bank {{payment.bank}} · IBAN {{payment.iban}}
deadline: Payment due | date: {{invoice.dueDate}} | consequence: late fees may apply`,
  },
  {
    id: "invoice-demo",
    title: "Invoice — Dalil → Acme (signed)",
    section: "invoices",
    // Demo 1, as a finished document: the result of merging a data row into the
    // invoice template, then sealing it. Renders as a clean invoice (corporate
    // theme), the Trust panel shows the seal + signature, and it stays queryable
    // (deadline, metrics, contacts). See demo/business-doc for the live pipeline.
    source: `font: | family: Inter, Helvetica, sans-serif | size: 11pt | leading: 1.5
page: | size: A4 | footer: INV-2026-0042 · Page {{page}}

title: Invoice INV-2026-0042
summary: Dalil Technology LLC → Acme Corporation
meta: | type: invoice | status: Unpaid | client: Acme Corporation | theme: corporate

section: From
contact: Dalil Technology LLC | email: billing@dalil.ai | vat: VAT-300123456700003

section: Bill To
contact: Acme Corporation | email: ap@acme.com

section: Line Items
| Description | Qty | Unit Price | Total |
| Platform Development — March | 1 | 12,000 QAR | 12,000 QAR |
| UX Design Services | 8 hrs | 450 QAR | 3,600 QAR |
| Hosting & Infrastructure | 1 month | 900 QAR | 900 QAR |

section: Totals
metric: Subtotal | value: 16,500 QAR
metric: Tax (5%) | value: 825 QAR
metric: Total Due | value: 17,325 QAR

section: Payment
text: Bank Qatar National Bank · IBAN QA57QNBA000000000123456789001
deadline: Payment due | date: 2026-03-20 | consequence: 1.5% monthly interest

section: Authorization
sign: Dalil Billing | role: Finance | at: 2026-03-06T14:32:00Z | hash: sha256:3dc7b4a1ec39471778501a0c6457ff1aa2596117bad9b4e9a031195a3a15e74a
freeze: | at: 2026-03-06T14:32:00Z | hash: sha256:3dc7b4a1ec39471778501a0c6457ff1aa2596117bad9b4e9a031195a3a15e74a | status: locked`,
  },
  {
    id: "service-agreement",
    title: "Service Agreement — Atlas Corp",
    section: "contracts",
    source: `title: Service Agreement — Atlas Corp
summary: Professional services contract for Q2 2026 engagement
meta: | author: Ahmed Al-Rashid | tags: contract, legal, 2026 | theme: legal

section: Scope of Work
text: Provider shall deliver a cloud-based inventory management system including API integrations, data migration, and staff training.
metric: Project Value | value: 145000 | unit: USD

section: Deliverables
task: Phase 1 — Architecture & Design | owner: Ahmed Al-Rashid | due: 2026-04-14
task: Phase 2 — Core Development | owner: Ahmed Al-Rashid | due: 2026-06-30

section: Approval Chain
track: | id: SVC-2026-001 | by: Ahmed Al-Rashid | at: 2026-03-09
approve: Legal review complete | by: Sara Hassan | role: Legal Counsel | at: 2026-03-10
sign: | by: Ahmed Al-Rashid | role: CEO | at: 2026-03-10
freeze: | hash: a3f8c2d14e9b6071f5823a0c7d4e9b16f2a3c8d5e7f1b4a9c2d6e8f0b3c5a7d | at: 2026-03-10 | by: system
`,
  },
  {
    id: "project-atlas",
    title: "Project Atlas — Q2 2026",
    section: "projects",
    source: `title: Project Atlas — Q2 2026
summary: Cloud inventory management system for Atlas Corp
meta: | author: Ahmed Al-Rashid | tags: project, active, 2026

section: Team
task: Assign backend lead | owner: Ahmed Al-Rashid | due: 2026-03-20 | priority: high
task: Setup dev environment | owner: Tariq Mansour | due: 2026-03-25 | priority: medium
done: Sign service agreement | owner: Ahmed Al-Rashid | at: 2026-03-09

section: Risks
info: Client has legacy ERP system — migration complexity unknown until discovery phase | type: warning
ask: What is the data volume for historical records? | owner: Michael Chen | due: 2026-03-25
`,
  },
  {
    id: "nda-techcorp",
    title: "Non-Disclosure Agreement — TechCorp Industries",
    section: "contracts",
    source: `title: Non-Disclosure Agreement — TechCorp Industries
summary: Mutual NDA for partnership discussions
meta: | author: Ahmed Al-Rashid | tags: nda, legal, confidential

section: Purpose
text: Both parties will share confidential information during partnership discovery.

section: Obligations
task: Review NDA terms | owner: Sara Hassan | due: 2026-03-12
task: Counter-sign and return | owner: Michael Chen | due: 2026-03-20
ask: Include IP assignment clause? | owner: Sara Hassan | due: 2026-03-11

section: Approval
track: | id: NDA-2026-042 | by: Ahmed Al-Rashid | at: 2026-03-10
`,
  },
  {
    id: "workflow-client-onboarding",
    title: "Workflow — Client Onboarding",
    section: "workflows",
    source: `title: Workflow — Client Onboarding
summary: Structured onboarding execution flow for new enterprise client
meta: | type: workflow | author: Operations Team

section: Workflow
step: Collect intake data | id: step.intake | tool: crm.collect | output: intake
step: Validate contract | id: step.contract | tool: legal.validate | depends: step.intake
decision: Contract valid? | id: gate.contract | then: step.provision | else: step.revise
step: Provision workspace | id: step.provision | tool: infra.provision | depends: step.contract
gate: Human approval required | id: gate.human | approver: Operations Lead | depends: step.provision
step: Kickoff meeting | id: step.kickoff | tool: calendar.book | depends: gate.human
result: Client onboarding completed | id: step.done | depends: step.kickoff
`,
  },
  {
    id: "onboarding-checklist",
    title: "Employee Onboarding — Checklist",
    section: "hr",
    source: `title: Employee Onboarding — Standard Checklist
summary: Process checklist for new hire onboarding
meta: | author: HR Department | tags: hr, process, template

section: Before Start Date
task: Send welcome email | owner: HR | due: 2026-04-01
task: Prepare workstation | owner: IT | due: 2026-04-01
task: Create system accounts | owner: IT | due: 2026-04-01
`,
  },
];

export const DEFAULT_DEMO_DOC_ID = "invoice-demo";

export function getDemoDocById(id: string): DemoDoc | undefined {
  return DEMO_DOCS.find((d) => d.id === id);
}
