import { config } from "dotenv";
import { MongoClient } from "mongodb";
import {
  parseIntentText,
  generateThemeCSS,
  listBuiltinThemes,
  getBuiltinTheme,
} from "@intenttext/core";
import * as fs from "fs";
import * as path from "path";

config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set. Add it to .env.local");
  process.exit(1);
}
const DB_NAME = "intenttext-hub";

interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  category: "agent" | "workflow" | "document";
  tags: string[];
  source: string;
}

const templates: SeedTemplate[] = [
  // ── AGENTS ──
  {
    slug: "customer-support-agent",
    name: "Customer Support Agent",
    description:
      "Multilingual customer support with CRM lookup, refund policies, and escalation paths.",
    category: "agent",
    tags: ["crm", "support", "multilingual", "whatsapp"],
    source: `title: Customer Support Agent
| status: active
---
goal: Handle customer inquiries across channels with empathy and accuracy
  Resolve issues on first contact when possible. Escalate complex cases
  to the appropriate team with full context.
---
step: Greet and identify customer
| tool: crm.lookupCustomer
  Welcome the customer warmly. Ask for their order number or email.
  Look up their account in the CRM. Confirm their identity.
---
step: Classify the inquiry
  Determine the type of request:
  *Billing* — payment issues, refund requests, invoice questions
  *Technical* — product bugs, setup help, feature questions
  *General* — shipping status, account changes, feedback
---
step: Handle billing inquiries
| tool: billing.getInvoices
  Pull up the customer's billing history. For refund requests,
  check eligibility against the refund policy.
---
policy: Refund eligibility
  Refunds are approved within 30 days of purchase for unused items.
  Digital products are non-refundable after download.
  Exceptions require manager approval via the escalation path.
---
step: Handle technical issues
| tool: jira.createTicket
  Attempt to resolve with known solutions first. If the issue persists,
  create a support ticket with reproduction steps and customer context.
---
gate: Escalation check
| condition: issue not resolved within 10 minutes
  If the issue cannot be resolved, escalate to a senior agent
  with full conversation history and attempted solutions.
---
step: Close the conversation
  Summarize what was done. Ask if there is anything else.
  Send a satisfaction survey link via {{channel}}.
`,
  },
  {
    slug: "onboarding-agent",
    name: "Onboarding Agent",
    description:
      "User onboarding flow with email verification, workspace creation, and guided setup.",
    category: "agent",
    tags: ["onboarding", "saas", "email", "setup"],
    source: `title: Onboarding Agent
| status: active
---
goal: Guide new users from signup to productive workspace
  Ensure every new user completes email verification, creates
  their first workspace, and understands key features.
---
step: Send verification email
| tool: email.sendVerification
  Generate a one-time verification code. Send it to {{user_email}}.
  The code expires in 15 minutes.
---
gate: Email verified
| condition: verification code confirmed
  Wait for the user to enter the verification code.
  Allow up to 3 retry attempts before locking the account.
---
step: Create workspace
| tool: workspace.create
  Create a default workspace named "{{user_name}}'s Workspace".
  Initialize with sample data and a welcome project.
---
step: Configure preferences
  Ask the user about their role and primary use case.
  Set default views and notification preferences accordingly.
  *Developer* — show API docs and integrations first
  *Manager* — show dashboards and reports first
  *Designer* — show templates and collaboration tools first
---
step: Guided tour
| tool: app.startTour
  Walk the user through the three core features:
  1. Creating a project
  2. Inviting team members
  3. Setting up their first automation
---
step: Completion
| emit: onboarding_complete
  Mark the user as onboarded. Send a welcome email with
  quick-start resources and a link to the community forum.
`,
  },
  {
    slug: "content-moderator-agent",
    name: "Content Moderator Agent",
    description:
      "Content moderation with policy checks, confidence scoring, and audit trail.",
    category: "agent",
    tags: ["moderation", "ai", "safety", "audit"],
    source: `title: Content Moderator Agent
| status: active
---
goal: Review user-generated content for policy compliance
  Automatically flag or remove content that violates community guidelines.
  Maintain a complete audit trail of all moderation decisions.
---
step: Receive content for review
  Accept content submissions from the queue. Each item includes
  the content body, author ID, submission timestamp, and content type.
---
step: Run automated checks
| tool: ai.classifyContent
  Score the content across multiple dimensions:
  *Spam* — promotional, repetitive, or bot-generated content
  *Harassment* — targeted abuse, threats, or bullying
  *Misinformation* — verifiably false claims on sensitive topics
  *Adult content* — explicit material outside designated areas
---
policy: Moderation thresholds
  Content scoring above 0.9 on any policy violation is auto-removed.
  Content scoring between 0.7 and 0.9 is queued for human review.
  Content scoring below 0.7 is approved automatically.
  All auto-decisions are logged with confidence scores.
---
gate: Human review required
| condition: confidence score between 0.7 and 0.9
  Route the content to a human moderator with the AI assessment,
  similar past decisions, and relevant policy excerpts.
---
step: Record decision
| tool: audit.logDecision
  Log the moderation decision with: content ID, decision (approve/reject),
  reviewer (auto or human), confidence score, policy cited, and timestamp.
---
step: Notify author
| tool: notification.send
  If content is rejected, notify the author with the specific policy
  violation and an appeal process link. Be factual, not accusatory.
`,
  },

  // ── WORKFLOWS ──
  {
    slug: "deploy-pipeline",
    name: "Deploy Pipeline",
    description:
      "CI/CD deployment with smoke tests, staged rollout, and automatic rollback.",
    category: "workflow",
    tags: ["cicd", "devops", "deployment", "rollback"],
    source: `title: Deploy Pipeline
| status: active
---
goal: Ship code to production safely with zero-downtime deploys
  Every deployment goes through build, test, staged rollout,
  and automated rollback on failure.
---
step: Build and test
| tool: ci.runBuild
  Pull the latest commit from {{branch}}. Run the full build.
  Execute unit tests and integration tests. Fail fast on any error.
---
gate: Tests pass
| condition: all tests green and build successful
  Only proceed if the build is clean. On failure, notify the
  team in {{slack_channel}} with the failure summary.
---
step: Deploy to staging
| tool: infra.deployToStaging
  Deploy the build artifact to the staging environment.
  Run smoke tests against staging endpoints.
---
step: Run smoke tests
| tool: test.runSmoke
  Hit all critical API endpoints. Verify response codes,
  response times under 500ms, and data integrity checks.
---
gate: Smoke tests pass
| condition: all smoke tests green
  Block production deploy until staging is verified.
  Auto-rollback staging if smoke tests fail.
---
step: Staged rollout to production
| tool: infra.canaryDeploy
  Deploy to 10% of production traffic first. Monitor error rates
  and latency for 5 minutes. If metrics are healthy, proceed
  to 50%, then 100%.
---
gate: Canary health check
| condition: error rate below 0.1% and p99 latency under 800ms
  If the canary fails health checks, automatically roll back
  to the previous version and alert the on-call engineer.
---
step: Post-deploy verification
| emit: deploy_complete
  Run the full smoke test suite against production.
  Update the deployment log with commit hash, timestamp,
  and rollout duration. Notify the team of success.
`,
  },
  {
    slug: "invoice-approval",
    name: "Invoice Approval",
    description:
      "Invoice routing through approval chains with budget checks and auto-escalation.",
    category: "workflow",
    tags: ["finance", "approval", "invoices", "budget"],
    source: `title: Invoice Approval Workflow
| status: active
---
goal: Route invoices through the correct approval chain
  Ensure every invoice is properly validated, approved within SLA,
  and recorded for accounting.
---
step: Receive invoice
| tool: accounting.parseInvoice
  Parse the incoming invoice. Extract vendor name, amount,
  currency, line items, and due date. Validate format.
---
step: Match to purchase order
| tool: accounting.matchPO
  Look up the related purchase order. Verify that the invoice
  amount matches the PO amount within a 5% tolerance.
---
gate: Amount within budget
| condition: invoice amount under department quarterly budget
  Check the department's remaining quarterly budget.
  If the invoice would exceed the budget, flag for CFO review.
---
step: Route to approver
  Route based on invoice amount:
  *Under $1,000* — auto-approve and record
  *$1,000 to $10,000* — department manager approval
  *$10,000 to $50,000* — VP approval required
  *Over $50,000* — CFO approval required
---
gate: Approval received
| condition: approver signs off within 48 hours
  If no approval within 48 hours, send a reminder.
  After 72 hours, escalate to the next level approver.
---
step: Process payment
| tool: accounting.schedulePayment
| emit: invoice_approved
  Schedule the payment for the due date. Record the approval
  chain, timestamps, and any notes. Update the budget tracker.
`,
  },
  {
    slug: "lead-qualification",
    name: "Lead Qualification",
    description:
      "Lead scoring pipeline with CRM enrichment, scoring model, and sales routing.",
    category: "workflow",
    tags: ["sales", "crm", "leads", "scoring"],
    source: `title: Lead Qualification Pipeline
| status: active
---
goal: Score and route inbound leads to the right sales team
  Every lead gets enriched, scored, and assigned within 5 minutes.
  High-value leads get immediate attention.
---
step: Capture lead data
| tool: forms.getSubmission
  Receive lead data from the signup form: name, email, company,
  role, company size, and stated use case.
---
step: Enrich lead profile
| tool: clearbit.enrichCompany
  Look up the company. Enrich with industry, revenue range,
  employee count, tech stack, and funding status.
---
step: Score the lead
  Apply the scoring model:
  *Company size* — Enterprise (50pts), Mid-market (30pts), SMB (10pts)
  *Role* — C-level (40pts), VP (30pts), Manager (20pts), IC (10pts)
  *Industry fit* — Target vertical (20pts), Adjacent (10pts), Other (5pts)
  *Engagement* — Demo request (30pts), Pricing page (20pts), Blog (5pts)
---
gate: Qualified lead
| condition: lead score above 60
  Leads scoring below 60 enter the nurture sequence.
  Leads scoring 60+ proceed to sales assignment.
---
step: Assign to sales rep
| tool: crm.assignLead
  Route based on score and segment:
  *Score 90+* — Senior AE, immediate outreach
  *Score 60-89* — Standard AE, contact within 24 hours
  Create the deal in CRM with enriched data and score breakdown.
---
step: Notify sales team
| tool: slack.sendMessage
| emit: lead_qualified
  Post the lead summary in {{sales_channel}} with company context,
  score breakdown, and recommended next steps.
`,
  },

  // ── DOCUMENTS ──
  {
    slug: "meeting-notes",
    name: "Meeting Notes",
    description:
      "Structured meeting notes with attendees, agenda, decisions, and action items.",
    category: "document",
    tags: ["meetings", "notes", "decisions", "actions"],
    source: `title: Weekly Product Sync — March 15, 2026
---
text: Meeting Details
  *Date:* March 15, 2026 — 10:00 AM UTC
  *Duration:* 45 minutes
  *Attendees:* Sarah Chen, Marcus Johnson, Priya Patel, Alex Kim
  *Facilitator:* Sarah Chen
---
text: Agenda
  1. Sprint review — what shipped last week
  2. Customer feedback triage
  3. Q2 roadmap priorities
  4. Open discussion
---
section: Sprint Review
---
text: Shipped last week
  Completed 12 of 14 planned stories. Two items carried over:
  *Search redesign* — needs accessibility review, targeting Wednesday
  *API rate limiting* — blocked on infrastructure decision
---
section: Customer Feedback
---
text: Top feedback themes
  Analyzed 47 support tickets and 12 NPS responses:
  *Export functionality* — 15 requests for CSV export from dashboards
  *Mobile experience* — 8 reports of layout issues on tablets
  *Onboarding* — 6 users confused by initial workspace setup
---
section: Decisions
---
text: Decision — CSV export priority
  *Decision:* Move CSV export to Sprint 24 as a P1 item.
  *Rationale:* High customer demand, estimated 3 story points.
  *Owner:* Marcus Johnson
---
text: Decision — Mobile fix sprint
  *Decision:* Dedicate 20% of Sprint 24 to tablet layout fixes.
  *Rationale:* Growing mobile usage (23% of traffic).
  *Owner:* Priya Patel
---
section: Action Items
---
step: Schedule accessibility review for search redesign
| owner: Alex Kim
| due: March 17, 2026
  Coordinate with the accessibility team. Book a 30-minute review session.
---
step: Draft CSV export spec
| owner: Marcus Johnson
| due: March 18, 2026
  Write a one-page spec covering file format, column selection, and size limits.
---
step: Audit tablet layout issues
| owner: Priya Patel
| due: March 19, 2026
  Reproduce all 8 reported issues. Categorize by severity and estimate fixes.
`,
  },
  {
    slug: "technical-spec",
    name: "Technical Spec",
    description:
      "Engineering specification with requirements, architecture, implementation plan, and risks.",
    category: "document",
    tags: ["engineering", "spec", "architecture", "planning"],
    source: `title: Technical Spec — Real-Time Notifications
| version: 1.0
---
text: Overview
  Add real-time push notifications to the web and mobile apps.
  Users receive instant updates for mentions, assignment changes,
  and status updates without polling.
---
section: Requirements
---
text: Functional requirements
  *FR-1:* Deliver notifications within 2 seconds of the triggering event
  *FR-2:* Support web push, mobile push (iOS + Android), and in-app
  *FR-3:* Users can configure notification preferences per event type
  *FR-4:* Batch low-priority notifications into a 5-minute digest
  *FR-5:* Mark as read/unread, with bulk actions
---
text: Non-functional requirements
  *NFR-1:* Handle 10,000 concurrent WebSocket connections per node
  *NFR-2:* 99.9% delivery rate for critical notifications
  *NFR-3:* Maximum 50ms added latency to the triggering action
  *NFR-4:* Graceful degradation — fall back to polling if WebSocket fails
---
section: Architecture
---
text: System design
  *Event bus:* Redis Streams for event ingestion and fan-out
  *WebSocket server:* Dedicated Node.js service with Socket.IO
  *Push service:* Firebase Cloud Messaging for mobile, Web Push API for browsers
  *Storage:* PostgreSQL for notification records, Redis for online presence
  *Queue:* Bull queue for batch digest processing
---
text: Data flow
  1. Service emits event to Redis Stream
  2. Notification worker consumes event, resolves recipients
  3. For each recipient: check preferences, format message
  4. Online users: push via WebSocket
  5. Offline users: queue push notification
  6. Low-priority: batch into digest queue
---
section: Implementation Plan
---
step: Phase 1 — WebSocket infrastructure
| owner: Backend team
| estimate: 2 weeks
  Set up Socket.IO server. Implement connection management,
  authentication, and reconnection logic. Load test to 10K connections.
---
step: Phase 2 — Event pipeline
| owner: Backend team
| estimate: 1 week
  Configure Redis Streams. Build the notification worker service.
  Implement preference checking and message formatting.
---
step: Phase 3 — Client integration
| owner: Frontend team
| estimate: 2 weeks
  Add notification bell UI. Implement WebSocket client with
  automatic reconnection. Build notification preferences panel.
---
step: Phase 4 — Mobile push
| owner: Mobile team
| estimate: 1 week
  Integrate FCM for Android and iOS. Handle token registration
  and refresh. Test across OS versions.
---
section: Risks
---
text: Risk assessment
  *High:* WebSocket scaling under peak load — mitigate with horizontal scaling and connection limits
  *Medium:* Push notification delivery on iOS — mitigate with APNs best practices and retry logic
  *Low:* Redis single point of failure — mitigate with Redis Sentinel failover
`,
  },
  {
    slug: "weekly-report",
    name: "Weekly Report",
    description:
      "Weekly team status report with metrics dashboard, highlights, and blockers.",
    category: "document",
    tags: ["reporting", "status", "metrics", "weekly"],
    source: `title: Engineering Weekly Report — Week 11, 2026
---
text: Summary
  Strong week with 94% sprint velocity. Shipped the dashboard redesign
  ahead of schedule. Two P1 bugs resolved within SLA. Hiring pipeline
  healthy with 3 candidates in final rounds.
---
section: Key Metrics
---
text: Sprint velocity
  *Planned:* 34 story points
  *Completed:* 32 story points
  *Velocity:* 94%
  *Carry-over:* 2 points (API rate limiting — blocked on infra)
---
text: Quality metrics
  *P1 bugs opened:* 2
  *P1 bugs closed:* 2
  *Mean time to resolve (P1):* 4.2 hours
  *Test coverage:* 87.3% (+0.4% from last week)
  *Build success rate:* 98.7%
---
text: System health
  *Uptime:* 99.98%
  *P99 latency:* 342ms (target: under 500ms)
  *Error rate:* 0.03%
  *Active users:* 12,847 (+6% week over week)
---
section: Highlights
---
text: Dashboard redesign shipped
  Launched the new analytics dashboard to 100% of users on Tuesday.
  Initial feedback positive — 4.2/5 in-app rating from 230 responses.
  Page load time improved by 40% with the new data fetching approach.
---
text: Search performance optimization
  Reduced search query time from 820ms to 210ms by adding
  composite indexes and query plan optimization. Deployed Thursday.
---
section: Blockers and Risks
---
text: API rate limiting — blocked
  Waiting on infrastructure team's decision on rate limiting strategy.
  Options: API gateway (Kong) vs application-level (custom middleware).
  *Impact:* Delays the partner API launch by 1 week if not resolved by Friday.
  *Action:* Escalated to VP Engineering. Decision meeting scheduled Thursday.
---
text: Database migration risk
  The user table migration for multi-tenancy is estimated at 4 hours
  of downtime. Exploring zero-downtime migration with shadow tables.
  *Action:* Proof of concept by next Wednesday.
---
section: Next Week Plan
---
step: Complete API rate limiting
| owner: Platform team
  Implement the chosen rate limiting strategy. Target: ready for QA by Wednesday.
---
step: Start notification system
| owner: Backend team
  Begin Phase 1 of the real-time notifications project.
  Set up WebSocket infrastructure and connection management.
---
step: Mobile layout fixes
| owner: Frontend team
  Address the 8 tablet layout issues from customer feedback.
  Target: fix all high-severity items by Friday.
`,
  },
];

