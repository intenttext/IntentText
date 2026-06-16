import { describe, it, expect } from "vitest";
import {
  extractAttachments,
  getAttachment,
  hasAttachment,
  addAttachment,
  removeAttachment,
  attachmentDataUri,
  isFormComplete,
  isTemplate,
  sealDocument,
  verifyDocument,
  FORM_FIELD_TYPES,
} from "../src/index";

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
