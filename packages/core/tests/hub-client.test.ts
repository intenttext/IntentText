import { describe, it, expect } from "vitest";
import {
  submitForm,
  buildSubmission,
  applyAnswers,
} from "../src/index";

const FORM = `meta: | type: form
title: Vendor Onboarding
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA | required: yes`;

const complete = applyAnswers(FORM, { legal_name: "Dalil Tech", country: "KW" });

/** A fetch stub that records the request and returns a canned response. */
function stubFetch(status = 201, json: unknown = { id: "sub_1", received: true }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("hub submit client", () => {
  it("builds a self-describing payload from the form", () => {
    const p = buildSubmission(complete, { formId: "vendor-form", submittedAt: "2026-06-16T00:00:00Z" });
    expect(p.source).toBe(complete);
    expect(p.answers).toMatchObject({ legal_name: "Dalil Tech", country: "KW" });
    expect(p.hash).toMatch(/^sha256:/);
    expect(p.formId).toBe("vendor-form");
    expect(p.submittedAt).toBe("2026-06-16T00:00:00Z");
  });

  it("POSTs a complete form and returns the parsed result", async () => {
    const { impl, calls } = stubFetch();
    const r = await submitForm(complete, { endpoint: "https://hub/api/submit", fetchImpl: impl, formId: "vendor-form" });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id: "sub_1" });
    // it actually POSTed JSON to the endpoint
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://hub/api/submit");
    expect(calls[0].init.method).toBe("POST");
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.answers.legal_name).toBe("Dalil Tech");
  });

  it("refuses an incomplete form (no network call)", async () => {
    const { impl, calls } = stubFetch();
    const r = await submitForm(FORM, { endpoint: "https://hub", fetchImpl: impl });
    expect(r).toMatchObject({ ok: false, error: "form_incomplete" });
    expect(calls).toHaveLength(0);
  });

  it("refuses a non-form", async () => {
    const { impl } = stubFetch();
    const r = await submitForm("title: Just a doc", { endpoint: "https://hub", fetchImpl: impl });
    expect(r).toMatchObject({ ok: false, error: "not_a_form" });
  });

  it("surfaces an HTTP error without throwing", async () => {
    const { impl } = stubFetch(422, { error: "bad" });
    const r = await submitForm(complete, { endpoint: "https://hub", fetchImpl: impl });
    expect(r).toMatchObject({ ok: false, status: 422, error: "http_422" });
  });

  it("can submit an incomplete form when requireComplete is false", async () => {
    const { impl, calls } = stubFetch();
    const r = await submitForm(FORM, { endpoint: "https://hub", fetchImpl: impl, requireComplete: false });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
