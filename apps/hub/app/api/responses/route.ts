/**
 * /api/responses — receive a completed FORM submitted by a recipient.
 *
 * This is the Hub side of @dotit/core's submitForm() client (the form-collection
 * endpoint — distinct from /api/submit, which publishes TEMPLATES to the gallery).
 * It implements the documented contract: it re-derives everything from `source`
 * (never trusting the client's answers/hash) and VERIFIES trust before accepting —
 * verifyDocument (the filler's completion seal) and, for two-party forms,
 * verifyFormStructure (the author's structure seal).
 *
 * Storage is left to the operator: wire `storeResponse` to your DB. As shipped it
 * verifies + echoes a verdict, so the contract is runnable end-to-end.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  isForm,
  isFormComplete,
  formAnswers,
  contentHashOf,
  verifyDocument,
  verifyFormStructure,
} from "@dotit/core";

interface Body {
  source?: string;
  formId?: string;
  submittedAt?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const source = body.source;
  if (typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "missing_source" }, { status: 400 });
  }
  if (!isForm(source)) {
    return NextResponse.json({ error: "not_a_form" }, { status: 422 });
  }
  if (!isFormComplete(source)) {
    return NextResponse.json({ error: "form_incomplete" }, { status: 422 });
  }

  // Re-derive trust from the source itself (the record of truth).
  const completion = verifyDocument(source); // filler's seal, if present
  const structure = verifyFormStructure(source); // author's structure seal, if present

  // A two-party form must have an intact structure seal to be accepted.
  if (structure.sealed && !structure.intact) {
    return NextResponse.json(
      { error: "structure_tampered", detail: "The form's structure does not match the author's seal." },
      { status: 422 },
    );
  }
  // If the filler sealed it, that seal must verify.
  if (completion.sealed && !completion.intact) {
    return NextResponse.json(
      { error: "answers_tampered", detail: "The completion seal does not verify." },
      { status: 422 },
    );
  }

  const id = `resp_${contentHashOf(source).replace(/^sha256:/, "").slice(0, 16)}`;
  const record = {
    id,
    formId: body.formId ?? null,
    answers: formAnswers(source),
    hash: contentHashOf(source),
    submittedAt: body.submittedAt ?? new Date().toISOString(),
    trust: {
      structureSealed: structure.sealed,
      structureBy: structure.sealer ?? null,
      completionSealed: completion.sealed,
      intact: (!structure.sealed || structure.intact) && (!completion.sealed || completion.intact),
    },
  };

  // TODO(operator): persist `record` + `source` to your store, e.g.
  //   await storeResponse(record, source)

  return NextResponse.json({ success: true, ...record }, { status: 201 });
}
