// #63: the trust banner claimed "Verified — unaltered" for any sealed doc whose hash
// matched — ignoring that the STYLING changed, content is HIDDEN, or the signer is
// name-only. It now reflects the full VerifyResult.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TrustBanner } from "../src/TrustBanner";
import { extractTrustState } from "../src/trust-state";
import { parseIntentText, sealDocument } from "@dotit/core";

afterEach(cleanup);

const sealed = sealDocument("title: Contract\n\ntext: Pay USD 100.", {
  signer: "CFO",
}).source;
const trustOf = (s: string) => extractTrustState(parseIntentText(s));

describe("#63: trust banner reflects the full verdict, not just intact", () => {
  it("a clean sealed doc shows Sealed", () => {
    const { getByText } = render(
      <TrustBanner trust={trustOf(sealed)} intact={true} source={sealed} />,
    );
    expect(getByText("Sealed")).toBeTruthy();
  });

  it("HIDDEN content is a red caution — never 'Verified — unaltered'", () => {
    const { getByText, container } = render(
      <TrustBanner
        trust={trustOf(sealed)}
        intact={true}
        hiddenContent
        source={sealed}
      />,
    );
    expect(getByText(/hidden content/i)).toBeTruthy();
    expect(container.querySelector(".docs-trust-chip--broken")).toBeTruthy();
    expect(container.textContent).not.toMatch(/unaltered since sealing/i);
  });

  it("a RESTYLED (appearanceChanged) seal is an amber caution", () => {
    const { getByText, container } = render(
      <TrustBanner
        trust={trustOf(sealed)}
        intact={true}
        appearanceChanged
        source={sealed}
      />,
    );
    expect(getByText(/restyled/i)).toBeTruthy();
    expect(container.querySelector(".docs-trust-chip--weak")).toBeTruthy();
  });

  it("identityAsserted is surfaced as a caveat on a name-only seal", () => {
    const { container } = render(
      <TrustBanner
        trust={trustOf(sealed)}
        intact={true}
        identityAsserted
        source={sealed}
      />,
    );
    expect(
      container.querySelector('[title*="not cryptographically verified"]'),
    ).toBeTruthy();
  });
});
