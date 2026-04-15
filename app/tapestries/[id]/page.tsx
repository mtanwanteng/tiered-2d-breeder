import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTapestryById } from "../../../src/db/tapestries";
import { getSignedTapestryUrl } from "../../../lib/server/tapestry-storage";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TapestryPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const tapestry = await getTapestryById(id);

  if (!tapestry) {
    notFound();
  }

  const imageUrl = await getSignedTapestryUrl(tapestry.bucket, tapestry.s3Key);

  return (
    <main
      className="tapestry-page"
      style={{
        minHeight: "100vh",
        padding: "32px 20px 48px",
        background:
          "radial-gradient(circle at top, rgba(216, 186, 120, 0.2), transparent 35%), #0f0d0a",
        color: "#f4e8c8",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <p style={{ margin: 0, opacity: 0.7, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Bari Tapestry
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(2rem, 5vw, 3.8rem)" }}>
          {tapestry.eraName} to {tapestry.nextEraName}
        </h1>
        <p style={{ margin: "0 0 24px", maxWidth: 720, lineHeight: 1.6, opacity: 0.9 }}>
          {tapestry.narrative}
        </p>
        <div
          style={{
            border: "1px solid rgba(244, 232, 200, 0.18)",
            background: "rgba(255, 248, 230, 0.04)",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
          }}
        >
          <img
            src={imageUrl}
            alt={`Tapestry commemorating ${tapestry.eraName}`}
            style={{ display: "block", width: "100%", height: "auto", borderRadius: 16 }}
          />
        </div>
      </div>
    </main>
  );
}
