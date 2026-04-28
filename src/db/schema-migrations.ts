// Schema for drizzle-kit generate/migrate — ONLY tables owned by this repo.
// drizzle.config.ts points here so generate never sees bari_generated_map (which lives in the
// shared Neon DB but is owned by the bari-playground repo). App code continues to import from
// schema.ts, which mirrors all tables for full TypeScript coverage.
export {
  user,
  session,
  account,
  verification,
  tapestry,
  eraIdeaTile,
} from "./schema";
