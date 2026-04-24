import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../../src/db";
import { user } from "../../../../src/db/schema";
import { claimAnonymousTapestriesForUser } from "../../../../src/db/tapestries";
import { eq, sql } from "drizzle-orm";
import { getPostHogClient } from "../../../../src/lib/posthog-server";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { anonId } = (await req.json().catch(() => ({}))) as { anonId?: string };
  const now = new Date();

  await db
    .update(user)
    .set({
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(user.id, session.user.id));

  if (anonId) {
    try {
      await db
        .update(user)
        .set({
          // Write once for this user, but let an existing unique anonId stand:
          // a collision means this browser has already been seen before.
          anonId: sql`COALESCE(${user.anonId}, ${anonId})`,
          updatedAt: now,
        })
        .where(eq(user.id, session.user.id));
    } catch (error) {
      if (!isUniqueAnonIdViolation(error)) {
        throw error;
      }
    }

    await claimAnonymousTapestriesForUser({
      anonId,
      userId: session.user.id,
    });
  }

  const ph = getPostHogClient();
  if (ph) {
    ph.capture({ distinctId: session.user.id, event: 'session_started', properties: { app: 'architect' } });
    await ph.shutdown();
  }

  return NextResponse.json({ ok: true });
}

function isUniqueAnonIdViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    cause?: { code?: string; constraint?: string };
  };

  return (
    maybeError.cause?.code === "23505" &&
    maybeError.cause?.constraint === "user_anon_id_unique"
  );
}
