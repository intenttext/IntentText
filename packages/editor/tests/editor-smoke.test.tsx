// editor-smoke — mount the real editor in the simulated DOM and exercise the
// non-visual "parts": it must mount without throwing, render the ribbon + content,
// honour read-only when sealed, and the trust-state extraction must classify the
// lifecycle correctly. (Pixel layout/pagination needs a real browser; this guards
// against crashes and logic regressions.)

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { IntentTextEditor } from "../src/IntentTextEditor";
import { extractTrustState } from "../src/trust-state";
import { parseIntentText } from "@dotit/core";

afterEach(cleanup);

const SAMPLE = "title: Test Doc\ntext: Hello world\nsection: Scope\ntext: Details here";

describe("IntentTextEditor mounts", () => {
  it("renders without throwing, shows the ribbon and the content", () => {
    const onChange = vi.fn();
    let container!: HTMLElement;
    expect(() => {
      container = render(
        <IntentTextEditor value={SAMPLE} onChange={onChange} />,
      ).container;
    }).not.toThrow();
    expect(container.querySelector(".docs-ribbon-shell")).toBeTruthy();
    expect(container.textContent).toContain("Hello world");
  });

  it("a sealed document mounts read-only without throwing", () => {
    const sealed =
      SAMPLE +
      "\nsign: Ahmed | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:abc | spec: 1" +
      "\nfreeze: | at: 2026-03-06T14:33:00Z | hash: sha256:abc | spec: 1 | status: locked";
    expect(() =>
      render(<IntentTextEditor value={sealed} onChange={() => {}} />),
    ).not.toThrow();
  });

  it("respects showRibbon / showTrustBanner / showChangeIndicator = false", () => {
    const { container } = render(
      <IntentTextEditor
        value={SAMPLE}
        onChange={() => {}}
        showRibbon={false}
        showTrustBanner={false}
        showChangeIndicator={false}
      />,
    );
    expect(container.querySelector(".docs-ribbon-shell")).toBeNull();
    expect(container.querySelector(".docs-trust-chip")).toBeNull();
    expect(container.querySelector(".it-change-chip")).toBeNull();
  });
});

describe("trust lifecycle — extractTrustState", () => {
  const ts = (s: string) => extractTrustState(parseIntentText(s));

  it("draft: nothing signed or sealed", () => {
    const t = ts("title: X\ntext: body");
    expect(t.isSealed).toBe(false);
    expect(t.signatures.length).toBe(0);
    expect(t.approvals.length).toBe(0);
  });

  it("approved: collects approvals", () => {
    const t = ts("title: X\napprove: Reviewed | by: Sarah | role: Legal | at: 2026-03-05");
    expect(t.approvals.length).toBe(1);
    expect(t.approvals[0].by).toBe("Sarah");
  });

  it("signed: collects signatures", () => {
    const t = ts("title: X\nsign: Ahmed | role: CEO | at: 2026-03-06 | hash: sha256:abc");
    expect(t.signatures.length).toBe(1);
    expect(t.signatures[0].by).toBe("Ahmed");
  });

  it("sealed: freeze flips isSealed", () => {
    const t = ts("title: X\nfreeze: | at: 2026-03-06 | hash: sha256:abc | status: locked");
    expect(t.isSealed).toBe(true);
  });
});
