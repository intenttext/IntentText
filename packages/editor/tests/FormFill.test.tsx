// FormFill component regression tests (happy-dom) — the recipient fill experience.
// Guards the durable-hydration fix: controls must persist, conditional fields
// hide/reveal, computed fields auto-fill read-only.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FormFill } from "../src/FormFill";

afterEach(cleanup);

const FORM = `meta: | type: form
title: Order
input: Country | key: country | type: choice | options: KW, SA | required: yes
input: VAT no | key: vat | type: text | show-if: country = SA
input: Qty | key: qty | type: number | value: 4
input: Price | key: price | type: number | value: 250
input: Total | key: total | type: number | compute: qty * price`;

const node = (root: HTMLElement, k: string) => root.querySelector<HTMLElement>(`[data-key="${k}"]`);
const ctrl = (root: HTMLElement, k: string) =>
  node(root, k)?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select,textarea") ?? null;
const hidden = (el: HTMLElement | null) => !el || el.style.display === "none";

describe("FormFill", () => {
  it("hydrates fields into live, persistent controls", () => {
    const { container } = render(<FormFill value={FORM} />);
    const root = container as HTMLElement;
    expect(ctrl(root, "country")?.tagName).toBe("SELECT");
    expect(ctrl(root, "vat")?.tagName).toBe("INPUT");
    expect(ctrl(root, "qty")?.tagName).toBe("INPUT");
    // 5 controls total (country select + vat/qty/price/total inputs)
    expect(root.querySelectorAll("input,select,textarea").length).toBe(5);
  });

  it("hides a conditional field until its show-if holds, then reveals it", () => {
    const { container } = render(<FormFill value={FORM} />);
    const root = container as HTMLElement;
    expect(hidden(node(root, "vat"))).toBe(true); // country empty ≠ SA
    const country = ctrl(root, "country") as HTMLSelectElement;
    country.value = "SA";
    fireEvent.change(country);
    expect(hidden(node(root, "vat"))).toBe(false); // revealed
    country.value = "KW";
    fireEvent.change(country);
    expect(hidden(node(root, "vat"))).toBe(true); // hidden again
  });

  it("auto-fills a computed field read-only", () => {
    const { container } = render(<FormFill value={FORM} />);
    const total = ctrl(container as HTMLElement, "total") as HTMLInputElement;
    expect(total?.value).toBe("1000"); // qty(4) * price(250)
    expect(total?.disabled).toBe(true);
  });
});
