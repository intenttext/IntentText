const { MongoClient } = require("mongodb");
const { parseIntentText } = require("@intenttext/core");

const uri =
  "mongodb+srv://emadjumaah1_db_user:99GNzlbJXl8E1u4c@cluster0.z4qzdog.mongodb.net/intenttext-hub?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("intenttext-hub");
  const col = db.collection("templates");
  const all = await col.find({}).project({ slug: 1, source: 1 }).toArray();
  let updated = 0;

  for (const t of all) {
    if (t.source == null) continue;
    const doc = parseIntentText(t.source);
    const hasTrack = doc.blocks.some((b) => b.type === "track");
    const hasSign = doc.blocks.some((b) => b.type === "sign");
    const hasFreeze = doc.blocks.some((b) => b.type === "freeze");
    const signers = doc.blocks
      .filter((b) => b.type === "sign")
      .map((b) => (b.properties && b.properties.role) || "signer");

    if (hasTrack || hasSign || hasFreeze) {
      const trust = {
        tracked: hasTrack,
        frozen: hasFreeze,
        signers: hasSign ? signers : [],
      };
      if (hasFreeze) trust.frozenAt = new Date().toISOString();
      await col.updateOne({ slug: t.slug }, { $set: { trust } });
      updated++;
      console.log("  updated", t.slug, JSON.stringify(trust));
    }
  }

  console.log("\nTotal updated:", updated);
  await client.close();
})();
