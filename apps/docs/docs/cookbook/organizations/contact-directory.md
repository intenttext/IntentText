---
sidebar_position: 5
title: Contact Directory
---

# Contact Directory

## The problem

Contact information is buried in Word documents, email signatures, and CRM systems. Nobody can quickly answer "Who is our contact at GlobalTech?" without searching three different tools.

## The solution

Use `contact:` in every `.it` file. Query them to build a contact directory from existing documents — zero extra work.

### Contacts in documents

Contracts already have parties:

```intenttext
title: Service Agreement — Acme Corp & GlobalTech Industries

section: Parties
contact: Sarah Chen | role: General Counsel | email: sarah@acme.co | org: Acme Corp | phone: +1-555-0100
contact: James Miller | role: CFO | email: james@globaltech.co | org: GlobalTech Industries
```

Invoices already have billing contacts:

```intenttext
title: Invoice #2026-0042

section: Parties
contact: Billing Department | role: Accounts Payable | email: ap@globaltech.co | org: GlobalTech Industries
```

HR documents already have employees:

```intenttext
title: Offer Letter — Maria Santos

section: Employee
contact: Maria Santos | role: Senior Engineer | email: maria@acme.co | org: Acme Corp
contact: Lisa Park | role: CTO | email: lisa@acme.co | org: Acme Corp
```

### Build the directory

```bash
# All contacts across the organization
intenttext query ./company --type contact --format table
```

```
File                              Type     Content              Org                   Role               Email
contracts/acme-globaltech.it      contact  Sarah Chen           Acme Corp             General Counsel    sarah@acme.co
contracts/acme-globaltech.it      contact  James Miller         GlobalTech Industries CFO                james@globaltech.co
finance/invoices/2026-042.it      contact  Billing Department   GlobalTech Industries Accounts Payable   ap@globaltech.co
hr/employees/maria-offer.it       contact  Maria Santos         Acme Corp             Senior Engineer    maria@acme.co
hr/employees/maria-offer.it       contact  Lisa Park            Acme Corp             CTO                lisa@acme.co
```

### Export to CSV

```bash
intenttext query ./company --type contact --format csv > contact-directory.csv
```

Open in Excel, Google Sheets, or any spreadsheet tool.

### Filter by organization

```bash
# All contacts at GlobalTech
intenttext query ./company --type contact --content "GlobalTech" --format table

# All internal contacts (Acme Corp)
intenttext query ./company --type contact --content "Acme" --format table
```

### Natural language

```bash
intenttext ask ./company "Who is our contact at GlobalTech?" --format text
```

> Your contacts at GlobalTech Industries are James Miller (CFO, james@globaltech.co) from the service agreement and Billing Department (Accounts Payable, ap@globaltech.co) from invoice #2026-0042.

## The key insight

You're not creating a contact directory as a separate project. You're querying contacts that already exist in your documents. Every `contact:` block in every contract, invoice, and offer letter is automatically part of the directory.

Add `contact:` to the documents you already write. The directory builds itself.

## Next steps

- [Deadline Tracking](./deadline-tracking) — the same pattern for deadlines
- [Querying Documents](./querying-documents) — query syntax reference
- [Contract](../documents/contract) — complete contract with contacts
