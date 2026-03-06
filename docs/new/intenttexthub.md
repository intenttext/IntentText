# IntentText — README Update + IntentText Hub

# Agent: Claude Opus

# Repo: github.com/intenttext/IntentText

# Two tasks. Do them in order.

---

# TASK 1 — README UPDATE

## What to Change

The README is already strong. Do NOT rewrite it. Make four targeted additions only.

---

### Addition 1 — New tagline (replace existing subtitle)

Current opening after the title:

> "The first document format that is natively JSON."
> Human-writable. Semantically typed. Machine-executable. Open source.

Replace with:

> "The document language for AI agents."
> Human readable. Machine deterministic. JSON native. Agent executable.

Keep the four navigation links below it unchanged.

---

### Addition 2 — Add a complete agent.it example to the "For Developers and AI Agents" section

After the existing workflow example block, add this subsection:

````markdown
### Defining an AI Agent in IntentText

An entire AI agent — its identity, tools, policies, and workflow — defined
in a single human-readable file:

\```
agent: customer-support | model: claude-sonnet-4 | id: cs-agent-01

context: | language: arabic | tone: professional | max_response: 300

// Tools this agent has access to
step: Load customer context | tool: crm.getCustomer | input: {{customerId}} | output: customer
step: Check order status | tool: orders.getStatus | input: {{orderId}} | output: order

// Policy-driven routing
decision: Route by intent | if: {{intent}} == "refund" | then: step-refund | else: step-support
decision: Check refund window| if: {{order.age_days}} < 30 | then: step-approve | else: step-deny

gate: Escalate to human | approver: support-manager | timeout: 2h | trigger: {{sentiment}} == "angry"

step: Send response | tool: whatsapp.send | input: {{response}} | output: sent
audit: Interaction logged | by: {{agent}} | at: {{timestamp}} | ref: {{customerId}}
result: Resolved | code: 200 | data: {{sent}}
\```

An agent reads this file via the MCP server, understands its own capabilities,
follows its own policy, and knows when to escalate — all from a plain text file
that a non-technical operations manager can also read and edit.
````

---

### Addition 3 — Add IntentText Hub section to The Ecosystem table

In the Ecosystem table, add one new row after the MCP Server row:

```markdown
| **IntentText Hub** | A registry where developers publish reusable `.it` templates — agent definitions, workflow patterns, document templates. Browse, install, and share. _(coming)_ |
```

---

### Addition 4 — Add GitHub topics to the repo

Not in the README itself, but instruct the agent to add these topics to the
GitHub repo (Settings → Topics):

```
intenttext document-format ai-agents mcp workflow semantic markdown-alternative
json typescript open-source
```

---

## What NOT to Change

- Do not touch the Problem/What IntentText Is/Why a New Format sections
- Do not touch the syntax reference tables
- Do not touch the comparison table
- Do not touch the design principles
- Do not touch the three-audience section structure
- Do not rewrite anything that is already working
- Do not add new keywords or change the keyword count claim

---

# TASK 2 — INTENTTEXT HUB

## What It Is

A web application where developers publish, discover, and install reusable
IntentText templates. Think npm for `.it` files — but simpler, lighter, and
focused on three categories: agent definitions, workflow patterns, and
document templates.

**Not a package registry.** No versioning system, no dependency graph,
no CLI install command (yet). Version 1 is purely a browseable, searchable
gallery with copy-to-clipboard and raw file download. Simple. Shippable in
one session.

## Repo

Create as a new React artifact (single `.jsx` file) first to validate the
design. Later it becomes `github.com/intenttext/intenttext-hub` deployed
on Vercel.

For now: build it as a complete, self-contained React component that Claude
can render as an artifact.

---

## PART 1 — DATA MODEL

Each template in the Hub has:

```typescript
interface HubTemplate {
  id: string; // slug: "customer-support-agent"
  name: string; // "Customer Support Agent"
  description: string; // one sentence
  category: "agent" | "workflow" | "document";
  tags: string[]; // ["customer-support", "arabic", "whatsapp"]
  author: string; // "intenttext" or GitHub username
  source: string; // the .it file content as a string
  createdAt: string; // ISO date
  downloads: number; // display only
}
```

---

## PART 2 — STARTER TEMPLATES

Seed the Hub with these 9 templates (3 per category). Write each one as a
complete, realistic `.it` file — not a demo, not a skeleton. Something a
developer could actually use.

### Category: agent

**1 — customer-support-agent**
Name: Customer Support Agent
Description: Multilingual customer support agent with CRM integration, refund policy, and escalation to human.
Tags: customer-support, whatsapp, crm, arabic, escalation

```
agent: customer-support | model: claude-sonnet-4 | id: cs-agent

