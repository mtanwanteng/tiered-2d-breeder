import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdjacentTapestries, getTapestryAuthorName, getTapestryById } from "../../../src/db/tapestries";
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

  const [imageUrl, authorName, adjacent] = await Promise.all([
    getSignedTapestryUrl(tapestry.bucket, tapestry.s3Key),
    getTapestryAuthorName(tapestry.userId),
    getAdjacentTapestries(tapestry),
  ]);

  const displayAuthor = authorName ? `Crafted by ${authorName}` : "Crafted by Anonymous Architect";
  const displayDate = tapestry.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main
      className="tapestry-page"
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        padding: "32px 20px 48px",
        background:
          "radial-gradient(circle at top, rgba(216, 186, 120, 0.2), transparent 35%), #0f0d0a",
        color: "#f4e8c8",
        fontFamily: "Georgia, serif",
      }}
    >
      <div className="tapestry-content" style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Game header */}
        <p style={{ margin: "0 0 2em", fontSize: "0.7em", opacity: 0.7, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <a href="https://bari.alwayshungrygames.com" className="tapestry-game-link">
            Bari The Architect — A Civilization Creation Game
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "inline-block", marginLeft: 6, verticalAlign: "middle", opacity: 0.7 }}
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </p>

        {/* Title & attribution */}
        <h1 style={{ margin: "0.6em 0 0.2em", fontSize: "clamp(2em, 4dvh, 4em)", fontWeight: "bold" }}>
          {tapestry.eraName} to {tapestry.nextEraName}
        </h1>
        <p style={{ margin: "0 0 1.2em", fontSize: "0.9em", opacity: 0.6, fontStyle: "italic", letterSpacing: "0.03em" }}>
          {displayAuthor} &middot; {displayDate}
        </p>

        {/* Image row: flanking arrows + frame */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Left / prev arrow */}
          <div style={{ flexShrink: 0, width: 44, display: "flex", justifyContent: "center" }}>
            {adjacent.prev && (
              <a href={`/tapestries/${adjacent.prev.id}`} className="tapestry-nav-arrow" aria-label="Previous tapestry">
                ←
              </a>
            )}
          </div>

          {/* Tapestry frame */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
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
              style={{
                display: "block",
                width: "auto",
                height: "auto",
                minWidth: 256,
                minHeight: 256,
                maxWidth: "100%",
                maxHeight: "calc(100vh - 380px)",
                maxHeight: "calc(100dvh - 380px)",
                margin: "0 auto",
              }}
            />
          </div>

          {/* Right / next arrow */}
          <div style={{ flexShrink: 0, width: 44, display: "flex", justifyContent: "center" }}>
            {adjacent.next && (
              <a href={`/tapestries/${adjacent.next.id}`} className="tapestry-nav-arrow" aria-label="Next tapestry">
                →
              </a>
            )}
          </div>
        </div>

        {/* Plaque — inset to sit under the image, not the arrows */}
        <div
          style={{
            margin: "1.2em 60px 0",
            padding: "1.2em 1.8em 1.5em",
            borderRadius: 16,
            border: "1px solid rgba(244, 232, 200, 0.22)",
            borderTop: "2px solid rgba(244, 232, 200, 0.35)",
            background: "rgba(255, 248, 230, 0.03)",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 0.15em", fontSize: "1em", letterSpacing: "0.02em" }}>
            {tapestry.eraName} to {tapestry.nextEraName}
          </p>
          <p style={{ margin: "0 0 0.9em", fontSize: "0.72em", opacity: 0.55, fontStyle: "italic", letterSpacing: "0.03em" }}>
            {displayAuthor} &middot; {displayDate}
          </p>
          <p style={{ margin: 0, lineHeight: 1.7, opacity: 0.8, fontSize: "0.85em" }}>
            {tapestry.narrative}
          </p>
        </div>
      </div>
    </main>
  );
}
