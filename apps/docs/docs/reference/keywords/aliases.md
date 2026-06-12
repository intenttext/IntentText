---
sidebar_position: 9
title: Aliases
---

# Keyword Aliases

Many IntentText keywords have **aliases** — alternative names that resolve to the same canonical form. Use whichever reads best in your document. There is no behavioral difference between a canonical keyword and its alias.

## How aliases work

```intenttext
// These are all identical:
text: Payment is due within 30 days.
note: Payment is due within 30 days.
body: Payment is due within 30 days.
paragraph: Payment is due within 30 days.
```

The parser resolves every alias to its canonical keyword — the parsed block has the canonical `type`, so queries and the API always see canonical names. The keyword you actually wrote is kept on the block (`keywordAlias`), and the serializer **re-emits it as written**: `abstract:` stays `abstract:`, `عنوان:` stays `عنوان:`. Round-trips never rewrite your keywords.

---

## Arabic aliases

The canonical keywords ship with **33 registered Arabic aliases**. An Arabic document gets full canonical semantics — task tracking, table totals, contact cards, deadline logic, signatures — and one query (`type=task`) finds tasks across languages.

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

Every line above is a fully typed block: `عنوان` is a `title`, `مهمة` is a `task` (queryable with `type=task due<2026-07-01`), `صف` is a table `row`, `جهة` is a `contact`.

**Arabic keywords round-trip as written.** Serialization re-emits the alias the author used, so an Arabic document stays Arabic through a parse → serialize cycle — and a sealed Arabic document keeps its hash. Table keywords (`أعمدة`/`صف`) are preserved too.

### The full Arabic alias table

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
| `أعمدة:`   | `columns:`   | | `تعريف:`   | `def:`      |
| `صف:`      | `row:`       | | `مرجع:`    | `ref:`      |
| `مؤشر:`    | `metric:`    | |            |             |

Beyond the registered aliases, **keywords and property keys are Unicode words** — any Arabic (or any-script) domain keyword parses as a typed `custom` block: `مصروف: كراسي مكتب | المورد: ايكيا | فئة: أثاث` is queryable by keyword, by Arabic property (`فئة=أثاث`), and by ISO date range. Pair Arabic documents with `meta: | dir: rtl` for full right-to-left rendering.

---

## Callout aliases

`info:` is the canonical callout block. The four variant forms — `warning:`, `danger:`, `tip:`, and `success:` — are aliases that set the callout's `type` property automatically.

```intenttext
// Canonical form
info: Aliases are supported across all categories. | type: warning

// Equivalent — both produce { type: "info", properties: { type: "warning" } }
warning: Aliases are supported across all categories.
```

| Alias      | Equivalent canonical form    |
| ---------- | ---------------------------- |
| `warning:` | `info: ... \| type: warning` |
| `danger:`  | `info: ... \| type: danger`  |
| `tip:`     | `info: ... \| type: tip`     |
| `success:` | `info: ... \| type: success` |

Secondary callout aliases:

| Alias          | Resolves to              |
| -------------- | ------------------------ |
| `alert:`       | `info: \| type: warning` |
| `caution:`     | `info: \| type: warning` |
| `hint:`        | `info: \| type: tip`     |
| `advice:`      | `info: \| type: tip`     |
| `critical:`    | `info: \| type: danger`  |
| `destructive:` | `info: \| type: danger`  |

---

## Complete alias table

### Document Identity

| Canonical  | Aliases               |
| ---------- | --------------------- |
| `title:`   | `عنوان:`, `h1:`       |
| `summary:` | `ملخص:`, `abstract:`  |
| `meta:`    | `بيانات:`             |
| `context:` | —                     |

### Structure

| Canonical  | Aliases                                |
| ---------- | -------------------------------------- |
| `section:` | `قسم:`, `h2:`, `heading:`, `chapter:`  |
| `sub:`     | `فرعي:`, `h3:`, `subheading:`          |
| `toc:`     | —                                      |

### Content

