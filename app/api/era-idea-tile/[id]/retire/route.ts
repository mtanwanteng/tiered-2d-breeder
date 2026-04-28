import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { retireEraIdeaTile } from "../../../../../src/db/era-idea-tiles";
import { getPostHogClient } from "../../../../../src/lib/posthog-server";

/** POST /api/era-idea-tile/[id]/retire
 *
 * Retire a bound tile — set retired_at = NOW() and remove it from the
 * library. Spec §2.3, §3.6. Owner-checked: 404 if the row doesn't exist
 * or doesn't belong to this owner. Idempotent — re-retiring is a 200 noop.
 *
 * Body (optional, JSON):
 *   anonId — required when no session is present
 */
interface RetirePayload {
  anonId?: string | null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;
  const payload = (await req.json().catch(() => ({}))) as RetirePayload;
  const anonId = payload.anonId ?? null;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "No owner" }, { status: 400 });
  }

  try {
    const ok = await retireEraIdeaTile({ id, userId, anonId });
    if (!ok) {
      // Either the row doesn't exist, doesn't belong to this owner, or was
      // already retired. We don't differentiate (don't leak existence).
      return NextResponse.json({ ok: true, retired: false });
    }

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId: userId ?? anonId ?? "anonymous",
        event: "era_idea_tile_retired",
        properties: { app: "architect", tile_id: id },
      });
      await ph.shutdown();
    }

    return NextResponse.json({ ok: true, retired: true });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? `: ${err instanceof Error ? err.message : String(err)}`
      : "";
    console.error(`[RTR] retire failed${detail}`);
    return NextResponse.json({ error: "Retire failed" }, { status: 500 });
  }
}
