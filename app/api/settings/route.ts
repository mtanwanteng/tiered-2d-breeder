import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "../../auth";
import { db } from "../../../src/db";
import { user } from "../../../src/db/schema";

interface SettingsPayload {
  prefersReducedMotion?: boolean;
  prefersTapToCommit?: boolean;
  prefersHighContrast?: boolean;
  roomToneEnabled?: boolean;
}

/** GET /api/settings — returns the active player's saved settings, or
 *  null when not authenticated (anonymous players use localStorage only). */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ settings: null });

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
  return NextResponse.json({ settings: u });
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