context: | language: arabic | tone: professional | escalation_threshold: 3

step: Get customer     | tool: crm.lookup      | input: {{phone}}      | output: customer
step: Get order        | tool: orders.latest   | input: {{customer.id}} | output: order
decision: Route intent | if: {{intent}} == "refund" | then: step-refund | else: step-answer
decision: Refund check | if: {{order.age_days}} < 30 | then: step-approve | else: step-deny
step: Approve refund   | tool: orders.refund   | input: {{order.id}}   | output: refund | id: step-approve
step: Deny refund      | tool: whatsapp.send   | input: "Refund window expired" | id: step-deny
step: Answer query     | tool: llm.answer      | input: {{message}}    | output: response | id: step-answer
gate: Human escalation | approver: support-lead | timeout: 2h | trigger: {{turns}} > 3
step: Send reply       | tool: whatsapp.send   | input: {{response}}   | output: sent
audit: Logged          | by: cs-agent | ref: {{customer.id}} | at: {{timestamp}}
result: Resolved       | code: 200
```

**2 — onboarding-agent**
Name: User Onboarding Agent
Description: Automated user onboarding pipeline with email verification, workspace creation, and team notification.
Tags: onboarding, email, saas, automation

```
agent: onboarding | model: claude-sonnet-4 | id: onboard-agent

context: | plan: {{plan}} | userId: {{userId}}

step: Verify email     | tool: email.verify  | input: {{userId}}   | output: emailStatus
step: Create workspace | tool: ws.create     | input: {{userId}}   | output: workspace | depends: step-1
step: Assign plan      | tool: billing.set   | input: {{plan}}     | output: subscription | depends: step-2
gate: Confirm account  | approver: {{emailStatus.email}} | timeout: 48h
step: Send welcome     | tool: email.send    | input: {{workspace.url}} | depends: step-3
step: Notify team      | tool: slack.post    | input: "New user: {{userId}}" | depends: step-4
audit: Onboarded       | by: onboard-agent | ref: {{userId}} | at: {{timestamp}}
result: Onboarded      | code: 200 | data: {{workspace}}
```

**3 — content-moderator-agent**
Name: Content Moderation Agent
Description: Automated content moderation with policy checks, human review for edge cases, and audit trail.
Tags: moderation, content, safety, audit

```
agent: content-moderator | model: claude-sonnet-4 | id: mod-agent

context: | policy: community_guidelines | threshold: 0.85

step: Classify content  | tool: llm.classify  | input: {{content}}    | output: classification
step: Check policy      | tool: policy.check  | input: {{classification}} | output: verdict
decision: Auto-action   | if: {{verdict.confidence}} > 0.85 | then: step-action | else: step-review
step: Take action       | tool: content.remove | input: {{contentId}} | id: step-action
gate: Human review      | approver: trust-safety-team | timeout: 4h | id: step-review
step: Log decision      | tool: audit.log     | input: {{verdict}}    | output: logged
emit: moderation.complete | data: {{verdict}} | channel: trust-safety
audit: Reviewed         | by: mod-agent | ref: {{contentId}} | at: {{timestamp}}
result: Moderated       | code: 200 | data: {{verdict}}
```

### Category: workflow

**4 — deploy-pipeline**
Name: Deployment Pipeline
Description: CI/CD deployment workflow with smoke tests, staged rollout, rollback capability, and team notification.
Tags: deployment, ci-cd, docker, kubernetes, devops

```
title: Deployment Pipeline
summary: Staged deployment with testing, approval, and rollback.