/**
 * Load templates from the templates/ directory.
 * Each .it file is a template; each .data.json is example data.
 * Metadata (slug, name, description, domain) is extracted from the parsed document.
 */
function loadFileTemplates(): Array<{
  slug: string;
  name: string;
  description: string;
  category: string;
  domain: string;
  tags: string[];
  source: string;
  example_data?: Record<string, unknown>;
  recommended_theme?: string;
}> {
  const templatesDir = path.resolve(__dirname, "..", "seeds", "templates");
  if (!fs.existsSync(templatesDir)) return [];

  const result: ReturnType<typeof loadFileTemplates> = [];
  const domains = fs
    .readdirSync(templatesDir)
    .filter((d) => fs.statSync(path.join(templatesDir, d)).isDirectory());

  for (const domain of domains) {
    const domainDir = path.join(templatesDir, domain);
    const itFiles = fs.readdirSync(domainDir).filter((f) => f.endsWith(".it"));

    for (const itFile of itFiles) {
      const slug = itFile.replace(/\.it$/, "");
      const source = fs.readFileSync(path.join(domainDir, itFile), "utf-8");
      const doc = parseIntentText(source);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = doc.metadata as Record<string, unknown> | undefined;

      const meta = (md?.meta as Record<string, string>) || {};
      const title = (md?.title as string) || slug.replace(/-/g, " ");

      let exampleData: Record<string, unknown> | undefined;
      const dataFile = path.join(domainDir, `${slug}.data.json`);
      if (fs.existsSync(dataFile)) {
        exampleData = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      }

      result.push({
        slug,
        name: title,
        description: String(meta.description || ""),
        category: mapDomainToCategory(domain),
        domain,
        tags: [domain, String(meta.type || "template")],
        source,
        example_data: exampleData,
        recommended_theme: meta.theme ? String(meta.theme) : undefined,
      });
    }
  }

  return result;
}

