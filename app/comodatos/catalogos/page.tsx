"use client";

import Link from "next/link";
import React from "react";

/* URL por defecto: tu enlace de Google Drive */
const DEFAULT_CATALOGO_PDF_URL =
  "https://drive.google.com/file/d/1t7Zu1rQK2KoMtA91oGevel_7cYFCrt-7/view?usp=sharing";

/* Mini hook para persistir en localStorage */
function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = React.useState<T>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  });
  React.useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

/* Helpers para normalizar enlaces de Google Drive */
function extractDriveId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
function buildDrivePreviewUrl(id: string) {
  // Ideal para embeber en <iframe>
  return `https://drive.google.com/file/d/${id}/preview`;
}
function buildDriveDownloadUrl(id: string) {
  // Enlace directo al archivo (descarga)
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export default function CatalogoPage() {
  const [pdfUrl, setPdfUrl] = useLocalStorage<string>(
    "catalogo.pdf.url",
    DEFAULT_CATALOGO_PDF_URL
  );

  const [useGoogleViewer, setUseGoogleViewer] = React.useState(true);

  const driveId = React.useMemo(() => extractDriveId(pdfUrl || ""), [pdfUrl]);
  const isDrive = !!driveId;

  // Embed que se mostrará en el iframe:
  const embedSrc = React.useMemo(() => {
    if (!pdfUrl) return "";
    if (isDrive && driveId) {
      return buildDrivePreviewUrl(driveId); // visor nativo de Drive
    }
    // PDFs no-Drive: opción visor de Google o visor nativo del navegador
    return useGoogleViewer
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
          pdfUrl
        )}`
      : pdfUrl;
  }, [pdfUrl, isDrive, driveId, useGoogleViewer]);

  const openInNewTabHref = React.useMemo(() => {
    if (!pdfUrl) return "#";
    if (isDrive && driveId) {
      // Abrir la página de visualización de Drive
      return `https://drive.google.com/file/d/${driveId}/view`;
    }
    return pdfUrl;
  }, [pdfUrl, isDrive, driveId]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* HEADER: mismo diseño */}
      <header className="sticky top-0 z-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />
        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">
            Catálogo de Equipos
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded bg-white/20 text-white px-3 py-1 text-xs sm:text-sm hover:bg-white/30"
            >
              ⟵ Volver
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Panel de URL y controles */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">
            📄 Fuente del catálogo (PDF)
          </h2>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm flex-1 min-w-[280px]">
              URL del PDF (público)
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder="Pega aquí el enlace al PDF (Drive o directo)"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
              />
            </label>

            <label
              className={`text-sm inline-flex items-center gap-2 ${
                isDrive ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={
                isDrive
                  ? "Para archivos de Google Drive se usa el visor nativo de Drive."
                  : "Alterna entre el visor nativo del navegador y el visor de Google."
              }
            >
              <input
                type="checkbox"
                checked={useGoogleViewer}
                disabled={isDrive}
                onChange={(e) => setUseGoogleViewer(e.target.checked)}
              />
              Usar visor de Google
            </label>

            <a
              className="rounded bg-zinc-200 px-3 py-2 text-xs hover:bg-zinc-300"
              href={openInNewTabHref}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en nueva pestaña
            </a>
          </div>

          {/* Visor */}
          <div className="mt-4 overflow-hidden rounded-xl border">
            {!pdfUrl ? (
              <div className="p-10 text-center text-zinc-500">
                Pega una URL de PDF pública para visualizar el catálogo.
              </div>
            ) : (
              <iframe
                title="Catálogo de Equipos"
                src={embedSrc}
                className="w-full h-[calc(100vh-220px)] bg-white"
                allow="fullscreen"
              />
            )}
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Tip: si el archivo está en Google Drive, asegúrate de que el enlace
            sea público (o “cualquiera con el enlace”). Para Drive, el visor
            nativo ({`/preview`}) es el más compatible.
          </p>
        </section>
      </main>
    </div>
  );
}
