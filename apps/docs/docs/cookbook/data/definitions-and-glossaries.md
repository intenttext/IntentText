---
sidebar_position: 2
title: Definitions & Glossaries
---

# Definitions & Glossaries

## The problem

Legal documents and technical specs define terms — "Provider", "API", "Service Level Agreement" — but these definitions are buried in prose. Nobody can extract all defined terms from a set of contracts without reading every page.

## The solution

`def:` makes defined terms machine-readable. Use them inline (near first use) or grouped (in a formal Definitions section). Query them across documents.

### Inline definitions

Place `def:` near the first use of a term:

```intenttext
title: Cloud Services Agreement

section: Scope

def: Provider | meaning: Acme Corp, a Delaware corporation

text: The Provider shall deliver cloud infrastructure services as described in Exhibit A.

def: SLA | meaning: Service Level Agreement — the uptime and response time commitments in Section 4 | abbr: SLA

text: Provider commits to the SLA terms including 99.9% uptime and < 1 hour incident response.

def: Client | meaning: GlobalTech Industries, a California corporation

text: The Client shall provide access credentials within 5 business days of contract execution.
```

### Grouped definitions (glossary)

Place all definitions in a dedicated section:

```intenttext
section: Definitions

def: API | meaning: Application Programming Interface — a set of protocols for building and integrating software
def: Endpoint | meaning: A specific URL path that accepts requests and returns responses
def: Rate Limit | meaning: Maximum number of API requests allowed per unit of time | abbr: RL
def: SDK | meaning: Software Development Kit — a collection of tools and libraries for building applications | abbr: SDK
def: Webhook | meaning: An HTTP callback triggered by a specific event in the source system
def: Idempotent | meaning: An operation that produces the same result regardless of how many times it is executed
```

### Legal document example

```intenttext
title: Master Services Agreement

section: Definitions

def: Agreement | meaning: This Master Services Agreement including all exhibits and amendments
def: Confidential Information | meaning: Non-public information disclosed by either party, including trade secrets, business plans, and technical data
def: Deliverables | meaning: Work products to be provided by Provider as specified in each Statement of Work
def: Effective Date | meaning: The date on which both parties have executed this Agreement
def: Force Majeure | meaning: Events beyond reasonable control, including natural disasters, war, government action, and epidemic
def: Intellectual Property | meaning: Patents, copyrights, trademarks, trade secrets, and other proprietary rights
def: Term | meaning: The 12-month period beginning on the Effective Date, automatically renewing for successive 12-month periods
```

## Properties

| Property   | Description          |
| ---------- | -------------------- |
| `meaning:` | The definition text  |
| `abbr:`    | Abbreviation/acronym |

## Querying definitions

```bash
# All defined terms across all contracts
intenttext query ./contracts --type def --format table
```

```
File                      Type  Content                   Meaning
contracts/msa.it          def   Confidential Information  Non-public information disclosed by...
contracts/msa.it          def   Deliverables              Work products to be provided by...
contracts/cloud-svc.it    def   Provider                  Acme Corp, a Delaware corporation
contracts/cloud-svc.it    def   SLA                       Service Level Agreement — the uptime...
```

```bash
# Search for a specific term
intenttext query ./contracts --type def --content "Confidential" --format json

# Natural language
intenttext ask ./contracts "What is the definition of Force Majeure?" --format text
```

## Building a master glossary

Query all definitions across your document collection and export:

```bash
# CSV for spreadsheets
intenttext query ./company --type def --format csv > glossary.csv

# JSON for applications
intenttext query ./company --type def --format json > glossary.json
```

## Next steps

- [Cross-Document References](./cross-document-refs) — link definitions across documents
- [Contract](../documents/contract) — complete contract with defined terms
- [Querying Documents](../organizations/querying-documents) — query syntax
