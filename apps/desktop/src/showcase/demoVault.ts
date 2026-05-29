export interface DemoDoc {
  id: string;
  title: string;
  section: "contracts" | "projects" | "workflows" | "hr";
  source: string;
}

export const DEMO_DOCS: DemoDoc[] = [
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
task: Phase 1 — Architecture & Design | owner: Ahmed Al-Rashid | due: 14/04/2026
task: Phase 2 — Core Development | owner: Ahmed Al-Rashid | due: 30/06/2026

section: Approval Chain
track: | id: SVC-2026-001 | by: Ahmed Al-Rashid | at: 09/03/2026
approve: Legal review complete | by: Sara Hassan | role: Legal Counsel | at: 10/03/2026
sign: | by: Ahmed Al-Rashid | role: CEO | at: 10/03/2026
freeze: | hash: a3f8c2d14e9b6071f5823a0c7d4e9b16f2a3c8d5e7f1b4a9c2d6e8f0b3c5a7d | at: 10/03/2026 | by: system
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
task: Assign backend lead | owner: Ahmed Al-Rashid | due: 20/03/2026 | priority: high
task: Setup dev environment | owner: Tariq Mansour | due: 25/03/2026 | priority: medium
done: Sign service agreement | owner: Ahmed Al-Rashid | at: 09/03/2026

section: Risks
info: Client has legacy ERP system — migration complexity unknown until discovery phase | type: warning
ask: What is the data volume for historical records? | owner: Michael Chen | due: 25/03/2026
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
task: Review NDA terms | owner: Sara Hassan | due: 12/03/2026
task: Counter-sign and return | owner: Michael Chen | due: 20/03/2026
ask: Include IP assignment clause? | owner: Sara Hassan | due: 11/03/2026

section: Approval
track: | id: NDA-2026-042 | by: Ahmed Al-Rashid | at: 10/03/2026
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
task: Send welcome email | owner: HR | due: 01/04/2026
task: Prepare workstation | owner: IT | due: 01/04/2026
task: Create system accounts | owner: IT | due: 01/04/2026
`,
  },
];

export const DEFAULT_DEMO_DOC_ID = "service-agreement";

export function getDemoDocById(id: string): DemoDoc | undefined {
  return DEMO_DOCS.find((d) => d.id === id);
}
