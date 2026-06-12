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

Arabic documents use the `جهة` (or `تواصل`) alias — both resolve to the canonical `contact` type, round-trip as written, and land in the same directory query as English contacts:

```intenttext
عنوان: عقد توريد — شركة الخليج للتقنية

قسم: الأطراف
جهة: سارة المنصوري | role: المستشار القانوني | email: sara@gulftech.qa | org: شركة الخليج للتقنية | phone: +974-4444-0100
تواصل: خالد العبدالله | role: المدير المالي | email: khalid@dohatrade.qa | org: مؤسسة الدوحة للتجارة
```

### Build the directory

```bash
# All contacts across the organization
dotit query ./company --type contact --format table
```

```
File                              Type     Content              Org                   Role               Email
contracts/acme-globaltech.it      contact  Sarah Chen           Acme Corp             General Counsel    sarah@acme.co
contracts/acme-globaltech.it      contact  James Miller         GlobalTech Industries CFO                james@globaltech.co
contracts/gulftech-supply.it      contact  سارة المنصوري         شركة الخليج للتقنية    المستشار القانوني   sara@gulftech.qa
finance/invoices/2026-042.it      contact  Billing Department   GlobalTech Industries Accounts Payable   ap@globaltech.co
hr/employees/maria-offer.it       contact  Maria Santos         Acme Corp             Senior Engineer    maria@acme.co
hr/employees/maria-offer.it       contact  Lisa Park            Acme Corp             CTO                lisa@acme.co
```

Arabic and English contacts compose into one directory because `جهة` and `تواصل` resolve to the same canonical `contact` type.

### Export to CSV

```bash
dotit query ./company --type contact --format csv > contact-directory.csv
```

Open in Excel, Google Sheets, or any spreadsheet tool.

### Filter by organization

```bash
# All contacts at GlobalTech
dotit query ./company --type contact --content "GlobalTech" --format table

# All internal contacts (Acme Corp)
dotit query ./company --type contact --content "Acme" --format table
```

### Natural language

```bash
dotit ask ./company "Who is our contact at GlobalTech?" --format text
```

> Your contacts at GlobalTech Industries are James Miller (CFO, james@globaltech.co) from the service agreement and Billing Department (Accounts Payable, ap@globaltech.co) from invoice #2026-0042.

## The key insight

You're not creating a contact directory as a separate project. You're querying contacts that already exist in your documents. Every `contact:` block in every contract, invoice, and offer letter is automatically part of the directory.

Add `contact:` to the documents you already write. The directory builds itself.

## Next steps

- [Deadline Tracking](./deadline-tracking) — the same pattern for deadlines
- [Querying Documents](./querying-documents) — query syntax reference
- [Contract](../documents/contract) — complete contract with contacts
