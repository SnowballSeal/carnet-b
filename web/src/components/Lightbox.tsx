import { useEffect } from "react";

/** Imagen ampliada a pantalla completa; se cierra con Escape, el botón o tocando fuera. */
export default function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button className="lightbox__cerrar" aria-label="Cerrar imagen ampliada" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
