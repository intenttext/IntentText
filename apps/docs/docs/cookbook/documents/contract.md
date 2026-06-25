---
sidebar_position: 2
title: Contract
---

# Contract

## The problem

You need a verifiable contract with defined terms, an approval trail, digital and physical signatures, and the ability to formally amend it after signing.

## The solution

```intenttext
title: Service Agreement — Acme Corp & GlobalTech Industries
summary: Annual IT support and cloud infrastructure management
meta: | type: contract | domain: legal | track: true

page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | size: 11pt
header: CONFIDENTIAL
footer: Service Agreement — Page {{page}} of {{pages}}

section: Definitions

def: Provider | meaning: Acme Corp, a Delaware corporation
def: Client | meaning: GlobalTech Industries, a California corporation
def: Services | meaning: IT support, cloud infrastructure management, and security monitoring as described in Section: Scope
def: Term | meaning: The 12-month period beginning on the Effective Date

section: Parties

contact: Acme Corp | role: Provider | email: legal@acme.co | org: Acme Corp
contact: GlobalTech Industries | role: Client | email: contracts@globaltech.co | org: GlobalTech Industries

section: Scope

Provider shall deliver the Services to Client for the duration of the Term, including:
1. 24/7 infrastructure monitoring
2. Monthly security audits
3. Quarterly performance reviews
4. On-call incident response (< 1 hour SLA)

section: Timeline

deadline: Contract effective | date: 2026-04-01 | status: confirmed
deadline: Q1 review | date: 2026-07-01 | status: pending
deadline: Q2 review | date: 2026-10-01 | status: pending
deadline: Contract renewal | date: 2027-03-31 | status: pending

section: Payment

metric: Monthly retainer | value: 15000 | unit: USD
metric: Annual value | value: 180000 | unit: USD | weight: bold
deadline: Payment due | date: 2026-04-15 | status: pending
Payment due within 15 days of each monthly invoice.

section: Signatures

approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-20
approve: Finance approved | by: James Miller | role: CFO | at: 2026-03-21

sign: Ahmed Al-Rashid | role: CEO, Acme Corp | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4 | spec: 4
sign: Maria Santos | role: COO, GlobalTech | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8 | spec: 4

// Physical signature lines for the printed version
signline: Ahmed Al-Rashid | role: CEO, Acme Corp | label: Provider Signature
signline: | label: Date | width: 30%

signline: Maria Santos | role: COO, GlobalTech | label: Client Signature
signline: | label: Date | width: 30%

freeze: | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2 | spec: 4 | status: locked

track: | by: legal@acme.co
```

## Step by step

1. **Definitions** — `def:` creates queryable, machine-readable defined terms. Every reference to "Provider" or "Client" has a formal definition.
2. **Contacts** — `contact:` for both parties. Query across all contracts to find every deal with a specific company.
3. **Deadlines** — `deadline:` for every milestone. Query to find upcoming deadlines across all contracts.
4. **Metrics** — `metric:` for financial terms. Queryable and renderable.
5. **Approvals** — `approve:` records who reviewed and when. Multiple approvals are standard: legal, finance, management.
6. **Digital signatures** — `sign:` with content hashes. Machine-verifiable.
7. **Physical signatures** — `signline:` creates lines on the printed page for wet-ink signatures.
8. **Freeze** — `freeze:` seals the document (`spec: 4`). Any content edit invalidates the hash; restyling, re-theming, and comments do not.

## Arabic services contract (عقد)

The same contract pattern works fully in Arabic. The 33 Arabic keywords in core (`قسم`→section, `تعريف`→def, `جهة`→contact, `مهلة`→deadline, `اعتماد`→approve, …) are first-class localized keyword names: they carry full canonical semantics and are serialized back exactly as written, so an Arabic contract stays Arabic through every parse → edit → save cycle. Dates remain ISO (`YYYY-MM-DD`) regardless of language.

