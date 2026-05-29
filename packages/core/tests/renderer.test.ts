import { describe, it, expect } from "vitest";
import { parseIntentText, renderHTML } from "../src";

describe("HTML Renderer", () => {
  it("should render a simple document", () => {
    const input = "title: My Document";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('<h1 class="intent-title"');
    expect(html).toContain("My Document");
    expect(html).toContain("intent-document");
  });

  it("should render inline formatting", () => {
    const input = "title: *Bold* and _italic_ text";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("should render single-backtick as inline label badge", () => {
    const input = "note: label is `mono` text";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('<span class="it-label">mono</span>');
  });

  it("should apply optional text alignment via align property", () => {
    const input = "note: Center this line | align: center";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-text intent-align-center"');
  });

  it("should render inline quote, date shorthand, and shorthand link", () => {
    const input =
      "note: ==Quote== by @sara on @today via [[portal|https://example.com]]";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-inline-quote"');
    expect(html).toContain('class="intent-inline-date"');
    expect(html).toContain('href="https://example.com"');
  });

  it("should render tasks with metadata", () => {
    const input = "task: Database migration | owner: Ahmed | due: Sunday";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-task"');
    expect(html).toContain('class="intent-task-checkbox"');
    expect(html).toContain("Database migration");
    expect(html).toContain("Ahmed");
    expect(html).toContain("Sunday");
  });

  it("should render completed tasks", () => {
    const input = "done: Secure the domain name | time: 09:00 AM";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-task intent-task-done"');
    expect(html).toContain('type="checkbox" checked');
    expect(html).toContain("intent-task-text-done");
    expect(html).toContain("09:00 AM");
  });

  it("should render tables", () => {
    const input = `headers: Name | Age | City
row: Ahmed | 30 | Dubai`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain("<table");
    expect(html).toContain("<thead>");
    expect(html).toContain("Name</th>"); // Look for the content, not the exact tag
    expect(html).toContain("<tbody>");
    expect(html).toContain("Ahmed</td>"); // Look for the content, not the exact tag
  });

  it("should render code blocks", () => {
    const input = 'code: console.log("Hello")';
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('<pre class="intent-code"');
    expect(html).toContain("<code>console.log(&quot;Hello&quot;)</code>");
  });

  it("should render ask blocks (question: is an alias for ask:)", () => {
    const input = "ask: Who has the key?";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-ask"');
    expect(html).toContain("Who has the key?");
  });

  it("should render question: as an alias for ask:", () => {
    const input = "question: Who owns this?";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-ask"');
    expect(html).toContain("Who owns this?");
  });

  it("should render images with captions", () => {
    const input = "image: Logo | at: logo.png | caption: Company Logo";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('src="logo.png"');
    expect(html).toContain('alt="Logo"');
    expect(html).toContain("Company Logo");
  });

  it("should render links", () => {
    const input = "link: Documentation | to: https://docs.com";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('<a href="https://docs.com"');
    expect(html).toContain("Documentation");
  });

  it("should handle RTL documents", () => {
    const input = "title: مرحبا بالعالم";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('dir="rtl"');
  });

  it("should escape HTML to prevent script injection", () => {
    const input = "note: <script>alert('xss')</script>";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("should sanitize unsafe link schemes", () => {
    const input = "link: Click me | to: javascript:alert(1)";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('href="#"');
  });

  it("should sanitize unsafe URLs in inline links", () => {
    const input = "note: See [click here](javascript:alert(1)) for details";
    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:");
  });

  it("should render section children (tasks, notes) inside the section", () => {
    const input = `section: Work
task: Fix bug | owner: Ali | due: Monday
note: Remember to test`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-section"');
    expect(html).toContain("Fix bug");
    expect(html).toContain("Ali");
    expect(html).toContain("Remember to test");
  });

  it("should render sub-section content (not just the heading)", () => {
    const input = `section: Overview
sub: Details
task: Sub task | owner: Bob`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain('class="intent-sub"');
    expect(html).toContain("Sub task");
    expect(html).toContain("Bob");
  });

  it("should wrap list items in <ul>, not place them as naked <li>", () => {
    const input = `- First item
- Second item`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain("<ul");
    expect(html).toContain("First item");
    expect(html).toContain("Second item");
    // <li> must be inside <ul>, not at root level
    const ulStart = html.indexOf("<ul");
    const ulEnd = html.indexOf("</ul>");
    const liPos = html.indexOf("<li");
    expect(liPos).toBeGreaterThan(ulStart);
    expect(liPos).toBeLessThan(ulEnd);
  });

  it("should not wrap task/note blocks in <ul> when mixed with list items", () => {
    const input = `section: Tasks
- List item one
task: A real task | owner: Sara`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    // The task div must NOT be inside a <ul>
    const ulStart = html.indexOf("<ul");
    const ulEnd = html.lastIndexOf("</ul>");
    const taskPos = html.indexOf('class="intent-task"');
    // If no <ul> at all OR the task appears after the </ul>, that's correct
    if (ulStart !== -1) {
      expect(taskPos).toBeGreaterThan(ulEnd);
    }
    expect(html).toContain("List item one");
    expect(html).toContain("A real task");
  });

  it("should wrap ordered list items in <ol>", () => {
    const input = `1. Step one
2. Step two
3. Step three`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain("<ol");
    expect(html).toContain("Step one");
    expect(html).toContain("Step three");
  });

  it("should render a realistic multi-section document without losing content", () => {
    const input = `title: *Project* Plan
summary: Launch overview

section: Logistics
headers: Item | Status
row: Server | Delivered

section: Team
- Set up environment
task: Deploy | owner: Ahmed | due: Sunday
done: Domain secured`;

    const parsed = parseIntentText(input);
    const html = renderHTML(parsed);

    expect(html).toContain("<h1");
    expect(html).toContain("Project");
    expect(html).toContain("Logistics");
    expect(html).toContain("Server");
    expect(html).toContain("Delivered");
    expect(html).toContain("Set up environment");
    expect(html).toContain("Deploy");
    expect(html).toContain("Ahmed");
    expect(html).toContain("Domain secured");
  });
});
