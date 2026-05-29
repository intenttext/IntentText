/**
 * seeds/seed.ts — Seed curated templates into the Hub database.
 *
 * Reads every .it file from seeds/templates/<domain>/, parses its meta: block,
 * pairs it with the optional .data.json, and upserts it into MongoDB under the
 * "intenttext" organization account with tier: "curated".
 *
 * Usage:
 *   npx ts-node seeds/seed.ts          # or: npx tsx seeds/seed.ts
 *
 * Requires MONGODB_URI in .env.local (or as an environment variable).
 */

import { config } from "dotenv";
import { MongoClient } from "mongodb";
import { parseIntentText } from "@intenttext/core";
import * as fs from "fs";
import * as path from "path";

config({ path: path.resolve(__dirname, "..", ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set. Add it to .env.local or export it.");
  process.exit(1);
}

const DB_NAME = "intenttext-hub";
const TEMPLATES_DIR = path.resolve(__dirname, "templates");

/** Map domain folder names to legacy Hub categories. */
function mapDomainToCategory(
  domain: string,
): "agent" | "workflow" | "document" {
  switch (domain) {
    case "agent":
      return "agent";
    case "developer":
      return "workflow";
    default:
      return "document";
  }
}

interface TemplateEntry {
  slug: string;
  name: string;
  description: string;
  category: "agent" | "workflow" | "document";
  domain: string;
  tags: string[];
  source: string;
  example_data?: Record<string, unknown>;
  recommended_theme?: string;
}

/** Scan seeds/templates/ and return parsed template entries. */
function loadTemplates(): TemplateEntry[] {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.warn(`Templates directory not found: ${TEMPLATES_DIR}`);
    return [];
  }

  const entries: TemplateEntry[] = [];
  const domains = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((d) => fs.statSync(path.join(TEMPLATES_DIR, d)).isDirectory());

  for (const domain of domains) {
    const domainDir = path.join(TEMPLATES_DIR, domain);
    const itFiles = fs.readdirSync(domainDir).filter((f) => f.endsWith(".it"));

    for (const itFile of itFiles) {
      const slug = itFile.replace(/\.it$/, "");
      const source = fs.readFileSync(path.join(domainDir, itFile), "utf-8");
      const doc = parseIntentText(source);
      const md = doc.metadata as Record<string, unknown> | undefined;

      const meta = (md?.meta as Record<string, string>) || {};
      const title = (md?.title as string) || slug.replace(/-/g, " ");

      let exampleData: Record<string, unknown> | undefined;
      const dataFile = path.join(domainDir, `${slug}.data.json`);
      if (fs.existsSync(dataFile)) {
        exampleData = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      }

      entries.push({
        slug,
        name: title,
        description: String(meta.description || ""),
        category: mapDomainToCategory(domain),
        domain,
        tags: [domain, String(meta.type || "template")],
        source,
        example_data: exampleData,
        recommended_theme: meta.theme ? String(meta.theme) : undefined,
      });
    }
  }

  return entries;
}

async function seed() {
  const templates = loadTemplates();
  console.log(`Found ${templates.length} templates in seeds/templates/`);

  if (templates.length === 0) {
    console.log("Nothing to seed.");
    return;
  }

  console.log("Connecting to MongoDB…");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection("templates");

  // Ensure indexes exist
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ category: 1, status: 1 });
  await collection.createIndex({ tags: 1 });
  await collection.createIndex({ status: 1, createdAt: -1 });
  await collection.createIndex(
    { name: "text", description: "text", tags: "text" },
    { name: "search_index" },
  );
  console.log("Indexes ensured.");

  let inserted = 0;
  let updated = 0;

  for (const tmpl of templates) {
    const document = parseIntentText(tmpl.source);
    const existing = await collection.findOne({ slug: tmpl.slug });

    if (existing) {
      await collection.updateOne(
        { slug: tmpl.slug },
        {
          $set: {
            name: tmpl.name,
            description: tmpl.description,
            category: tmpl.category,
            domain: tmpl.domain,
            tags: tmpl.tags,
            source: tmpl.source,
            example_data: tmpl.example_data,
            recommended_theme: tmpl.recommended_theme,
            document,
            updatedAt: new Date(),
          },
        },
      );
      updated++;
      console.log(`  ~     ${tmpl.slug}`);
      continue;
    }

    await collection.insertOne({
      slug: tmpl.slug,
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      domain: tmpl.domain,
      tags: tmpl.tags,
      source: tmpl.source,
      example_data: tmpl.example_data,
      recommended_theme: tmpl.recommended_theme,
      document,
      author: "intenttext",
      status: "approved",
      tier: "curated",
      autoApproved: true,
      downloads: 0,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inserted++;
    console.log(`  +     ${tmpl.slug}`);
  }

  console.log(`\nDone. ${inserted} inserted, ${updated} updated.`);
  await client.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
