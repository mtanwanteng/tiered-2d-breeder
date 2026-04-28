// Schema managed by Drizzle.
// Better Auth tables (user, session, account, verification) below.
// To regenerate after DB is connected: npx auth@latest generate --output src/db/schema.ts

import { pgTable, text, boolean, timestamp, index, uniqueIndex, integer, jsonb } from "drizzle-orm/pg-core";
import type { TapestryGameData } from "../types";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  // Pre-auth anonymous ID from localStorage — used for PostHog merge debugging
  // and conversion funnel queries. Set on first OAuth sign-in if available.
  anonId: text("anon_id").unique(),
  // Updated on every session creation — enables DAU/WAU/MAU, churn, D1/D7/D30 cohorts
  lastActiveAt: timestamp("last_active_at"),
  // Bibliophile settings (Phase 7). Anonymous players store the same flags
  // in localStorage; on first sign-in the auth claim flow merges them onto
  // the user row.
  seenFirstRetirementSpeech: boolean("seen_first_retirement_speech")
    .$defaultFn(() => false)
    .notNull(),
  prefersReducedMotion: boolean("prefers_reduced_motion")
    .$defaultFn(() => false)
    .notNull(),
  prefersTapToCommit: boolean("prefers_tap_to_commit")
    .$defaultFn(() => false)
    .notNull(),
  prefersHighContrast: boolean("prefers_high_contrast")
    .$defaultFn(() => false)
    .notNull(),
  roomToneEnabled: boolean("room_tone_enabled")
    .$defaultFn(() => true)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_provider_account_idx").on(t.providerId, t.accountId),
  ]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

export const tapestry = pgTable(
  "tapestry",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    runId: text("run_id"),
    bucket: text("bucket").notNull(),
    s3Key: text("s3_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    eraName: text("era_name").notNull(),
    nextEraName: text("next_era_name").notNull(),
    narrative: text("narrative").notNull(),
    visibility: text("visibility").notNull().$defaultFn(() => "unlisted"),
    gameData: jsonb("game_data").$type<TapestryGameData | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("tapestry_user_id_idx").on(t.userId),
    index("tapestry_anon_id_idx").on(t.anonId),
    index("tapestry_run_id_idx").on(t.runId),
    index("tapestry_created_at_idx").on(t.createdAt),
  ]
);

// One row per "bound tile" — the chapter-end idea pick. The player drops an idea tile into
// the era-summary slot before clicking Next Age (replaced by hold-to-commit in Phase 2);
// that pick is persisted here. anonId-only rows are claimed onto a userId by the same
// record-activity flow that claims tapestries on first sign-in.
//
// Bibliophile additions (Phase 0):
//   retired_at — set when the player retires the tile (removes it from the 24-slot library
//                and into the vault). NULL means still on the shelf.
//   chapter_index — cached order index of the era so library queries don't depend on era
//                   name string matching.
//   binding_stripe_color — cached deterministic chromatic stripe color (hashed from
//                          era_id × tile_id × run_id at write-time) so library rendering
//                          doesn't recompute the hash.
export const eraIdeaTile = pgTable(
  "era_idea_tile",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    runId: text("run_id"),
    eraName: text("era_name").notNull(),
    chapterIndex: integer("chapter_index"),
    tileName: text("tile_name").notNull(),
    tileTier: integer("tile_tier").notNull(),
    tileEmoji: text("tile_emoji").notNull(),
    tileColor: text("tile_color").notNull(),
    tileDescription: text("tile_description"),
    tileNarrative: text("tile_narrative"),
    bindingStripeColor: text("binding_stripe_color"),
    retiredAt: timestamp("retired_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("era_idea_tile_user_id_idx").on(t.userId),
    index("era_idea_tile_anon_id_idx").on(t.anonId),
    index("era_idea_tile_run_id_idx").on(t.runId),
    index("era_idea_tile_created_at_idx").on(t.createdAt),
    index("era_idea_tile_retired_at_idx").on(t.retiredAt),
  ]
);

// --- bari-playground-owned ---
// Mirrored from ../bari-playground/src/db/schema.ts. Both repos keep every table in
// the shared Neon DB defined in their schema.ts (no drizzle `tablesFilter`), so
// `drizzle-kit push` from either project is non-destructive. Keep this block in sync
// with bari's schema.ts when the definition changes there.

export const bariGeneratedMap = pgTable(
  "bari_generated_map",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    eraName: text("era_name").notNull(),
    bucket: text("bucket").notNull(),
    s3Key: text("s3_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    prompt: text("prompt").notNull(),
    spatialSnapshot: jsonb("spatial_snapshot").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("bari_generated_map_user_id_idx").on(t.userId),
    index("bari_generated_map_anon_id_idx").on(t.anonId),
    index("bari_generated_map_created_at_idx").on(t.createdAt),
  ]
);
