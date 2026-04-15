export default function TapestryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body { overflow: auto !important; }
        .tapestry-page, .tapestry-page * { user-select: text !important; }
      `}</style>
      {children}
    </>
  );
}
