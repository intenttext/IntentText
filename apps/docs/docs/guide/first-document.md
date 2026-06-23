---
sidebar_position: 4
title: Your First Document
---

# Your First Document

Build a complete, professional invoice from scratch — with contacts, deadlines, metrics, approval, and a seal.

## Start with identity

Every `.it` file starts with what the document _is_:

```intenttext
title: Invoice INV-2026-042 | end: 2026-03-01
summary: Consulting services — Acme Corp — Q2 2026
meta: | type: invoice | currency: USD | ref: INV-2026-042
track: | version: 1.0 | by: Ahmed Al-Rashid
```

`title:` becomes the H1. `summary:` is the subtitle. `meta:` holds machine-readable metadata. `track:` activates change history.

The `end:` property makes a **two-sided row** — content at the line start, value at the
line end. That's the classic "invoice number left, date right" header, and it works on
`title:`, `section:`, `sub:`, and `text:` too:

```intenttext
text: Bill To | end: GlobalTech Inc.
text: Payment Terms | end: Net 30
```

In an Arabic (RTL) document the sides flip automatically. See
[Pipe Properties → Two-sided rows](../reference/pipe-properties#two-sided-rows--end).

## Add the parties

Use `contact:` to declare who's involved:

```intenttext
section: Parties

contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp | phone: +971-4-555-0100
contact: James Miller | role: CFO | email: j.miller@globaltech.co | org: GlobalTech Inc. | phone: +1-415-555-0200
```

Every `contact:` is queryable. Later, you can run `dotit query ./invoices --type contact --org "Acme"` and find every contact across every invoice.

## Add line items

Use a Markdown pipe table with `each:` for dynamic rows:

```intenttext
section: Line Items

| Description | Hours | Rate | Total | each: items |
| {{item.description}} | {{item.hours}} | {{item.rate}} | {{item.total}} |
```

Or for a static invoice, write the rows directly:

```intenttext
section: Line Items

| Description               | Hours | Rate      | Total      |
| Strategy consultation     | 40    | USD 150   | USD 6,000  |
| Technical implementation  | 80    | USD 150   | USD 12,000 |
| Project management        | 40    | USD 150   | USD 6,000  |
```

## Add totals with metrics

```intenttext
section: Summary

metric: Subtotal | value: 24000 | unit: USD
metric: Tax (5%) | value: 1200 | unit: USD
metric: Total Due | value: 25200 | unit: USD | weight: bold
```

`metric:` blocks are queryable and renderable. They show up in dashboards, queries, and reports.

## Set the deadline

```intenttext
deadline: Payment due | date: 2026-04-30 | consequence: Late fee of 1.5% per month | owner: GlobalTech Inc.
```

`deadline:` renders with proximity color coding — green when far away, amber when approaching, red when overdue.

## Approve and seal

```intenttext
approve: Reviewed and approved | by: Sarah Chen | role: Finance Director | at: 2026-03-06
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked | at: 2026-03-06T14:33:00Z
```

Now seal it with the CLI:

```bash
dotit seal invoice.it --signer "Ahmed Al-Rashid" --role "CEO"
```

The document is now frozen. Any **content** edit breaks the hash — restyling and comments don't.

## Verify anytime

```bash
dotit verify invoice.it
```

```
✅  Document intact
    Sealed:   2026-03-06T14:33:00Z
    Signers:  Ahmed Al-Rashid (CEO) ✅
    Hash:     sha256:a1b2c3... ✅ matches
```

## Render it

```bash
dotit invoice.it --html --theme corporate
dotit invoice.it --print --theme corporate
dotit invoice.it --theme corporate --pdf    # writes invoice.pdf next to the source (requires puppeteer)
```

## The same invoice, in Arabic

Every keyword you used above has a registered Arabic alias with identical semantics — and Arabic keywords **round-trip as written**, so the file stays Arabic through parse, edit, and serialize (a sealed Arabic document keeps its hash):

```intenttext
عنوان: فاتورة INV-2026-043
ملخص: خدمات استشارية — شركة الإتقان — الربع الثاني 2026
بيانات: | type: invoice | currency: QAR | dir: rtl

قسم: الأطراف
جهة: أحمد الراشد | role: المدير التنفيذي | email: ahmed@itqan.qa

قسم: البنود
أعمدة: الوصف | الساعات | الإجمالي
صف: استشارات استراتيجية | 40 | 22000 QAR

مؤشر: الإجمالي المستحق | value: 22000 | unit: QAR
مهلة: استحقاق الدفع | date: 2026-07-30 | consequence: غرامة تأخير 1.5% شهريا

اعتماد: تمت المراجعة | by: سارة | role: المدير المالي | at: 2026-06-12
توقيع: أحمد الراشد | role: المدير التنفيذي | at: 2026-06-12T10:00:00Z
```

`type=task`, `type=contact`, and `type=deadline` queries match these blocks exactly as they match the English ones. See the [full Arabic alias table](../reference/keywords/aliases#arabic-aliases).

## The complete file

```intenttext
title: Invoice INV-2026-042 | end: 2026-03-01
summary: Consulting services — Acme Corp — Q2 2026
meta: | type: invoice | currency: USD | ref: INV-2026-042
track: | version: 1.0 | by: Ahmed Al-Rashid

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp
contact: James Miller | role: CFO | email: j.miller@globaltech.co | org: GlobalTech Inc.

section: Line Items
| Description               | Hours | Rate      | Total      |
| Strategy consultation     | 40    | USD 150   | USD 6,000  |
| Technical implementation  | 80    | USD 150   | USD 12,000 |
| Project management        | 40    | USD 150   | USD 6,000  |

section: Summary
metric: Subtotal | value: 24000 | unit: USD
metric: Tax (5%) | value: 1200 | unit: USD
metric: Total Due | value: 25200 | unit: USD

deadline: Payment due | date: 2026-04-30 | consequence: Late fee of 1.5% per month

approve: Reviewed and approved | by: Sarah Chen | role: Finance Director
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked
```

---

**Next:** [Turn this into a reusable template →](./first-template)
