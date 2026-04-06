import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Migrations use the direct (unpooled) connection — PgBouncer blocks DDL.
// DATABASE_URL_UNPOOLED is set automatically by Neon's Vercel integration.
// For local dev, set it to your direct connection string (same as DATABASE_URL but without -pooler).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