trigger: webhook | event: release.published | branch: main

parallel: Pre-flight checks | steps: step-lint,step-test,step-scan | join: all
step: Lint code      | tool: ci.lint    | output: lintResult   | id: step-lint
step: Run tests      | tool: ci.test    | output: testResult   | id: step-test
step: Security scan  | tool: ci.scan    | output: scanResult   | id: step-scan

step: Build image    | tool: docker.build  | depends: step-lint,step-test,step-scan | output: image
step: Push to registry | tool: docker.push | input: {{image}}    | output: imageRef | depends: step-4

gate: Deploy to staging? | approver: lead-engineer | timeout: 2h
step: Deploy staging | tool: k8s.deploy | input: {{imageRef}} | output: staging | depends: step-5
step: Smoke test     | tool: ci.smoke   | input: {{staging.url}} | output: smokeResult | depends: step-7

decision: Staging OK | if: {{smokeResult.passed}} == true | then: step-prod | else: step-rollback
step: Rollback       | tool: k8s.rollback | input: {{staging}} | id: step-rollback
gate: Deploy to production? | approver: ops-lead | timeout: 4h | id: step-prod
step: Deploy production | tool: k8s.deploy | input: {{imageRef}} | output: production

step: Notify team    | tool: slack.post | input: "Deployed {{imageRef}} to production ✓"
audit: Deployed      | by: {{trigger.actor}} | ref: {{imageRef}} | at: {{timestamp}}
result: Deployed     | code: 200 | data: {{production}}
```

**5 — invoice-approval**
Name: Invoice Approval Workflow
Description: Invoice submission, manager approval, finance review, and payment processing pipeline.
Tags: finance, invoice, approval, business-process

```
title: Invoice Approval Workflow
summary: Route invoices through approval chain based on amount.

trigger: form | event: invoice.submitted

step: Validate invoice  | tool: finance.validate | input: {{invoice}}    | output: validation
decision: Amount check  | if: {{invoice.amount}} > 10000 | then: step-exec | else: step-manager
gate: Manager approval  | approver: {{submitter.manager}} | timeout: 48h | id: step-manager
gate: Executive approval| approver: cfo | timeout: 72h | id: step-exec
step: Process payment   | tool: finance.pay   | input: {{invoice.id}} | output: payment | depends: step-manager
step: Update accounting | tool: xero.record   | input: {{payment}}    | output: entry
step: Notify submitter  | tool: email.send    | input: "Invoice {{invoice.number}} approved and paid"
audit: Approved         | by: {{approver}} | ref: {{invoice.id}} | at: {{timestamp}}
result: Paid            | code: 200 | data: {{payment}}
```

**6 — lead-qualification**
Name: Lead Qualification Workflow
Description: Inbound lead scoring, qualification, CRM entry, and sales team routing.
Tags: sales, crm, lead-generation, automation

```
title: Lead Qualification Workflow
summary: Score and route inbound leads to the right sales rep.

trigger: webhook | event: lead.submitted

step: Enrich lead     | tool: clearbit.enrich | input: {{lead.email}} | output: enriched
step: Score lead      | tool: llm.score       | input: {{enriched}}   | output: score
decision: Qualify     | if: {{score.value}} > 70 | then: step-qualify | else: step-nurture
step: Add to CRM      | tool: crm.create      | input: {{enriched}}   | output: contact | id: step-qualify
step: Assign rep      | tool: crm.assign      | input: {{contact.id}} | output: assignment | depends: step-3
step: Notify rep      | tool: slack.dm        | input: "New lead: {{enriched.company}}" | depends: step-4
step: Add to nurture  | tool: mailchimp.add   | input: {{lead.email}} | id: step-nurture
audit: Qualified      | by: sales-agent | ref: {{lead.email}} | at: {{timestamp}}
result: Routed        | code: 200 | data: {{assignment}}
```

### Category: document

**7 — meeting-notes**
Name: Meeting Notes
Description: Structured meeting notes template with agenda, decisions, action items, and follow-up.
Tags: meetings, productivity, team, notes

```
title: {{meeting.title}}
byline: {{facilitator}} | date: {{date}} | publication: {{team}} Team

