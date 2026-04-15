"use client";

import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt: string;
  imgStyle: React.CSSProperties;
  imgClassName?: string;
}

export default function TapestryLightbox({ src, alt, imgStyle, imgClassName }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        style={{ ...imgStyle, cursor: "zoom-in" }}
        onClick={() => setOpen(true)}
      />

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="tapestry-lightbox-img"
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "95vw",
              maxHeight: "95vh",
              display: "block",
              cursor: "default",
              boxShadow: "0 32px 120px rgba(0, 0, 0, 0.8)",
            }}
          />
        </div>
      )}
    </>
  );
}
