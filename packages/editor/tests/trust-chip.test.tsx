// trust-chip — the single trust control (the DRAFT chip + its TrustActions popover)
// must actually sign/seal. Guards the consolidation: clicking Seal in the chip
// popover applies a sealed source through onChange.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { TrustBanner } from "../src/TrustBanner";
import { extractTrustState } from "../src/trust-state";
import { isSealed, parseIntentText, signDocument } from "@dotit/core";

afterEach(cleanup);

const SRC = "title: Test\ntext: hello";
const trustOf = (s: string) => extractTrustState(parseIntentText(s));

describe("trust chip — sign/seal actions apply", () => {
  it("is actionable (renders the actions popover) when onChange is given", () => {
    const { getByText, container } = render(
      <TrustBanner
        trust={trustOf(SRC)}
        intact={null}
        source={SRC}
        onChange={() => {}}
      />,
    );
    // Open the chip.
    fireEvent.click(getByText("Draft"));
    // The Seal action should be present.
    expect(container.querySelector(".trust-actions")).toBeTruthy();
    expect(getByText(/Seal \(freeze\)/)).toBeTruthy();
  });

  it("clicking Seal applies a sealed source via onChange", () => {
    let out = "";
    const { getByText } = render(
      <TrustBanner
        trust={trustOf(SRC)}
        intact={null}
        source={SRC}
        onChange={(s) => {
          out = s;
        }}
      />,
    );
    fireEvent.click(getByText("Draft"));
    fireEvent.click(getByText(/Seal \(freeze\)/));
    expect(out).not.toBe("");
    expect(isSealed(out)).toBe(true);
  });

  it("a signed doc shows 'Signed' intact, 'Signature broken' once edited", () => {
    const signed = signDocument("title: Invoice\ntext: Pay 100 QAR", {
      signer: "Emad",
      role: "CEO",
    }).source;
    const a = render(
      <TrustBanner trust={trustOf(signed)} intact={null} source={signed} />,
    );
    expect(a.getByText("Signed")).toBeTruthy();
    cleanup();
    // Tamper the content → signatures no longer match → broken.
    const tampered = signed.replace("100 QAR", "999 QAR");
    const b = render(
      <TrustBanner trust={trustOf(tampered)} intact={null} source={tampered} />,
    );
    expect(b.getByText(/Signature broken/)).toBeTruthy();
  });
});