section: Attendees
note: {{attendees}}

section: Agenda
note: {{agenda}}

section: Discussion
note: {{discussion}}

section: Decisions
task: {{decision_1}} | owner: {{owner_1}} | status: decided
task: {{decision_2}} | owner: {{owner_2}} | status: decided

section: Action Items
task: {{action_1}} | owner: {{assignee_1}} | due: {{due_1}}
task: {{action_2}} | owner: {{assignee_2}} | due: {{due_2}}

section: Next Meeting
note: **Date:** {{next_meeting_date}}
note: **Agenda:** {{next_meeting_agenda}}
```

**8 — technical-spec**
Name: Technical Specification
Description: Engineering spec template with context, requirements, architecture, and open questions.
Tags: engineering, specification, documentation, technical

```
title: {{feature}} — Technical Specification
byline: {{author}} | date: {{date}}
summary: {{one_sentence_summary}}

section: Context
note: {{background_and_motivation}}
ask: {{key_open_question}}

section: Requirements
task: {{requirement_1}} | priority: 1 | status: must-have
task: {{requirement_2}} | priority: 2 | status: must-have
task: {{requirement_3}} | priority: 3 | status: nice-to-have

section: Architecture
note: {{architecture_description}}
image: System diagram | at: {{diagram_url}}

section: Implementation Plan
step: {{phase_1}} | owner: {{team_1}} | due: {{date_1}}
step: {{phase_2}} | owner: {{team_2}} | due: {{date_2}} | depends: step-1

section: Open Questions
ask: {{open_question_1}}
ask: {{open_question_2}}

section: Out of Scope
note: {{explicitly_excluded}}
```

**9 — weekly-report**
Name: Weekly Team Report
Description: Weekly status report with highlights, blockers, metrics, and next week plan.
Tags: reporting, team, status, weekly

```
title: Week {{week_number}} — {{team}} Update
byline: {{author}} | date: {{date}}
summary: {{one_line_summary}}

section: Highlights
done: {{win_1}} | time: {{day_1}}
done: {{win_2}} | time: {{day_2}}
done: {{win_3}} | time: {{day_3}}

section: In Progress
task: {{item_1}} | owner: {{owner_1}} | due: {{due_1}}
task: {{item_2}} | owner: {{owner_2}} | due: {{due_2}}

section: Blockers
warning: {{blocker_1}} | owner: {{blocker_owner_1}}

section: Metrics
| Metric          | This Week     | Last Week     | Trend |
| {{metric_1}}    | {{value_1}}   | {{prev_1}}    | {{trend_1}} |
| {{metric_2}}    | {{value_2}}   | {{prev_2}}    | {{trend_2}} |

section: Next Week
task: {{plan_1}} | owner: {{owner_1}}
task: {{plan_2}} | owner: {{owner_2}}
```

---

## PART 3 — UI DESIGN

Build as a React component. Stack: React + Tailwind (core classes only).

### Layout

```
┌─────────────────────────────────────────────────────┐
│  IntentText Hub                    [Search........] │
│  The registry for .it templates                     │
│  [All] [Agents] [Workflows] [Documents]             │
└─────────────────────────────────────────────────────┘
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ AGENT    │  │ WORKFLOW │  │ DOCUMENT │         │
│  │          │  │          │  │          │         │
│  │ Customer │  │ Deploy   │  │ Meeting  │         │
│  │ Support  │  │ Pipeline │  │ Notes    │         │
│  │ Agent    │  │          │  │          │         │
│  │          │  │          │  │          │         │
│  │ [View]   │  │ [View]   │  │ [View]   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Card design

Each card shows:

- Category badge (colored): AGENT (purple), WORKFLOW (blue), DOCUMENT (green)
- Template name (bold)
- Description (one line, truncated)
- Tags (2-3 visible, overflow hidden)
- "View template" button

### Template detail panel

Click a card → slide-in panel from the right (or modal) showing:

