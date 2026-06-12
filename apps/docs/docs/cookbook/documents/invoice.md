---
sidebar_position: 1
title: Invoice
---

# Invoice

## The problem

You need a professional invoice that renders to PDF, has queryable line items, and supports payment tracking with deadlines.

## The solution

```intenttext
title: Invoice #2026-0042
summary: Cloud migration services — Phase 1
meta: | type: invoice | domain: finance | track: true

// Print layout
page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | size: 11pt
header: Acme Corp
footer: Invoice #2026-0042 · Page {{page}} of {{pages}}

section: Parties

contact: Acme Corp | role: Provider | email: billing@acme.co | phone: +1-555-0100
contact: GlobalTech Industries | role: Client | email: accounts@globaltech.co | phone: +1-555-0200

section: Line Items

| Description | Qty | Unit Price | Total |
| Cloud infrastructure setup | 1 | $15,000 | $15,000 |
| Data migration (500GB) | 1 | $8,000 | $8,000 |
| Security audit | 2 | $5,000 | $10,000 |
| Training sessions | 4 | $2,000 | $8,000 |

section: Summary

metric: Subtotal | value: 41000 | unit: USD
metric: Tax (8%) | value: 3280 | unit: USD
metric: Total Due | value: 44280 | unit: USD | color: green | weight: bold

section: Payment

deadline: Payment due | date: 2026-04-15 | status: pending
text: Wire transfer to Acme Corp, Account #****4521, Routing #****7890.
text: Late payments subject to 1.5% monthly interest.

track: | by: billing@acme.co
```

## Step by step

1. **Identity** — `title:` and `summary:` identify the invoice. `meta:` with `track: true` enables the trust chain.
2. **Layout** — `page:`, `font:`, `header:`, `footer:` control PDF rendering. `{{page}}` and `{{pages}}` become live page counters in print.
3. **Contacts** — `contact:` blocks for both parties. These are queryable across all your invoices.
4. **Table** — Standard table for line items. For templates, use `each: items` to make this dynamic.
5. **Metrics** — `metric:` blocks for subtotal, tax, total. A plain metric renders as a label→value total row, invoice-style; `Total Due` is emphasized automatically.
6. **Deadline** — `deadline:` with an ISO `date:` (always `YYYY-MM-DD` — the validator warns on locale formats). Color-coded by proximity in rendered output.
7. **Track** — `track:` enables the revision history.

## Arabic invoice (فاتورة)

Arabic keyword aliases ship in core and round-trip exactly as written — `عنوان` is `title`, `أعمدة`/`صف` build tables, `مؤشر` is `metric`, `مهلة` is `deadline`. One query (`type:deadline`) finds payment deadlines across both languages. `dir: rtl` flips the full layout, including tables and footers. Dates stay ISO regardless of language.

```intenttext
عنوان: فاتورة رقم 2026-0118
ملخص: خدمات ترحيل سحابي — المرحلة الأولى
بيانات: | dir: rtl | type: invoice | domain: finance

قسم: الأطراف

جهة: شركة الخليج للتقنية | role: مزود | email: billing@gulftech.qa | phone: +974-4444-0100
جهة: مؤسسة الدوحة للتجارة | role: عميل | email: accounts@dohatrade.qa

قسم: البنود

أعمدة: الوصف | الكمية | سعر الوحدة | الإجمالي
صف: إعداد البنية السحابية | 1 | 15,000 ر.ق | 15,000 ر.ق
صف: ترحيل البيانات | 1 | 8,000 ر.ق | 8,000 ر.ق
صف: جلسات تدريب | 4 | 2,000 ر.ق | 8,000 ر.ق

قسم: الملخص

مؤشر: المجموع الفرعي | value: 31,000 ر.ق
مؤشر: الإجمالي المستحق | value: 31,000 ر.ق

قسم: الدفع

مهلة: استحقاق الدفعة | date: 2026-07-15 | status: pending
نص: التحويل البنكي إلى حساب شركة الخليج للتقنية خلال 30 يومًا من تاريخ الفاتورة.

تتبع: | by: billing@gulftech.qa
```

## Query it

```bash
# Find all pending invoices
dotit query ./invoices --type deadline --status pending --format table

# Find invoices for a specific client
dotit query ./invoices --type contact --content "GlobalTech" --format json

# Total revenue across all invoices
dotit query ./invoices --type metric --content "Total Due" --format csv
```

## Render to PDF

```bash
dotit invoice.it --print --theme corporate
dotit invoice.it --pdf --theme corporate
```

## Template version

Convert this to a reusable template. See [Building Templates](../templates/building-templates).

## Next steps

- [Dynamic Tables](../templates/dynamic-tables) — make line items dynamic with `each:`
- [Sealing Contracts](../trust/sealing-contracts) — add integrity verification
- [Deadline Tracking](../organizations/deadline-tracking) — track payment deadlines across invoices
