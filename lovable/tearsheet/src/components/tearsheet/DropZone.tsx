import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, ChevronRight, CheckCircle2, ShieldAlert, Sparkles, Database, FileSpreadsheet, Layers } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
        alert("Please upload a PDF file.");
        return;
      }
      onFile(f);
    },
    [onFile],
  );

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent)_0%,_transparent_60%)] relative overflow-hidden font-sans">
      {/* Grid Pattern Background to mimic a factsheet grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      {/* Institutional Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-md px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold tracking-wider text-xs shadow-md">
              TS
            </div>
            <div>
              <div className="font-semibold text-foreground tracking-tight text-sm">TEARSHEET <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-full font-medium ml-1">ANALYST PRO</span></div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Institutional-Grade Factsheet Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              API: ONLINE
            </span>
            <span className="hidden sm:inline-block border-l border-border h-3" />
            <span>v2.4.0-SEC</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Product Value & Factsheet Mockup */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 ts-chip mb-2 border-primary/20 bg-primary/5 text-primary">
              <Sparkles className="size-3" />
              <span className="text-[11px] uppercase tracking-wider font-mono font-bold">Document Grounding</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
              Audit Every Number in Your Fund Factsheets
            </h1>
            
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Don&apos;t just parse values—ground them. Tearsheet transforms dense PDFs into a live terminal dashboard where every KPI, sector, and return is mapped to its exact visual source.
            </p>

            {/* Factsheet Feature Checkmarks */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="size-5 rounded-md bg-success/10 border border-success/20 flex items-center justify-center shrink-0 mt-0.5 text-success">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Traceable Citations</span>
                  <p className="text-xs text-muted-foreground font-mono">BBox tracking maps back to original PDF pages</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-5 rounded-md bg-success/10 border border-success/20 flex items-center justify-center shrink-0 mt-0.5 text-success">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Multi-Structure Extraction</span>
                  <p className="text-xs text-muted-foreground font-mono">Extracts allocations, tables, benchmarks, and dates</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-5 rounded-md bg-success/10 border border-success/20 flex items-center justify-center shrink-0 mt-0.5 text-success">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Zero hallucination confidence</span>
                  <p className="text-xs text-muted-foreground font-mono">Backed by Unsiloed Extraction Engine with accuracy scores</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Premium Drag & Drop Factsheet Upload */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative"
            >
              {/* Factsheet Aesthetic Blueprint Border styling */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-primary/10 via-border/50 to-primary/20 blur-sm -z-10" />
              
              <div className="ts-card overflow-hidden bg-surface border-border shadow-2xl relative">
                
                {/* Factsheet Corner crop marks to look like a document */}
                <div className="absolute top-3 left-3 size-4 border-t-2 border-l-2 border-muted-foreground/20 pointer-events-none" />
                <div className="absolute top-3 right-3 size-4 border-t-2 border-r-2 border-muted-foreground/20 pointer-events-none" />
                <div className="absolute bottom-3 left-3 size-4 border-b-2 border-l-2 border-muted-foreground/20 pointer-events-none" />
                <div className="absolute bottom-3 right-3 size-4 border-b-2 border-r-2 border-muted-foreground/20 pointer-events-none" />

                {/* Subheader info panel resembling financial report header */}
                <div className="border-b border-border bg-muted/30 px-6 py-3.5 flex justify-between items-center text-xs font-mono text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Database className="size-3 text-primary" />
                    SYSTEM: INPUT_STREAM
                  </span>
                  <span>MAX: 500 MB</span>
                </div>

                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    accept(e.dataTransfer.files?.[0]);
                  }}
                  className={[
                    "block cursor-pointer px-8 py-14 text-center transition-all relative group",
                    dragging
                      ? "bg-primary/5"
                      : "hover:bg-muted/10",
                  ].join(" ")}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => accept(e.target.files?.[0])}
                  />

                  {/* Factsheet Document Placeholder with Bounding Box overlays for design demo */}
                  <div className="relative mx-auto w-36 h-48 bg-muted/40 rounded-lg border border-border flex flex-col justify-between p-3 overflow-hidden shadow-inner group-hover:border-primary/30 transition-colors">
                    {/* Header line */}
                    <div className="space-y-1">
                      <div className="h-1.5 w-16 bg-muted-foreground/30 rounded" />
                      <div className="h-1 w-24 bg-muted-foreground/15 rounded" />
                    </div>

                    {/* Chart Mockup */}
                    <div className="flex items-end justify-between px-2 h-14">
                      <div className="w-3 h-10 bg-muted-foreground/20 rounded-t" />
                      <div className="w-3 h-14 bg-primary/40 rounded-t relative">
                        {/* Highlight circle representing bounding box highlight */}
                        <span className="absolute -top-1 -left-1 size-5 rounded-full border border-primary animate-ping opacity-75" />
                        <span className="absolute top-1 left-1 size-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="w-3 h-8 bg-muted-foreground/20 rounded-t" />
                      <div className="w-3 h-12 bg-muted-foreground/20 rounded-t" />
                    </div>

                    {/* Table Lines */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="h-1 w-10 bg-muted-foreground/20 rounded" />
                        <div className="h-1.5 w-6 bg-primary/30 rounded border border-primary/20" />
                      </div>
                      <div className="h-[0.5px] bg-border w-full" />
                      <div className="flex justify-between items-center">
                        <div className="h-1 w-12 bg-muted-foreground/20 rounded" />
                        <div className="h-1 w-4 bg-muted-foreground/20 rounded" />
                      </div>
                    </div>

                    {/* Center big upload button */}
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="size-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                        <UploadCloud className="size-5" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                    Drop fund factsheet or report PDF
                  </div>
                  
                  <p className="mt-1.5 text-xs text-muted-foreground font-mono">
                    or click to search directory
                  </p>

                  <div className="mt-8 pt-6 border-t border-dashed border-border flex items-center justify-center gap-6 text-left max-w-sm mx-auto">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <FileSpreadsheet className="size-3.5 text-primary/70" />
                      <span>KPI &amp; Holding Tables</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Layers className="size-3.5 text-primary/70" />
                      <span>Allocations &amp; Performance</span>
                    </div>
                  </div>
                </label>

                {/* Secure extraction footer */}
                <div className="border-t border-border bg-muted/20 px-6 py-3 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span>Secure processing, data is fully discarded post-session</span>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background/40 backdrop-blur-md px-6 py-4 text-center text-xs font-mono text-muted-foreground relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            Powered by <span className="font-semibold text-foreground">Unsiloed AI Extraction API</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-foreground cursor-pointer transition-colors">Documentation</span>
            <span>&bull;</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">API Reference</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