- Full name and description
- Category badge and all tags
- The complete `.it` source in a monospace code block with syntax-like coloring:
  - Keywords (`step:`, `gate:`, `agent:`) highlighted in purple
  - Property keys highlighted in blue
  - Comments (`//`) in grey/italic
  - Template variables (`{{var}}`) in orange
- Two action buttons:
  - **Copy** — copies the raw `.it` source to clipboard
  - **Download** — downloads as `template-name.it`
- A "Use in Editor" link: opens the editor at `iteditor.vercel.app` (future: with template pre-loaded)

### Color system

```
background:     #1e1e2e   (dark canvas)
surface:        #313244   (card background)
border:         #45475a   (card border)
text-primary:   #cdd6f4   (main text)
text-muted:     #6c7086   (secondary text)
purple:         #cba6f7   (agent badge, keyword highlight, primary accent)
blue:           #89b4fa   (workflow badge, property highlight)
green:          #a6e3a1   (document badge)
orange:         #fab387   (template variable highlight)
grey:           #6c7086   (comment highlight)
```

### Search

Client-side only. Filter by name, description, and tags simultaneously.
No server. No API. Works on the static template data.

### Category filter

Tabs: All | Agents | Workflows | Documents
Active tab has purple underline. Click filters the grid.

---

## PART 4 — COMPONENT STRUCTURE

```
IntentTextHub (root)
  HubHeader (title, search, category tabs)
  TemplateGrid (responsive 3-col grid)
    TemplateCard × N
  TemplateDetailPanel (conditional, shown on card click)
    TemplateSource (syntax-highlighted .it display)
    CopyButton
    DownloadButton
```

All in one `.jsx` file. No separate CSS file. Tailwind inline classes only.

---

## PART 5 — SYNTAX HIGHLIGHTING

For the template source display, implement lightweight keyword coloring without
any external library. Use a simple regex-based approach:

```javascript
function highlightItSource(source) {
  return source
    .split("\n")
    .map((line) => {
      // Comments
      if (line.trim().startsWith("//")) {
        return `<span class="it-comment">${escapeHtml(line)}</span>`;
      }
      // Highlight keyword at start of line
      let highlighted = line.replace(
        /^(\s*)([\w-]+)(:)/,
        (_, space, keyword, colon) =>
          `${space}<span class="it-keyword">${keyword}</span>${colon}`,
      );
      // Highlight pipe property keys
      highlighted = highlighted.replace(
        /\|\s*([\w-]+):/g,
        (_, key) => `| <span class="it-prop">${key}</span>:`,
      );
      // Highlight template variables
      highlighted = highlighted.replace(
        /\{\{([^}]+)\}\}/g,
        (_, v) => `<span class="it-var">{{${v}}}</span>`,
      );
      return highlighted;
    })
    .join("\n");
}
```

CSS classes (inline styles if needed):

```css
.it-keyword {
  color: #cba6f7;
  font-weight: 600;
}
.it-prop {
  color: #89b4fa;
}
.it-var {
  color: #fab387;
}
.it-comment {
  color: #6c7086;
  font-style: italic;
}
```

---

## PART 6 — FUTURE (document only, do not build now)

When the Hub becomes a real hosted service, it will add:

- GitHub OAuth — publish your own templates
- `npm`-style install: `intenttext install username/template-name`
- Star/download counts
- Search by use case, industry, integration
- Template composition — combine multiple templates

Document these as a "Coming soon" note at the bottom of the Hub page.

---

## DELIVERABLES

1. Updated `README.md` for `github.com/intenttext/IntentText` — four targeted
   additions only, nothing else changed
2. A complete React `.jsx` artifact of the IntentText Hub — self-contained,
   all 9 templates included, fully functional with search, filter, copy,
   download, and syntax highlighting

---

## CONSTRAINTS

- README changes: surgical only. Touch four things, leave everything else.
- Hub: no external dependencies beyond React and Tailwind core classes
- Hub: all 9 templates must be complete, realistic `.it` files — not skeletons
- Hub: syntax highlighting must work without a library
- Hub: copy and download must work without a server
- Dark theme only — matches the IntentText editor and VS Code extension palette

_IntentText README Update + IntentText Hub — Prompt for Claude Opus — March 2026_
