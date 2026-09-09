import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(join(__dirname, "..", "schema.sql"), "utf8");

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql(stmt);
  console.log("OK:", stmt.split("\n")[0].slice(0, 60));
}

console.log("Database schema is up to date.");