```intenttext
عنوان: عقد تقديم خدمات — شركة الخليج للتقنية ومؤسسة الدوحة للتجارة
ملخص: دعم تقني سنوي وإدارة البنية السحابية
بيانات: | dir: rtl | type: contract | domain: legal

قسم: التعريفات

تعريف: المزود | meaning: شركة الخليج للتقنية، شركة مسجلة في دولة قطر
تعريف: العميل | meaning: مؤسسة الدوحة للتجارة، مؤسسة مسجلة في دولة قطر
تعريف: الخدمات | meaning: الدعم التقني وإدارة البنية السحابية والمراقبة الأمنية

قسم: الأطراف

جهة: شركة الخليج للتقنية | role: مزود | email: legal@gulftech.qa
جهة: مؤسسة الدوحة للتجارة | role: عميل | email: contracts@dohatrade.qa

قسم: نطاق العمل

نص: يلتزم المزود بتقديم الخدمات للعميل طوال مدة العقد، وتشمل المراقبة على مدار الساعة والتدقيق الأمني الشهري ومراجعات الأداء الربعية.

قسم: الجدول الزمني

مهلة: سريان العقد | date: 2026-07-01 | status: confirmed
مهلة: المراجعة الربعية الأولى | date: 2026-10-01 | status: pending
مهلة: تجديد العقد | date: 2027-06-30 | status: pending

قسم: الدفع

مؤشر: الأتعاب الشهرية | value: 55000 | unit: QAR
مهلة: استحقاق الدفعة الأولى | date: 2026-07-15 | status: pending
نص: تُسدد الدفعات خلال 15 يومًا من تاريخ كل فاتورة شهرية.

قسم: التوقيعات

اعتماد: اكتملت المراجعة القانونية | by: سارة المنصوري | role: المستشار القانوني | at: 2026-06-20
اعتماد: موافقة الإدارة المالية | by: خالد العبدالله | role: المدير المالي | at: 2026-06-21
```

Seal it the same way — `sealDocument()` (or `dotit seal`) appends the canonical `sign:` and `freeze:` lines, which are excluded from the hash. The Arabic `اعتماد:` (approve) lines are part of the hashed body, exactly like English `approve:` lines, and one query (`type:deadline` or `type:contact`) spans Arabic and English contracts alike.

## Seal and verify

```bash
# Seal the contract (adds sign: and freeze: automatically)
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO, Acme Corp"

# Verify integrity
dotit verify contract.it
# ✓ Document sealed at 2026-03-22T15:00:00Z
# ✓ Hash valid: sha256:f9a0b1c2
# ✓ 2 signatures, 2 approvals
```

## Amend after sealing

Six months later, payment terms need to change:

```bash
dotit amend contract.it \
  --section "Payment" \
  --was "Payment due within 15 days" \
  --now "Payment due within 30 days" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

The contract now has:

```intenttext
// Original content preserved, seal intact

amendment: Payment terms updated | section: Payment | was: Payment due within 15 days | now: Payment due within 30 days | ref: Amendment #1 | by: Ahmed Al-Rashid | at: 2026-09-15
```

Verify after amendment:

```bash
dotit verify contract.it
# ✓ Original seal valid: sha256:f9a0b1c2
# ⚡ 1 amendment applied
#   Amendment #1: Payment terms updated (2026-09-15)
```

## Query it

```bash
# All contracts with GlobalTech
dotit query ./contracts --type contact --content "GlobalTech" --format table

# Upcoming deadlines
dotit query ./contracts --type deadline --format table

# All defined terms
dotit query ./contracts --type def --format json

# All amendments
dotit query ./contracts --type amendment --format table
```

## Next steps

- [Amending Frozen Documents](../trust/amending-frozen-docs) — the full amendment workflow
- [Approval Workflow](../trust/approval-workflow) — detailed approve → sign → freeze flow
- [Contact Directory](../organizations/contact-directory) — build a directory from contract contacts
