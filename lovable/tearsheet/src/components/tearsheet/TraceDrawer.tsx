import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ExtractedField } from "./types";
import { confidenceOf } from "./types";

class PdfErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="ts-card p-8 text-center text-sm text-muted-foreground">
          Couldn't render this PDF page. The citation may still be valid; try another value.
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  file: File | null;
  field: ExtractedField<unknown> | null;
  label: string;
}

export function TraceDrawer({ open, onClose, file, field, label }: Props) {
  const citation = field?.citation ?? null;
  const confidence = confidenceOf(field);
  const valueText = useMemo(() => {
    const v = field?.value;
    if (v == null) return "—";
    if (typeof v === "string" || typeof v === "number") return String(v);
    return JSON.stringify(v);
  }, [field]);

  const conf = confidence ?? 0;
  const tier =
    confidence == null
      ? { label: "no score", color: "bg-muted text-muted-foreground" }
      : conf >= 0.9
        ? { label: `${(conf * 100).toFixed(0)}% confidence`, color: "bg-success/15 text-success" }
        : conf >= 0.7
          ? { label: `${(conf * 100).toFixed(0)}% confidence`, color: "bg-warning/20 text-yellow-700" }
          : { label: `${(conf * 100).toFixed(0)}% confidence`, color: "bg-destructive/15 text-destructive" };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-foreground/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed right-0 top-0 h-full w-full max-w-[640px] bg-surface border-l border-border z-50 shadow-2xl flex flex-col"
          >
            <header className="flex items-start justify-between gap-3 px-6 py-5 border-b border-border">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="mt-1 text-xl font-semibold truncate">{valueText}</div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className={`ts-chip ${tier.color} border-transparent`}>{tier.label}</span>
                  {citation && (
                    <span className="ts-chip">Page {citation.page}</span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-9 inline-flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-6 bg-surface-muted">
              {file && citation ? (
                <PdfErrorBoundary>
                  <PdfPagePreview file={file} citation={citation} />
                </PdfErrorBoundary>
              ) : (
                <div className="ts-card p-8 text-center text-muted-foreground text-sm">
                  No source citation is available for this value.
                </div>
              )}
            </div>
            <footer className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
              Every number traces back to the page.
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PdfPagePreview({
  file,
  citation,
}: {
  file: File;
  citation: NonNullable<ExtractedField["citation"]>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [Doc, setDoc] = useState<any>(null);
  const [Page, setPage] = useState<any>(null);
  const [renderW, setRenderW] = useState(560);
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const reactPdf = await import("react-pdf");
      const pdfjs = reactPdf.pdfjs;
      // Use a worker bundled as a classic Worker via Vite's ?worker&url
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      if (!mounted) return;
      setDoc(() => reactPdf.Document);
      setPage(() => reactPdf.Page);
    })().catch((e) => {
      console.error("[TraceDrawer] failed to init react-pdf", e);
      setDocError(String(e?.message ?? e));
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setRenderW(Math.min(containerRef.current.clientWidth, 800));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFileData(null);
    file
      .arrayBuffer()
      .then((buf) => {
        if (!cancelled) setFileData(new Uint8Array(buf));
      })
      .catch((e) => {
        if (!cancelled) setDocError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const docFile = useMemo(() => (fileData ? { data: fileData } : null), [fileData]);

  if (docError) {
    return <div className="ts-card p-8 text-center text-destructive text-sm">PDF viewer error: {docError}</div>;
  }
  if (!Doc || !Page || !docFile) {
    return <div className="ts-card p-8 text-center text-muted-foreground text-sm">Loading viewer…</div>;
  }

  const scale = pageDims ? renderW / pageDims.w : 1;
  const [x1, y1, x2, y2] = citation.bbox;
  const overlay = pageDims
    ? {
        left: x1 * scale,
        top: y1 * scale,
        width: (x2 - x1) * scale,
        height: (y2 - y1) * scale,
      }
    : null;

  return (
    <div ref={containerRef} className="relative ts-card overflow-hidden inline-block max-w-full">
      <Doc
        file={docFile}
        loading={<div className="p-10 text-muted-foreground text-sm">Loading PDF…</div>}
        error={<div className="p-10 text-destructive text-sm">Failed to load PDF.</div>}
        onLoadError={(err: Error) => {
          console.error("[TraceDrawer] Document load error", err);
          setDocError(err?.message || "unknown error");
        }}
        onSourceError={(err: Error) => {
          console.error("[TraceDrawer] Document source error", err);
          setDocError(err?.message || "source error");
        }}
      >

        <div className="relative">
          <Page
            pageNumber={citation.page}
            width={renderW}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            onLoadSuccess={(p: any) => setPageDims({ w: p.originalWidth ?? p.width, h: p.originalHeight ?? p.height })}
          />
          {overlay && (
            <motion.div
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="absolute pointer-events-none rounded-md"
              style={{
                left: overlay.left,
                top: overlay.top,
                width: overlay.width,
                height: overlay.height,
                background: "rgba(248, 97, 168, 0.18)",
                border: "2px solid #F861A8",
                boxShadow: "0 0 0 6px rgba(248, 97, 168, 0.10)",
              }}
            />
          )}
        </div>
      </Doc>
    </div>
  );
}
