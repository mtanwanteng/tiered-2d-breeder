export default function TapestryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body { overflow: auto !important; }
        .tapestry-page, .tapestry-page * { user-select: text !important; }
        .tapestry-page { min-height: 100dvh; }
        .tapestry-img { max-height: calc(100dvh - 380px); }
        .tapestry-lightbox-img { max-height: 95dvh; }
        .tapestry-content {
          font-size: clamp(11px, 1.7dvh, 16px);
        }
        .tapestry-nav-arrow {
          color: #f4e8c8;
          opacity: 0.45;
          text-decoration: none;
          font-size: 1.6rem;
          line-height: 1;
          transition: opacity 0.2s;
          padding: 8px;
        }
        .tapestry-nav-arrow:hover {
          opacity: 0.9;
        }
        .tapestry-game-link {
          color: inherit;
          text-decoration: none;
          border-bottom: 1px solid rgba(244, 232, 200, 0.3);
          padding-bottom: 1px;
          transition: border-color 0.2s, opacity 0.2s;
        }
        .tapestry-game-link:hover {
          border-color: rgba(244, 232, 200, 0.75);
          opacity: 1;
        }
      `}</style>
      {children}
    </>
  );
}
