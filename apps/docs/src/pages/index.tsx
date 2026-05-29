import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import CodeBlock from "@theme/CodeBlock";
import {
  Building2,
  Bot,
  PenLine,
  ShieldCheck,
  Lock,
  FilePen,
  Package,
  Terminal,
  Server,
  Code2,
  Globe,
  LayoutDashboard,
  GitBranch,
  ArrowRight,
  Search,
  FileCheck,
  Zap,
  Clock,
  Users,
  Mail,
  ChevronRight,
} from "lucide-react";

const LANDING_EXAMPLE = `title: Service Agreement
summary: Consulting services Q2 2026
meta: | client: Acme Corp | ref: CONTRACT-2026-042
track: | version: 1.0 | by: Ahmed

section: Scope
text: Consulting services April–June 2026
text: Value: USD 24,000 | weight: bold
deadline: Payment due | date: 2026-04-30 | consequence: Late fee applies

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp
contact: James Miller | role: COO | email: j.miller@client.co | org: Client Co.

approve: Reviewed by legal | by: Sarah Chen | role: Legal Counsel
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked`;

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return <div className="feature-icon">{children}</div>;
}

export default function Home(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="hero-section">
        <div className="container">
          <div className="hero-badge">Open format &middot; v3.1</div>
          <h1>Documents that think.</h1>
          <p className="hero-subtitle">
            IntentText (<code>.it</code>) is an open format for structured
            documents — readable by humans, queryable by code, trustworthy by
            design.
          </p>
          <div className="hero-buttons">
            <Link
              className="button button--primary button--lg"
              to="/docs/guide/quick-start"
            >
              Get started <ArrowRight size={18} />
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://intenttext-hub.vercel.app"
            >
              Browse templates
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <strong>37</strong>
              <span>canonical keywords</span>
            </div>
            <div className="hero-stat">
              <strong>8</strong>
              <span>themes</span>
            </div>
            <div className="hero-stat">
              <strong>5</strong>
              <span>SDKs</span>
            </div>
            <div className="hero-stat">
              <strong>76</strong>
              <span>templates</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Example ──────────────────────────────────── */}
      <div className="container section">
        <h2 className="section-title">One format. Every audience.</h2>
        <p className="section-subtitle">
          Human-readable source on the left. Rendered output on the right. Same
          file.
        </p>
        <div className="live-example">
          <div className="live-source">
            <CodeBlock language="bash">{LANDING_EXAMPLE}</CodeBlock>
          </div>
          <div className="live-render">
            <h3 style={{ margin: "0 0 0.25rem" }}>Service Agreement</h3>
            <p className="render-summary">Consulting services Q2 2026</p>
            <div className="render-meta">
              <span>client: Acme Corp</span>
              <span>ref: CONTRACT-2026-042</span>
            </div>
            <div className="render-track">
              <FileCheck size={13} /> Tracked — version: 1.0 — by: Ahmed
            </div>
            <h4 className="render-section">Scope</h4>
            <p className="render-text">Consulting services April–June 2026</p>
            <p className="render-text" style={{ fontWeight: 700 }}>
              Value: USD 24,000
            </p>
            <div className="render-deadline">
              <Clock size={14} /> <strong>Payment due</strong> — 2026-04-30
            </div>
            <h4 className="render-section">Parties</h4>
            <div className="render-contact">
              <Users size={14} />
              <div>
                <strong>Ahmed Al-Rashid</strong>
                <span className="render-role"> — CEO at Acme Corp</span>
                <div className="render-email">
                  <Mail size={12} /> ahmed@acme.com
                </div>
              </div>
            </div>
            <div className="render-contact">
              <Users size={14} />
              <div>
                <strong>James Miller</strong>
                <span className="render-role"> — COO at Client Co.</span>
                <div className="render-email">
                  <Mail size={12} /> j.miller@client.co
                </div>
              </div>
            </div>
            <div className="render-trust">
              <div className="trust-approve">
                <ShieldCheck size={14} /> Reviewed by legal — Sarah Chen, Legal
                Counsel
              </div>
              <div className="trust-sign">
                <PenLine size={14} /> Signed by Ahmed Al-Rashid — CEO
              </div>
              <div className="trust-seal">
                <Lock size={14} /> Document sealed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Three Audiences ───────────────────────────────── */}
      <div className="alt-bg">
        <div className="container section">
          <h2 className="section-title">Built for three audiences</h2>
          <div className="audience-grid">
            <div className="audience-card">
              <FeatureIcon>
                <Building2 size={28} strokeWidth={1.5} />
              </FeatureIcon>
              <h3>Organizations</h3>
              <p>
                Contracts, policies, reports — all in queryable <code>.it</code>{" "}
                files. Find every deadline across 500 documents. Track who
                approved what. Seal contracts with cryptographic trust.
              </p>
              <Link to="/docs/guide/for-organizations" className="card-link">
                For organizations <ChevronRight size={16} />
              </Link>
            </div>
            <div className="audience-card">
              <FeatureIcon>
                <Bot size={28} strokeWidth={1.5} />
              </FeatureIcon>
              <h3>AI Agents</h3>
              <p>
                27 workflow keywords. Pipeline definitions agents can read and
                execute. Gates, decisions, handoffs. An MCP server ships ready.
                Agents produce <code>.it</code> files, not just Markdown.
              </p>
              <Link to="/docs/guide/for-agents" className="card-link">
                For agents <ChevronRight size={16} />
              </Link>
            </div>
            <div className="audience-card">
              <FeatureIcon>
                <PenLine size={28} strokeWidth={1.5} />
              </FeatureIcon>
              <h3>Writers</h3>
              <p>
                Write in plain text. Get professional output. 8 built-in themes
                — corporate, editorial, legal, minimal. Figures with
                auto-numbering. Citations. PDF export in one command.
              </p>
              <Link to="/docs/guide/for-writers" className="card-link">
                For writers <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Why IntentText ────────────────────────────────── */}
      <div className="container section">
        <h2 className="section-title">Why IntentText?</h2>
        <div className="why-grid">
          <div className="why-item">
            <Search size={20} strokeWidth={1.5} />
            <div>
              <strong>Queryable</strong>
              <p>
                Find every <code>deadline:</code> across hundreds of documents.
                Extract contacts, metrics, approvals — programmatically.
              </p>
            </div>
          </div>
          <div className="why-item">
            <ShieldCheck size={20} strokeWidth={1.5} />
            <div>
              <strong>Trustworthy</strong>
              <p>
                Built-in approve, sign, freeze, and amend keywords. Documents
                carry their own chain of custody.
              </p>
            </div>
          </div>
          <div className="why-item">
            <Zap size={20} strokeWidth={1.5} />
            <div>
              <strong>Zero dependencies</strong>
              <p>
                Plain text files. No database, no cloud, no vendor. Parse with a
                single function. Works offline.
              </p>
            </div>
          </div>
          <div className="why-item">
            <FileCheck size={20} strokeWidth={1.5} />
            <div>
              <strong>Portable</strong>
              <p>
                One <code>.it</code> file renders to HTML, PDF, JSON. The format
                is open. No lock-in, ever.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ecosystem ─────────────────────────────────────── */}
      <div className="alt-bg">
        <div className="container section">
          <h2 className="section-title">The ecosystem</h2>
          <p className="section-subtitle">
            Everything you need to create, validate, and distribute structured
            documents.
          </p>
          <div className="ecosystem-grid">
            <div className="ecosystem-item">
              <Package size={22} strokeWidth={1.5} />
              <strong>npm</strong>
              <span>@intenttext/core</span>
            </div>
            <div className="ecosystem-item">
              <Package size={22} strokeWidth={1.5} />
              <strong>PyPI</strong>
              <span>intenttext</span>
            </div>
            <div className="ecosystem-item">
              <Terminal size={22} strokeWidth={1.5} />
              <strong>CLI</strong>
              <span>Parse, render, seal</span>
            </div>
            <div className="ecosystem-item">
              <Server size={22} strokeWidth={1.5} />
              <strong>MCP Server</strong>
              <span>For AI agents</span>
            </div>
            <div className="ecosystem-item">
              <Code2 size={22} strokeWidth={1.5} />
              <strong>VS Code</strong>
              <span>Syntax + snippets</span>
            </div>
            <div className="ecosystem-item">
              <Globe size={22} strokeWidth={1.5} />
              <strong>Hub</strong>
              <span>76 templates, 8 themes</span>
            </div>
            <div className="ecosystem-item">
              <LayoutDashboard size={22} strokeWidth={1.5} />
              <strong>Editor</strong>
              <span>Web-based WYSIWYG</span>
            </div>
            <div className="ecosystem-item">
              <GitBranch size={22} strokeWidth={1.5} />
              <strong>GitHub Action</strong>
              <span>CI validation</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust ─────────────────────────────────────────── */}
      <div className="container section">
        <h2 className="section-title">Trust, built in</h2>
        <p className="section-subtitle">
          Documents carry their own chain of custody. No external system
          required.
        </p>
        <div className="trust-steps">
          <div className="trust-step">
            <div className="trust-step-number">1</div>
            <h3>Approve & Sign</h3>
            <p>
              Named approvals and cryptographic signatures live in the document
              itself. Not in metadata. Not in a separate system.
            </p>
          </div>
          <div className="trust-step">
            <div className="trust-step-number">2</div>
            <h3>Seal</h3>
            <p>
              One command: <code>intenttext seal</code>. The document is frozen.
              Any tampering breaks the hash. Verify anytime.
            </p>
          </div>
          <div className="trust-step">
            <div className="trust-step-number">3</div>
            <h3>Amend</h3>
            <p>
              Frozen documents can be formally amended. The original seal is
              preserved. The amendment carries its own approval chain.
            </p>
          </div>
        </div>
      </div>

      {/* ── CTA ───────────────────────────────────────────── */}
      <div className="alt-bg cta-section">
        <div className="container" style={{ textAlign: "center" }}>
          <h2>Start writing documents that think.</h2>
          <p className="section-subtitle">
            Open format. No lock-in. The <code>.it</code> file is yours.
          </p>
          <div className="hero-buttons">
            <Link
              className="button button--primary button--lg"
              to="/docs/guide/quick-start"
            >
              Get started <ArrowRight size={18} />
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://intenttext-hub.vercel.app"
            >
              Browse the Hub
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
