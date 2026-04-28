import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Migrations use the direct (unpooled) connection — PgBouncer blocks DDL.
// DATABASE_URL_UNPOOLED is set automatically by Neon's Vercel integration.
// For local dev, set it to your direct connection string (same as DATABASE_URL but without -pooler).
export default defineConfig({
  // schema-migrations.ts only exports tables owned by this repo — bari_generated_map is
  // intentionally excluded so generate/migrate never tries to CREATE it (it lives in the
  // shared Neon DB but is owned by the sibling bari-playground repo).
  // App code imports from schema.ts for full type coverage.
  schema: "./src/db/schema-migrations.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  // bari_generated_map is owned by the sibling bari-playground repo; exclude it so
  // drizzle-kit generate/migrate never tries to CREATE or DROP it from here.
  tablesFilter: ["!bari_generated_map"],
});
