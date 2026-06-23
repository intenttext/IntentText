---
sidebar_position: 9
title: Localized (Arabic) Keywords
---

# Localized (Arabic) Keywords

IntentText has **no Latin synonym aliases**. There is no `note:` that secretly means `text:`,
no `columns:` that secretly means `headers:`, no `warning:` keyword. The only reserved words
are the [41 canonical English keywords](../keywords), the [namespaced extension keywords](../keywords#extension-keywords)
(`x-writer:`/`x-doc:`/`x-agent:`/`x-form:`/`x-layout:`/`x-exp:`), and the **33 Arabic
localized keyword names** documented on this page. Every other word you write is reliably
**your own custom block** — collision-free, never silently reinterpreted as something else.

The Arabic names below are **first-class localized keyword names**, not aliases. `عنوان:` *is*
a way to write `title:` — it resolves to the same canonical keyword, gets the same rendering,
the same query semantics, the same seal coverage. They exist so you can author a whole document
in Arabic and still get full canonical behavior (task tracking, table totals, contact cards,
deadline logic, signatures) and a single cross-language query (`type=task` finds tasks in any
language).

## Zero aliases — every other word is custom

This is the whole point of the open vocabulary: because there are **no synonym aliases**, a word
is either one of the reserved sets above or it is **yours**. `party:`, `milestone:`, `status:`,
`note:`, `item:`, `requirement:`, `due:`, `rule:`, `kpi:`, `columns:`, `body:`, `warning:` — none
of these is reserved. Each parses as a typed, queryable `custom` block that keeps the keyword you
wrote, verbatim. Nothing is reinterpreted behind your back.

```intenttext
// Each of these is your own custom block — distinct, queryable by keyword, never an alias:
note: An internal note for reviewers.
milestone: Phase 1 complete | date: 2026-08-01
party: Acme LLC | role: Provider
```

Query a custom keyword by **name** — `keyword=milestone`, `keyword=party` — since every custom
block's `type` is literally `custom`. See [Custom keywords](../keywords#extension-keywords) and the
[Query reference](../query).

## Write a document in Arabic

The canonical keywords ship with **33 registered Arabic localized names**. An Arabic document gets
full canonical semantics, and the serializer re-emits keywords **as written** — so Arabic
documents stay Arabic through a parse → serialize cycle, and a sealed Arabic document keeps its
hash.

```intenttext
عنوان: عرض سعر — تأثيث المكتب الرئيسي
ملخص: شركة الإتقان للتجارة — صالح حتى 2026-07-15

قسم: البنود
أعمدة: الوصف | الكمية | السعر | الإجمالي
صف: كرسي مكتب تنفيذي | 12 | 850 QAR | 10,200 QAR
مؤشر: الإجمالي المستحق | value: 10,200 QAR

جهة: شركة الإتقان للتجارة | email: sales@itqan.qa | vat: VAT-300123
مهمة: اعتماد العرض | owner: أحمد | due: 2026-06-20
مهلة: انتهاء صلاحية العرض | date: 2026-07-15 | consequence: يلزم عرض جديد
```

Every line above is a fully typed block: `عنوان` is a `title`, `مهمة` is a `task` (queryable with
`type=task due<2026-07-01`), `صف` is a table `row`, `جهة` is a `contact`, `مهلة` is a `deadline`.

**Arabic keywords round-trip as written.** Serialization re-emits the localized name the author
used, so an Arabic document stays Arabic through a parse → serialize cycle — and a sealed Arabic
document keeps its hash. Table keywords (`أعمدة`/`صف`) are preserved too.

## The 33 Arabic localized keyword names

Each Arabic name resolves to the canonical keyword shown beside it. Two Arabic names
(`جهة` and `تواصل`) both localize `contact:`, which is why 33 names cover 32 distinct
targets.

| Arabic     | Canonical    | | Arabic     | Canonical   |
| ---------- | ------------ |-| ---------- | ----------- |
| `عنوان:`   | `title:`     | | `تتبع:`    | `track:`    |
| `ملخص:`    | `summary:`   | | `اعتماد:`  | `approve:`  |
| `بيانات:`  | `meta:`      | | `توقيع:`   | `sign:`     |
| `قسم:`     | `section:`   | | `تجميد:`   | `freeze:`   |
| `فرعي:`    | `sub:`       | | `تعديل:`   | `amendment:`|
| `نص:`      | `text:`      | | `صفحة:`    | `page:`     |
| `تنبيه:`   | `info:`      | | `ترويسة:`  | `header:`   |
| `اقتباس:`  | `quote:`     | | `تذييل:`   | `footer:`   |
| `استشهاد:` | `cite:`      | | `علامة:`   | `watermark:`|
| `شيفرة:`   | `code:`      | | `نمط:`     | `style:`    |
| `صورة:`    | `image:`     | | `فاصل:`    | `break:`    |
| `رابط:`    | `link:`      | | `مهلة:`    | `deadline:` |
| `مهمة:`    | `task:`      | | `جهة:`     | `contact:`  |
| `منجز:`    | `done:`      | | `تواصل:`   | `contact:`  |
| `أعمدة:`   | `headers:`   | | `تعريف:`   | `def:`      |
| `صف:`      | `row:`       | | `مرجع:`    | `ref:`      |
| `مؤشر:`    | `metric:`    | |            |             |

Beyond these localized names, **keywords and property keys are Unicode words** — any Arabic (or
any-script) domain keyword parses as a typed `custom` block: `مصروف: كراسي مكتب | المورد: ايكيا | فئة: أثاث`
is queryable by keyword, by Arabic property (`فئة=أثاث`), and by ISO date range. Pair Arabic
documents with `meta: | dir: rtl` for full right-to-left rendering.

---

## Callout variants — set with `type:`, not a keyword

`info:` is the callout block. There is **no** `warning:`/`danger:`/`tip:`/`success:` keyword —
you choose the variant with the `type:` **property**:

```intenttext
info: This contract expires in 14 days. Renewal required. | type: warning
info: Deleting this record is irreversible. | type: danger
info: Use dotit query to find all deadlines across your folder. | type: tip
info: Migration completed — 12,450 records transferred. | type: success
```

`type:` accepts `info` (default), `warning`, `danger`, `tip`, `success`. A bare `warning:` line is
not a callout — it parses as a `custom` block named `warning` (your own keyword).

---

## Localized keywords in the parsed model — and on the way back out

A parsed block always carries the **canonical** type, with the localized name preserved in
`keywordAlias`, and `documentToSource()` re-emits it as written (`عنوان:` stays `عنوان:`):

```json
{
  "type": "title",
  "keywordAlias": "عنوان",
  "content": "عرض سعر"
}
```

That keeps round-trips stable and a sealed document's hash intact through a parse → serialize
cycle. A `type=task` query matches `task:` and `مهمة:` blocks alike — but **not** any custom
keyword you invented (those are matched by `keyword=<word>`).

```bash
# Same canonical type, written in two languages — one query finds both:
dotit query . --type task
```
