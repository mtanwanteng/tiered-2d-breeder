import { NextResponse } from "next/server";
import { getTapestryById } from "../../../../../src/db/tapestries";
import { readTapestryImage } from "../../../../../lib/server/tapestry-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const record = await getTapestryById(id);

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const image = await readTapestryImage({
      bucket: record.bucket,
      key: record.s3Key,
    });
    const body = Buffer.from(image.bytes);

    return new NextResponse(body, {
      headers: {
        "Content-Type": record.mimeType || image.contentType,
        "Cache-Control": "public, max-age=300, s-maxage=300",
        ...(image.etag ? { ETag: image.etag } : {}),
        ...(image.lastModified ? { "Last-Modified": image.lastModified.toUTCString() } : {}),
      },
    });
  } catch (error) {
    console.error("[TAP] Failed to load tapestry image:", error);
    return NextResponse.json({ error: "Image unavailable" }, { status: 503 });
  }
}