/** Map v2.10 domains to legacy Hub categories for backward compat. */
function mapDomainToCategory(domain: string): string {
  switch (domain) {
    case "agent":
      return "agent";
    case "developer":
      return "workflow";
    default:
      return "document";
  }
}

async function seed() {
  console.log("Connecting to MongoDB…");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection("templates");

  // Create indexes
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ category: 1, status: 1 });
  await collection.createIndex({ tags: 1 });
  await collection.createIndex({ status: 1, createdAt: -1 });
  await collection.createIndex(
    { name: "text", description: "text", tags: "text" },
    { name: "search_index" },
  );
  console.log("Indexes created.");

  // Seed inline templates (legacy)
  let inlineInserted = 0;
  let inlineUpdated = 0;
  for (const tmpl of templates) {
    const document = parseIntentText(tmpl.source);
    const existing = await collection.findOne({ slug: tmpl.slug });

    if (existing) {
      await collection.updateOne(
        { slug: tmpl.slug },
        {
          $set: {
            source: tmpl.source,
            document,
            updatedAt: new Date(),
          },
        },
      );
      inlineUpdated++;
      console.log(`  ~  ${tmpl.slug} — updated.`);
      continue;
    }

    await collection.insertOne({
      ...tmpl,
      document,
      author: "intenttext",
      status: "approved",
      autoApproved: true,
      downloads: 0,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inlineInserted++;
    console.log(`  ✓  ${tmpl.slug} — inserted.`);
  }

  // Seed file-based templates (v2.10 — from templates/ directory)
  const fileTemplates = loadFileTemplates();
  let fileInserted = 0;
  let fileUpdated = 0;
  for (const tmpl of fileTemplates) {
    const document = parseIntentText(tmpl.source);
    const existing = await collection.findOne({ slug: tmpl.slug });

    if (existing) {
      await collection.updateOne(
        { slug: tmpl.slug },
        {
          $set: {
            name: tmpl.name,
            description: tmpl.description,
            category: tmpl.category,
            domain: tmpl.domain,
            tags: tmpl.tags,
            source: tmpl.source,
            example_data: tmpl.example_data,
            recommended_theme: tmpl.recommended_theme,
            document,
            updatedAt: new Date(),
          },
        },
      );
      fileUpdated++;
      console.log(`  ~  ${tmpl.slug} — updated (file).`);
      continue;
    }

    await collection.insertOne({
      slug: tmpl.slug,
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      domain: tmpl.domain,
      tags: tmpl.tags,
      source: tmpl.source,
      example_data: tmpl.example_data,
      recommended_theme: tmpl.recommended_theme,
      document,
      author: "intenttext",
      status: "approved",
      tier: "curated",
      autoApproved: true,
      downloads: 0,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fileInserted++;
    console.log(`  ✓  ${tmpl.slug} — inserted (file).`);
  }

  console.log(
    `\nDone. Inline: ${inlineInserted} inserted, ${inlineUpdated} updated. File: ${fileInserted} inserted, ${fileUpdated} updated.`,
  );

  // ── Seed built-in themes ──
  console.log("\nSeeding themes…");
  const themesCollection = db.collection("themes");
  await themesCollection.createIndex({ slug: 1 }, { unique: true });
  await themesCollection.createIndex({ status: 1 });
  await themesCollection.createIndex({ tier: 1 });

  const themeNames = listBuiltinThemes();
  let themeInserted = 0;
  let themeUpdated = 0;
  for (const name of themeNames) {
    const theme = getBuiltinTheme(name);
    if (!theme) continue;

    const webCss = generateThemeCSS(theme, "web");
    const printCss = generateThemeCSS(theme, "print");

    const existing = await themesCollection.findOne({ slug: name });
    if (existing) {
      await themesCollection.updateOne(
        { slug: name },
        {
          $set: {
            theme_json: JSON.stringify(theme),
            web_css: webCss,
            print_css: printCss,
            updated_at: new Date(),
          },
        },
      );
      themeUpdated++;
      console.log(`  ~  ${name} — updated.`);
      continue;
    }

    await themesCollection.insertOne({
      id: `builtin-${name}`,
      owner_id: "system",
      slug: name,
      title: name.charAt(0).toUpperCase() + name.slice(1),
      description: theme.description || "",
      theme_json: JSON.stringify(theme),
      web_css: webCss,
      print_css: printCss,
      status: "approved",
      tier: "curated",
      installs: 0,
      stars: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    themeInserted++;
    console.log(`  ✓  ${name} — inserted.`);
  }

  console.log(`\nThemes: ${themeInserted} inserted, ${themeUpdated} updated.`);
  await client.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
