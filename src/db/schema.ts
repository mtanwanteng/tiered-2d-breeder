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
    index("tapestry_created_at_idx").on(t.createdAt),
  ]
);
