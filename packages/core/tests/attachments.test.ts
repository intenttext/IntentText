import { describe, it, expect } from "vitest";
import {
  extractAttachments,
  getAttachment,
  hasAttachment,
  addAttachment,
  removeAttachment,
  attachmentDataUri,
  safePreviewMime,
  isFormComplete,
  isTemplate,
  sealDocument,
  verifyDocument,
  FORM_FIELD_TYPES,
} from "../src/index";

describe("G-21: attachment preview mime is sanitized (no inline script)", () => {
  const b64 = Buffer.from("hello").toString("base64");
  it("downgrades script-capable types to application/octet-stream", () => {
    for (const m of [
      "text/html",
      "image/svg+xml",
      "application/xhtml+xml",
      "application/javascript",
      "text/html; charset=utf-8",
      "TEXT/HTML",
    ]) {
      expect(safePreviewMime(m)).toBe("application/octet-stream");
    }
  });
  it("keeps safe raster/pdf/text types", () => {
    expect(safePreviewMime("image/png")).toBe("image/png");
    expect(safePreviewMime("application/pdf")).toBe("application/pdf");
    expect(safePreviewMime("text/plain")).toBe("text/plain");
  });
  it("attachmentDataUri never emits a script-capable data: URI", () => {
    const uri = attachmentDataUri({
      key: "x",
      name: "evil.html",
      mime: "text/html",
      data: b64,
    });
    expect(uri).toBe(`data:application/octet-stream;base64,${b64}`);
    expect(uri).not.toContain("text/html");
  });
});

const HELLO = Buffer.from("Hello PDF").toString("base64"); // "SGVsbG8gUERG"

describe("attachments — .it as a container", () => {
  const src = `title: Application
attach: id | name: passport.pdf | mime: application/pdf | size: 9 | sha256: abc123 | data: ${HELLO}`;

  it("extracts an embedded attachment with its metadata", () => {
    const [a] = extractAttachments(src);
    expect(a).toMatchObject({
      key: "id",
      name: "passport.pdf",
      mime: "application/pdf",
      size: 9,
      sha256: "abc123",
      data: HELLO,
    });
    expect(getAttachment(src, "id")?.name).toBe("passport.pdf");
    expect(hasAttachment(src, "id")).toBe(true);
    expect(hasAttachment(src, "nope")).toBe(false);
  });

  it("produces a data URI for download/preview", () => {
    const a = getAttachment(src, "id")!;
    expect(attachmentDataUri(a)).toBe(`data:application/pdf;base64,${HELLO}`);
  });

  it("add (append + replace-by-key) and remove round-trip", () => {
    let s = addAttachment("title: X", { key: "a", name: "a.txt", mime: "text/plain", size: 3, data: "YWJj" });
    expect(hasAttachment(s, "a")).toBe(true);
    // replace in place (same key)
    s = addAttachment(s, { key: "a", name: "a2.txt", mime: "text/plain", size: 3, data: "ZGVm" });
    expect(extractAttachments(s)).toHaveLength(1);
    expect(getAttachment(s, "a")?.name).toBe("a2.txt");
    // remove
    expect(hasAttachment(removeAttachment(s, "a"), "a")).toBe(false);
  });

  it("supports an external (href) reference instead of embedded bytes", () => {
    const s = addAttachment("title: X", { key: "e", name: "exhibit.pdf", mime: "application/pdf", size: 0, href: "https://x/e.pdf" });
    expect(getAttachment(s, "e")?.href).toBe("https://x/e.pdf");
    expect(hasAttachment(s, "e")).toBe(true);
    expect(attachmentDataUri(getAttachment(s, "e")!)).toBeNull();
  });

  it("rejects invalid base64 and an attachment with neither data nor href", () => {
    expect(() => addAttachment("", { key: "x", name: "x", mime: "text/plain", size: 0, data: "not base64!!" })).toThrow(/base64/i);
    expect(() => addAttachment("", { key: "x", name: "x", mime: "text/plain", size: 0 })).toThrow(/data|href/i);
  });

  it("caps embedded size (prefer href) but allows a deliberate override", () => {
    const big = "A".repeat(2 * 1024 * 1024); // ~1.5 MiB decoded, over the 1 MiB cap
    expect(() => addAttachment("", { key: "b", name: "b", mime: "application/pdf", size: 0, data: big }))
      .toThrow(/cap|href/i);
    // an explicit larger budget is honoured
    expect(() => addAttachment("", { key: "b", name: "b", mime: "application/pdf", size: 0, data: big }, { maxEmbedBytes: 4 * 1024 * 1024 }))
      .not.toThrow();
    // href of any size is always fine (no embed)
    expect(() => addAttachment("", { key: "b", name: "b", mime: "application/pdf", size: 0, href: "https://x/big.pdf" }))
      .not.toThrow();
  });
});

describe("attachment form field — trust gate", () => {
  it("attachment is a recognized field type", () => {
    expect(FORM_FIELD_TYPES).toContain("attachment");
  });

  it("a required attachment is only complete when the bytes are actually attached", () => {
    const form = `meta: | type: form
title: KYC
input: ID scan | key: id | type: attachment | required: yes | value: passport.pdf`;
    // value names a file but no attach: block exists → NOT complete (phantom attachment)
    expect(isFormComplete(form)).toBe(false);
    expect(isTemplate(form)).toBe(true); // not signable yet

    // attach the real bytes → complete + signable
    const withFile = addAttachment(form, { key: "id", name: "passport.pdf", mime: "application/pdf", size: 9, data: HELLO });
    expect(isFormComplete(withFile)).toBe(true);
    expect(isTemplate(withFile)).toBe(false);
    const sealed = sealDocument(withFile, { signer: "Officer" }).source;
    expect(verifyDocument(sealed).intact).toBe(true);
  });

  it("the seal covers the attachment — tampering the bytes breaks verification", () => {
    const form = `meta: | type: form
title: KYC
input: ID scan | key: id | type: attachment | required: yes | value: passport.pdf`;
    const withFile = addAttachment(form, { key: "id", name: "passport.pdf", mime: "application/pdf", size: 9, data: HELLO });
    const sealed = sealDocument(withFile, { signer: "Officer" }).source;
    const tampered = sealed.replace(HELLO, Buffer.from("Evil PDF").toString("base64"));
    expect(verifyDocument(tampered).intact).toBe(false);
  });
});
