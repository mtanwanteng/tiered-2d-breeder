import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { getVaultForOwner } from "../../../src/db/era-idea-tiles";

/** GET /api/vault
 *
 * Returns the active player's retired tiles, spine fields + tileName
 * (id, eraName, chapterIndex, runId, retiredAt, bindingStripeColor,
 * chapterColorSeed, tileName, createdAt). Demo build labels each spine
 * with the tile name; emoji / face / narrative / description still stay
 * server-side. `chapterColorSeed` is a precomputed fnv1a hash so the
 * renderer can re-skin to any theme's palette.
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
    const tiles = await getVaultForOwner({ userId, anonId });
    return NextResponse.json({ tiles });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? `: ${err instanceof Error ? err.message : String(err)}`
      : "";
    console.error(`[VLT] read failed${detail}`);
    return NextResponse.json({ error: "Vault read failed" }, { status: 500 });
  }
}
