import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "../../auth";
import { db } from "../../../src/db";
import { user } from "../../../src/db/schema";

const VALID_THEMES = new Set(["bibliophile", "curator", "cartographer"]);

interface SettingsPayload {
  prefersReducedMotion?: boolean;
  prefersTapToCommit?: boolean;
  prefersHighContrast?: boolean;
  roomToneEnabled?: boolean;
  themePreference?: string;
}

/** GET /api/settings — returns the active player's saved settings, or
 *  null when not authenticated (anonymous players use localStorage only).
 *  Falls back to the legacy column set on Phase F's themePreference column
 *  if the migration hasn't been applied yet — keeps existing settings
 *  working until 0006_theme_preference.sql runs against the DB. */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ settings: null });

  try {
    const rows = await db
      .select({
        prefersReducedMotion: user.prefersReducedMotion,
        prefersTapToCommit: user.prefersTapToCommit,
        prefersHighContrast: user.prefersHighContrast,
        roomToneEnabled: user.roomToneEnabled,
        themePreference: user.themePreference,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    const u = rows[0];
    if (!u) return NextResponse.json({ settings: null });
    return NextResponse.json({ settings: u });
  } catch (err) {
    // Pre-migration fallback: re-query without theme_preference.
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? `: ${err instanceof Error ? err.message : String(err)}`
      : "";
    console.warn(`[SET] full select failed${detail} — retrying without themePreference`);
    const rows = await db
      .select({
        prefersReducedMotion: user.prefersReducedMotion,
        prefersTapToCommit: user.prefersTapToCommit,
        prefersHighContrast: user.prefersHighContrast,
        roomToneEnabled: user.roomToneEnabled,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    const u = rows[0];
    if (!u) return NextResponse.json({ settings: null });
    return NextResponse.json({ settings: { ...u, themePreference: "bibliophile" } });
  }
}

/** PUT /api/settings — partial update of the active player's settings.
 *  Anonymous players are accepted with a 200 + persisted: false so the
 *  client doesn't have to branch on auth state. */
export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: true, persisted: false });

  const body = (await req.json().catch(() => ({}))) as SettingsPayload;
  const update: Partial<typeof user.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (typeof body.prefersReducedMotion === "boolean") {
    update.prefersReducedMotion = body.prefersReducedMotion;
  }
  if (typeof body.prefersTapToCommit === "boolean") {
    update.prefersTapToCommit = body.prefersTapToCommit;
  }
  if (typeof body.prefersHighContrast === "boolean") {
    update.prefersHighContrast = body.prefersHighContrast;
  }
  if (typeof body.roomToneEnabled === "boolean") {
    update.roomToneEnabled = body.roomToneEnabled;
  }
  if (typeof body.themePreference === "string" && VALID_THEMES.has(body.themePreference)) {
    update.themePreference = body.themePreference;
  }

  try {
    await db.update(user).set(update).where(eq(user.id, session.user.id));
    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? `: ${err instanceof Error ? err.message : String(err)}`
      : "";
    console.error(`[SET] settings save failed${detail}`);
    return NextResponse.json({ error: "Settings save failed" }, { status: 500 });
  }
}
