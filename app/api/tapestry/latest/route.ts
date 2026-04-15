import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getLatestTapestryForOwner } from "../../../../src/db/tapestries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonId = searchParams.get("anonId");

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  const latest = await getLatestTapestryForOwner({ userId, anonId });
  if (!latest) {
    return NextResponse.json({ sharePath: null });
  }

  return NextResponse.json({ sharePath: `/tapestries/${latest.id}` });
}
