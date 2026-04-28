import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { getLibraryForOwner } from "../../../src/db/era-idea-tiles";

/** GET /api/library
 *
 * Returns the active player's 24 most-recent non-retired bound tiles
 * (the "library shelf" in spec §3.5). Authenticated players are matched by
 * userId; anonymous players match anon_id with user_id IS NULL.
 *
 * Query params:
 *   anonId — required when no session is present
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;
  const anonId = new URL(req.url).searchParams.get("anonId");

  if (!userId && !anonId) {
    return NextResponse.json({ tiles: [] });
  }

  try {
    const tiles = await getLibraryForOwner({ userId, anonId });
    return NextResponse.json({ tiles });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? `: ${err instanceof Error ? err.message : String(err)}`
      : "";
    console.error(`[LIB] read failed${detail}`);
    return NextResponse.json({ error: "Library read failed" }, { status: 500 });
  }
}
