import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  _resetIdCounter,
  renderHTML,
  renderPrint,
  validateDocumentSemantic,
  queryBlocks,
  ALIASES,
} from "../src/index";

beforeEach(() => _resetIdCounter());

// ── Helpers ─────────────────────────────────────────────

function parse(source: string) {
  return parseIntentText(source);
}

function blocks(source: string) {
  return parse(source).blocks;
}

function firstBlock(source: string) {
  return blocks(source)[0];
}

function validate(source: string) {
  return validateDocumentSemantic(parse(source));
}

function issuesByCode(source: string, code: string) {
  return validate(source).issues.filter((i) => i.code === code);
}

function html(source: string) {
  return renderHTML(parse(source));
}

function print(source: string) {
  return renderPrint(parse(source));
}

// ═══════════════════════════════════════════════════════════
//  ref: — Cross-document reference (8 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 ref: — cross-document reference", () => {
  it("ref: with file: parses correctly", () => {
    const b = firstBlock(
      "ref: Master Agreement | file: ./master.it | rel: governed-by",
    );
    expect(b.type).toBe("ref");
    expect(b.content).toBe("Master Agreement");
    expect(b.properties?.file).toBe("./master.it");
    expect(b.properties?.rel).toBe("governed-by");
  });

  it("ref: with url: parses correctly", () => {
    const b = firstBlock(
      "ref: Payment Receipt | url: https://billing.example.com/rec-042 | rel: payment",
    );
    expect(b.type).toBe("ref");
    expect(b.content).toBe("Payment Receipt");
    expect(b.properties?.url).toBe("https://billing.example.com/rec-042");
    expect(b.properties?.rel).toBe("payment");
  });

  it("ref: renders correctly in web output with link", () => {
    const output = html(
      "ref: Agreement | file: ./agreement.it | rel: governed-by",
    );
    expect(output).toContain("ref");
    expect(output).toContain("Agreement");
    expect(output).toContain("governed-by");
  });

  it("ref: renders correctly in print output", () => {
    const output = print(
      "ref: Agreement | file: ./agreement.it | rel: governed-by",
    );
    expect(output).toContain("Agreement");
    expect(output).toContain("governed-by");
  });

  it("REF_MISSING_TARGET validation fires when neither file: nor url:", () => {
    const issues = issuesByCode(
      "ref: Orphan Reference | rel: related",
      "REF_MISSING_TARGET",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("REF_MISSING_REL warning fires when rel: absent", () => {
    const issues = issuesByCode(
      "ref: No Rel | file: ./test.it",
      "REF_MISSING_REL",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });

  it("references: alias resolves to ref:", () => {
    expect(ALIASES["references"]).toBe("ref");
    const b = firstBlock(
      "references: See Also | file: ./other.it | rel: related",
    );
    expect(b.type).toBe("ref");
  });

  it("query type=ref returns all document references", () => {
    const doc = parse(
      "ref: Doc A | file: ./a.it | rel: parent\nref: Doc B | url: https://example.com | rel: sibling\nnote: Not a ref",
    );
    const result = queryBlocks(doc, "type=ref");
    expect(result.matched).toBe(2);
    expect(result.blocks.every((b) => b.type === "ref")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  def: — Definition/Term (8 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 def: — definitions and glossary terms", () => {
  it("def: parses term from content and meaning from property", () => {
    const b = firstBlock("def: SLA | meaning: Service Level Agreement");
    expect(b.type).toBe("def");
    expect(b.content).toBe("SLA");
    expect(b.properties?.meaning).toBe("Service Level Agreement");
  });

  it("def: with abbr: renders abbreviation", () => {
    const output = html(
      "def: API | meaning: Application Programming Interface | abbr: API",
    );
    expect(output).toContain("API");
    expect(output).toContain("Application Programming Interface");
  });

  it("DEF_MISSING_MEANING error fires when meaning: absent", () => {
    const issues = issuesByCode("def: Orphan Term", "DEF_MISSING_MEANING");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("DEF_DUPLICATE_TERM warning fires for repeated term", () => {
    const issues = issuesByCode(
      "def: Term A | meaning: First\ndef: Term A | meaning: Second",
      "DEF_DUPLICATE_TERM",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });

  it("grouped def: blocks in a section render as glossary", () => {
    const output = html(
      "section: Definitions\n---\ndef: SLA | meaning: Service Level Agreement\ndef: API | meaning: Application Programming Interface",
    );
    expect(output).toContain("SLA");
    expect(output).toContain("API");
    expect(output).toContain("def");
  });

  it("define: alias resolves to def:", () => {
    expect(ALIASES["define"]).toBe("def");
    const b = firstBlock("define: Term | meaning: Definition text");
    expect(b.type).toBe("def");
  });

  it("query type=def returns all definitions", () => {
    const doc = parse(
      "def: Alpha | meaning: First letter\ndef: Beta | meaning: Second letter\nnote: Not a def",
    );
    const result = queryBlocks(doc, "type=def");
    expect(result.matched).toBe(2);
  });

  it("def: renders correctly in print output", () => {
    const output = print("def: NDA | meaning: Non-Disclosure Agreement");
    expect(output).toContain("NDA");
    expect(output).toContain("Non-Disclosure Agreement");
  });
});

// ═══════════════════════════════════════════════════════════
//  metric: — Measurable value (10 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 metric: — measurable values", () => {
  it("metric: parses value, unit, period, target, trend correctly", () => {
    const b = firstBlock(
      "metric: Uptime | value: 99.95 | unit: % | period: monthly | target: 99.9 | trend: up",
    );
    expect(b.type).toBe("metric");
    expect(b.content).toBe("Uptime");
    expect(b.properties?.value).toBe("99.95");
    expect(b.properties?.unit).toBe("%");
    expect(b.properties?.period).toBe("monthly");
    expect(b.properties?.target).toBe("99.9");
    expect(b.properties?.trend).toBe("up");
  });

  it("METRIC_MISSING_VALUE error fires when value: absent", () => {
    const issues = issuesByCode(
      "metric: No Value | unit: %",
      "METRIC_MISSING_VALUE",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("METRIC_INVALID_TREND warning fires for unknown trend value", () => {
    const issues = issuesByCode(
      "metric: Test | value: 42 | trend: sideways",
      "METRIC_INVALID_TREND",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });

  it("metric: with value >= target renders green indicator in web", () => {
    const output = html(
      "metric: Uptime | value: 99.99 | unit: % | target: 99.9",
    );
    expect(output).toContain("99.99");
    expect(output).toContain("met");
  });

  it("metric: with value < target renders red indicator in web", () => {
    const output = html(
      "metric: Uptime | value: 99.5 | unit: % | target: 99.9",
    );
    expect(output).toContain("99.5");
    expect(output).toContain("it-metric-red");
  });

  it("metric: with no target renders with neutral styling", () => {
    const output = html("metric: Revenue | value: 1200000 | unit: USD");
    expect(output).toContain("1200000");
    expect(output).toContain("metric");
  });

  it("trend indicator renders: up=↑ down=↓ stable=→", () => {
    const upHtml = html("metric: Growth | value: 15 | unit: % | trend: up");
    const downHtml = html("metric: Churn | value: 3 | unit: % | trend: down");
    const stableHtml = html(
      "metric: Retention | value: 97 | unit: % | trend: stable",
    );
    expect(upHtml).toContain("↑");
    expect(downHtml).toContain("↓");
    expect(stableHtml).toContain("→");
  });

  it("multiple metric: blocks in a section render as grid", () => {
    const output = html(
      "section: KPIs\n---\nmetric: A | value: 10\nmetric: B | value: 20\nmetric: C | value: 30",
    );
    expect(output).toContain("metric");
    // Should have all three
    expect(output).toContain("10");
    expect(output).toContain("20");
    expect(output).toContain("30");
  });

  it("kpi: alias resolves to metric:", () => {
    expect(ALIASES["kpi"]).toBe("metric");
    const b = firstBlock("kpi: Conversion Rate | value: 3.2 | unit: %");
    expect(b.type).toBe("metric");
  });

  it("query type=metric returns all metrics with values", () => {
    const doc = parse(
      "metric: A | value: 10\nmetric: B | value: 20\nnote: Not a metric",
    );
    const result = queryBlocks(doc, "type=metric");
    expect(result.matched).toBe(2);
    expect(result.blocks.every((b) => b.properties?.value)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  amendment: — Change to frozen document (10 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 amendment: — changes to frozen documents", () => {
  const frozenDoc = [
    "title: Test Contract",
    "section: Terms",
    "---",
    "paragraph: Original terms here",
    "---",
    "sign: Alice | role: Director | hash: sha256:abc | at: 2026-01-01",
    "freeze: | status: locked | hash: sha256:abc123 | at: 2026-01-01",
    "amendment: Payment revised | section: Terms | was: Net-30 | now: Net-15 | ref: Amendment #1 | by: Legal | at: 2026-02-01",
  ].join("\n");

  // Helper: find a block by type in the entire tree (blocks may be nested under sections)
  function findBlockDeep(doc: ReturnType<typeof parse>, type: string) {
    for (const b of doc.blocks) {
      if (b.type === type) return b;
      if (b.children) {
        const found = b.children.find((c) => c.type === type);
        if (found) return found;
      }
    }
    return undefined;
  }

  it("amendment: parses all properties correctly", () => {
    const doc = parse(frozenDoc);
    const amendment = findBlockDeep(doc, "amendment");
    expect(amendment).toBeDefined();
    expect(amendment!.content).toBe("Payment revised");
    expect(amendment!.properties?.section).toBe("Terms");
    expect(amendment!.properties?.was).toBe("Net-30");
    expect(amendment!.properties?.now).toBe("Net-15");
    expect(amendment!.properties?.ref).toBe("Amendment #1");
    expect(amendment!.properties?.by).toBe("Legal");
    expect(amendment!.properties?.at).toBe("2026-02-01");
  });

  it("AMENDMENT_WITHOUT_FREEZE error fires when no freeze block", () => {
    const issues = issuesByCode(
      "title: No Freeze\namendment: Bad | section: A | now: B | ref: 1 | by: X | at: 2026-01-01",
      "AMENDMENT_WITHOUT_FREEZE",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("AMENDMENT_MISSING_REF error fires correctly", () => {
    const issues = issuesByCode(
      "title: T\nfreeze: | status: locked\namendment: Test | section: A | now: B | by: X | at: 2026-01-01",
      "AMENDMENT_MISSING_REF",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("AMENDMENT_MISSING_NOW error fires correctly", () => {
    const issues = issuesByCode(
      "title: T\nfreeze: | status: locked\namendment: Test | section: A | ref: 1 | by: X | at: 2026-01-01",
      "AMENDMENT_MISSING_NOW",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("amendment: after freeze: is valid — no AMENDMENT_WITHOUT_FREEZE error", () => {
    const issues = issuesByCode(frozenDoc, "AMENDMENT_WITHOUT_FREEZE");
    expect(issues.length).toBe(0);
  });

  it("amendment: renders correctly in web output", () => {
    const output = html(frozenDoc);
    expect(output).toContain("Payment revised");
    expect(output).toContain("amendment");
    expect(output).toContain("Net-30");
    expect(output).toContain("Net-15");
  });

  it("amendment: renders correctly in print output", () => {
    const output = print(frozenDoc);
    expect(output).toContain("Payment revised");
    expect(output).toContain("Net-15");
  });

  it("multiple amendments are valid after freeze", () => {
    const source = [
      "title: Multi Amendment",
      "freeze: | status: locked | hash: sha256:abc | at: 2026-01-01",
      "amendment: Change 1 | section: A | now: X | ref: 1 | by: Legal | at: 2026-02-01",
      "amendment: Change 2 | section: B | now: Y | ref: 1 | by: Legal | at: 2026-02-01",
    ].join("\n");
    const issues = issuesByCode(source, "AMENDMENT_WITHOUT_FREEZE");
    expect(issues.length).toBe(0);
    const doc = parse(source);
    const amendments = doc.blocks.filter((b) => b.type === "amendment");
    expect(amendments.length).toBe(2);
  });

  it("amend: alias resolves to amendment:", () => {
    expect(ALIASES["amend"]).toBe("amendment");
    const b = firstBlock(
      "amend: Test Change | section: A | now: B | ref: 1 | by: X | at: 2026-01-01",
    );
    expect(b.type).toBe("amendment");
  });

  it("query type=amendment returns all amendments", () => {
    const doc = parse(
      frozenDoc +
        "\namendment: Second change | section: B | now: C | ref: 2 | by: Legal | at: 2026-03-01",
    );
    const result = queryBlocks(doc, "type=amendment");
    expect(result.matched).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  figure: — Document figures (8 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 figure: — document figures", () => {
  it("figure: parses src, caption, num, width, align correctly", () => {
    const b = firstBlock(
      "figure: Architecture Diagram | src: ./diagrams/arch.png | caption: System architecture overview | num: 1 | width: 80% | align: center",
    );
    expect(b.type).toBe("figure");
    expect(b.content).toBe("Architecture Diagram");
    expect(b.properties?.src).toBe("./diagrams/arch.png");
    expect(b.properties?.caption).toBe("System architecture overview");
    expect(b.properties?.num).toBe("1");
    expect(b.properties?.width).toBe("80%");
    expect(b.properties?.align).toBe("center");
  });

  it("FIGURE_MISSING_SRC error fires when src: absent", () => {
    const issues = issuesByCode(
      "figure: No Source | caption: Test",
      "FIGURE_MISSING_SRC",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("FIGURE_MISSING_CAPTION warning fires when caption: absent", () => {
    const issues = issuesByCode(
      "figure: No Caption | src: ./img.png",
      "FIGURE_MISSING_CAPTION",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });

  it("figure: renders as <figure> with <img> and <figcaption> in web output", () => {
    const output = html(
      "figure: Test Fig | src: ./test.png | caption: A test figure",
    );
    expect(output).toContain("<figure");
    expect(output).toContain("<img");
    expect(output).toContain("test.png");
    expect(output).toContain("<figcaption");
    expect(output).toContain("A test figure");
  });

  it("auto-numbering: multiple figures each render with captions", () => {
    const output = html(
      "figure: First | src: ./a.png | caption: First figure\nfigure: Second | src: ./b.png | caption: Second figure",
    );
    expect(output).toContain("First figure");
    expect(output).toContain("Second figure");
    // Both render as <figure> elements
    const figCount = (output.match(/<figure/g) || []).length;
    expect(figCount).toBe(2);
  });

  it("num: property is parsed and stored", () => {
    const b = firstBlock(
      "figure: Custom | src: ./a.png | caption: Custom number | num: 5",
    );
    expect(b.properties?.num).toBe("5");
  });

  it("fig: alias resolves to figure:", () => {
    expect(ALIASES["fig"]).toBe("figure");
    const b = firstBlock("fig: Diagram | src: ./d.png | caption: Test");
    expect(b.type).toBe("figure");
  });

  it("query type=figure returns all figures", () => {
    const doc = parse(
      "figure: A | src: ./a.png | caption: Fig A\nfigure: B | src: ./b.png | caption: Fig B\nnote: Not a figure",
    );
    const result = queryBlocks(doc, "type=figure");
    expect(result.matched).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  signline: — Physical signature placeholder (8 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 signline: — physical signature placeholders", () => {
  it("signline: parses name, role, date-line correctly", () => {
    const b = firstBlock(
      "signline: Provider Signature | name: Alice Smith | role: CEO | date-line: true",
    );
    expect(b.type).toBe("signline");
    expect(b.content).toBe("Provider Signature");
    expect(b.properties?.name).toBe("Alice Smith");
    expect(b.properties?.role).toBe("CEO");
    expect(b.properties?.["date-line"]).toBe("true");
  });

  it("signline: renders signature line, name, role in web output", () => {
    const output = html("signline: Provider | name: Alice Smith | role: CEO");
    expect(output).toContain("it-signline");
    expect(output).toContain("Provider");
    expect(output).toContain("CEO");
  });

  it("date-line: true renders date line in web output", () => {
    const output = html(
      "signline: Signer | name: Bob | role: VP | date-line: true",
    );
    expect(output).toContain("Date");
  });

  it("date-line: false or absent renders no date line", () => {
    const output = html(
      "signline: Signer | name: Bob | role: VP | date-line: false",
    );
    // Should not contain a date prompt line
    expect(output).not.toContain("date-line");
  });

  it("multiple signline: blocks render side-by-side in print CSS", () => {
    const output = print(
      "signline: Provider Signature | name: Alice | role: CEO\nsignline: Client Signature | name: Bob | role: CTO",
    );
    expect(output).toContain("Provider Signature");
    expect(output).toContain("Client Signature");
  });

  it("signline: with no content renders Signature label", () => {
    const b = firstBlock("signline: | name: Anonymous | role: Witness");
    expect(b.type).toBe("signline");
    const output = html("signline: | name: Anonymous | role: Witness");
    expect(output).toContain("signline");
  });

  it("sign-here: alias resolves to signline:", () => {
    expect(ALIASES["sign-here"]).toBe("signline");
    const b = firstBlock("sign-here: Witness | name: Charlie | role: Witness");
    expect(b.type).toBe("signline");
  });

  it("signline: renders in print output", () => {
    const output = print(
      "signline: Signature | name: Alice | role: CEO | date-line: true",
    );
    expect(output).toContain("Signature");
    expect(output).toContain("CEO");
  });
});

// ═══════════════════════════════════════════════════════════
//  contact: — Structured contact information (8 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 contact: — contact information", () => {
  it("contact: parses all properties correctly", () => {
    const b = firstBlock(
      "contact: Jane Doe | role: Project Manager | email: jane@example.com | phone: +1-555-0100 | org: Acme Corp",
    );
    expect(b.type).toBe("contact");
    expect(b.content).toBe("Jane Doe");
    expect(b.properties?.role).toBe("Project Manager");
    expect(b.properties?.email).toBe("jane@example.com");
    expect(b.properties?.phone).toBe("+1-555-0100");
    expect(b.properties?.org).toBe("Acme Corp");
  });

  it("contact: with email renders clickable mailto: link", () => {
    const output = html("contact: Jane | email: jane@example.com | role: PM");
    expect(output).toContain("mailto:jane@example.com");
  });

  it("contact: with phone renders clickable tel: link", () => {
    const output = html("contact: Jane | phone: +15550100 | role: PM");
    expect(output).toContain("tel:+15550100");
  });

  it("CONTACT_NO_REACH warning fires when no email, phone, or url", () => {
    const issues = issuesByCode(
      "contact: Nobody | role: Ghost",
      "CONTACT_NO_REACH",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });

  it("multiple contact: blocks in a section render as contact list", () => {
    const output = html(
      "section: Team\n---\ncontact: Alice | email: alice@x.com | role: Lead\ncontact: Bob | email: bob@x.com | role: Dev",
    );
    expect(output).toContain("Alice");
    expect(output).toContain("Bob");
    expect(output).toContain("contact");
  });

  it("person: alias resolves to contact:", () => {
    expect(ALIASES["person"]).toBe("contact");
    const b = firstBlock("person: John | email: john@x.com | role: CEO");
    expect(b.type).toBe("contact");
  });

  it("query type=contact with org filter works", () => {
    const doc = parse(
      "contact: A | email: a@x.com | org: Acme\ncontact: B | email: b@x.com | org: Beta\ncontact: C | email: c@x.com | org: Acme",
    );
    const result = queryBlocks(doc, {
      where: [
        { field: "type", operator: "=", value: "contact" },
        { field: "org", operator: "=", value: "Acme" },
      ],
    });
    expect(result.matched).toBe(2);
  });

  it("contact: renders correctly in print output", () => {
    const output = print(
      "contact: Jane Doe | role: PM | email: jane@example.com | phone: +1-555-0100",
    );
    expect(output).toContain("Jane Doe");
    expect(output).toContain("jane@example.com");
  });
});

// ═══════════════════════════════════════════════════════════
//  deadline: — Temporal commitment (8 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 deadline: — temporal commitments", () => {
  it("deadline: parses date, consequence, authority, owner correctly", () => {
    const b = firstBlock(
      "deadline: Contract Renewal | date: 2027-06-15 | consequence: Auto-renews for 12 months | owner: Legal | authority: Board",
    );
    expect(b.type).toBe("deadline");
    expect(b.content).toBe("Contract Renewal");
    expect(b.properties?.date).toBe("2027-06-15");
    expect(b.properties?.consequence).toBe("Auto-renews for 12 months");
    expect(b.properties?.owner).toBe("Legal");
    expect(b.properties?.authority).toBe("Board");
  });

  it("DEADLINE_MISSING_DATE error fires when date: absent", () => {
    const issues = issuesByCode(
      "deadline: No Date | owner: Nobody",
      "DEADLINE_MISSING_DATE",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("error");
  });

  it("DEADLINE_PAST warning fires for past dates", () => {
    const issues = issuesByCode(
      "deadline: Expired | date: 2020-01-01",
      "DEADLINE_PAST",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });

  it("deadline: with near-future date renders with urgency styling", () => {
    // Use a date that is always near-future relative to any test run
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const dateStr = tomorrow.toISOString().split("T")[0];
    const output = html(
      `deadline: Urgent | date: ${dateStr} | consequence: Late fee`,
    );
    expect(output).toContain("deadline");
    expect(output).toContain("Urgent");
  });

  it("deadline: with far-future date renders normally", () => {
    const output = html(
      "deadline: Future Task | date: 2099-12-31 | consequence: None",
    );
    expect(output).toContain("deadline");
    expect(output).toContain("Future Task");
  });

  it("deadline: with consequence renders consequence text", () => {
    const output = html(
      "deadline: Payment Due | date: 2027-03-01 | consequence: Late fee of 1.5%",
    );
    expect(output).toContain("Late fee of 1.5%");
  });

  it("due: alias resolves to deadline:", () => {
    expect(ALIASES["due"]).toBe("deadline");
    const b = firstBlock("due: Sprint End | date: 2027-03-01");
    expect(b.type).toBe("deadline");
  });

  it("query type=deadline with owner filter works", () => {
    const doc = parse(
      "deadline: A | date: 2027-01-01 | owner: Ahmed\ndeadline: B | date: 2027-02-01 | owner: Sara\ndeadline: C | date: 2027-03-01 | owner: Ahmed",
    );
    const result = queryBlocks(doc, {
      where: [
        { field: "type", operator: "=", value: "deadline" },
        { field: "owner", operator: "=", value: "Ahmed" },
      ],
    });
    expect(result.matched).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  Cross-cutting: additional aliases (6 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.11 additional alias coverage", () => {
  it("see: alias resolves to ref:", () => {
    expect(ALIASES["see"]).toBe("ref");
    const b = firstBlock("see: Related Doc | file: ./rel.it | rel: related");
    expect(b.type).toBe("ref");
  });

  it("related: alias resolves to ref:", () => {
    expect(ALIASES["related"]).toBe("ref");
  });

  it("term: alias resolves to def:", () => {
    expect(ALIASES["term"]).toBe("def");
    const b = firstBlock("term: Glossary Entry | meaning: A term definition");
    expect(b.type).toBe("def");
  });

  it("glossary: alias resolves to def:", () => {
    expect(ALIASES["glossary"]).toBe("def");
  });

  it("measure: alias resolves to metric:", () => {
    expect(ALIASES["measure"]).toBe("metric");
    const b = firstBlock("measure: Test | value: 42 | unit: items");
    expect(b.type).toBe("metric");
  });

  it("change: alias resolves to amendment:", () => {
    expect(ALIASES["change"]).toBe("amendment");
  });

  it("diagram: alias resolves to figure:", () => {
    expect(ALIASES["diagram"]).toBe("figure");
  });

  it("chart: alias resolves to figure:", () => {
    expect(ALIASES["chart"]).toBe("figure");
  });

  it("signature-line: alias resolves to signline:", () => {
    expect(ALIASES["signature-line"]).toBe("signline");
  });

  it("sig: alias resolves to sign:", () => {
    expect(ALIASES["sig"]).toBe("sign");
  });

  it("party: alias resolves to contact:", () => {
    expect(ALIASES["party"]).toBe("contact");
  });

  it("milestone: alias resolves to deadline:", () => {
    expect(ALIASES["milestone"]).toBe("deadline");
  });

  it("due-date: alias resolves to deadline:", () => {
    expect(ALIASES["due-date"]).toBe("deadline");
  });

  it("stat: alias resolves to metric:", () => {
    expect(ALIASES["stat"]).toBe("metric");
  });
});

// ═══════════════════════════════════════════════════════════
//  Integration: version detection and keyword counts
// ═══════════════════════════════════════════════════════════

describe("v2.11 integration — version detection", () => {
  it("document with ref: and def: blocks detects as v2.11", () => {
    const doc = parse(
      "title: Test\nref: Doc | file: ./doc.it | rel: parent\ndef: Term | meaning: Meaning",
    );
    expect(doc.version).toBe("2.11");
  });

  it("document with metric: detects as v2.11", () => {
    const doc = parse("title: Test\nmetric: KPI | value: 42 | unit: %");
    expect(doc.version).toBe("2.11");
  });

  it("document with figure: detects as v2.11", () => {
    const doc = parse(
      "title: Test\nfigure: Diagram | src: ./d.png | caption: Test",
    );
    expect(doc.version).toBe("2.11");
  });

  it("document with signline: detects as v2.11", () => {
    const doc = parse("title: Test\nsignline: Sig | name: Alice | role: CEO");
    expect(doc.version).toBe("2.11");
  });

  it("document with contact: detects as v2.11", () => {
    const doc = parse("title: Test\ncontact: Jane | email: j@x.com | role: PM");
    expect(doc.version).toBe("2.11");
  });

  it("document with deadline: detects as v2.11", () => {
    const doc = parse("title: Test\ndeadline: Due | date: 2027-01-01");
    expect(doc.version).toBe("2.11");
  });

  it("document with amendment: (and freeze) detects as v2.11", () => {
    const doc = parse(
      "title: Test\nfreeze: | status: locked\namendment: Fix | section: A | now: B | ref: 1 | by: X | at: 2026-01-01",
    );
    expect(doc.version).toBe("2.11");
  });

  it("document without v2.11 keywords does not detect as v2.11", () => {
    const doc = parse("title: Simple\nnote: Just a note");
    expect(doc.version).not.toBe("2.11");
  });
});