| Canonical | Aliases                                                                                      |
| --------- | -------------------------------------------------------------------------------------------- |
| `text:`   | `نص:`, `note:`, `body:`, `content:`, `paragraph:`, `p:`                                      |
| `info:`   | `تنبيه:`, `warning:`, `danger:`, `tip:`, `success:` (see [Callout aliases](#callout-aliases)) |
| `quote:`  | `اقتباس:`, `blockquote:`, `excerpt:`, `pullquote:`                                           |
| `cite:`   | `استشهاد:`, `citation:`, `source:`, `reference:`                                             |
| `code:`   | `شيفرة:`, `snippet:`                                                                         |
| `image:`  | `صورة:`, `img:`, `photo:`, `picture:`                                                        |
| `link:`   | `رابط:`, `url:`, `href:`                                                                     |

### Tasks

| Canonical | Aliases                                        |
| --------- | ---------------------------------------------- |
| `task:`   | `مهمة:`, `check:`, `todo:`, `action:`, `item:` |
| `done:`   | `منجز:`, `completed:`, `finished:`             |
| `ask:`    | `question:`                                    |

### Data

| Canonical  | Aliases                                   |
| ---------- | ----------------------------------------- |
| `columns:` | `أعمدة:`, `headers:`                      |
| `row:`     | `صف:`                                     |
| `metric:`  | `مؤشر:`, `kpi:`, `measure:`, `indicator:` |

### Agentic Workflow

| Canonical   | Aliases                                          |
| ----------- | ------------------------------------------------ |
| `step:`     | `run:`                                           |
| `decision:` | `if:`                                            |
| `gate:`     | —                                                |
| `trigger:`  | `on:`                                            |
| `result:`   | —                                                |
| `policy:`   | `rule:`, `constraint:`, `guard:`, `requirement:` |
| `audit:`    | `log:`                                           |

### Trust

| Canonical    | Aliases                       |
| ------------ | ----------------------------- |
| `track:`     | `تتبع:`                       |
| `approve:`   | `اعتماد:`                     |
| `sign:`      | `توقيع:`, `sig:`              |
| `freeze:`    | `تجميد:`, `lock:`             |
| `amendment:` | `تعديل:`, `amend:`, `change:` |

### Layout

| Canonical    | Aliases    |
| ------------ | ---------- |
| `page:`      | `صفحة:`    |
| `header:`    | `ترويسة:`  |
| `footer:`    | `تذييل:`   |
| `watermark:` | `علامة:`   |
| `style:`     | `نمط:`     |
| `break:`     | `فاصل:`    |

---

## Extension keyword aliases

A few extension keywords also have registered aliases that resolve to the extension form:

| Extension keyword | Aliases                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `deadline`        | `مهلة:`, `due:`, `milestone:`, `by:`, `due-date:`                  |
| `contact`         | `جهة:`, `تواصل:`, `person:`, `party:`, `entity:`                   |
| `def`             | `تعريف:`, `define:`, `term:`, `glossary:`                          |
| `ref`             | `مرجع:`, `references:`, `see:`, `related:`, `xref:`                |
| `figure`          | `fig:`, `diagram:`, `chart:`, `illustration:`, `visual:`           |
| `signline`        | `signature-line:`, `sign-here:`                                    |

Namespaced forms (`x-ns: type`) do not take aliases — the full `x-ns: type` form is always used. See [Extension Keywords →](./extensions).

---

## Using aliases in queries

Queries normalize aliases automatically:

```bash
# These return the same results:
dotit query . --type text
dotit query . --type note
dotit query . --type body
```

A `type=task` query matches `task:`, `todo:`, and `مهمة:` blocks alike.

## Aliases in the parsed model — and on the way back out

The parsed block always carries the **canonical** type, with the written form preserved in `keywordAlias`:

```json
{
  "type": "text",
  "keywordAlias": "note",
  "content": "Payment is due within 30 days."
}
```

`documentToSource()` re-emits the keyword as written (`note:`, `عنوان:`, `abstract:`), so round-trips are stable — and a sealed document keeps its hash through a parse → serialize cycle.
