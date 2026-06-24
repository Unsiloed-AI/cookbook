import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitExtract, pollExtract } from "@/lib/extract.functions";
import { DropZone } from "@/components/tearsheet/DropZone";
import { StatusChip, type Stage } from "@/components/tearsheet/StatusChip";
import { Dashboard } from "@/components/tearsheet/Dashboard";
import type { ExtractedResult } from "@/components/tearsheet/types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tearsheet — every fund number traces back to the page" },
      {
        name: "description",
        content:
          "Drop a fund factsheet PDF and get a live, interactive dashboard where every KPI, chart and cell links back to its source page.",
      },
      { property: "og:title", content: "Tearsheet" },
      {
        property: "og:description",
        content:
          "Turn a dense fund factsheet into an interactive dashboard with full traceability.",
      },
    ],
  }),
  component: TearsheetApp,
});

function TearsheetApp() {
  const submit = useServerFn(submitExtract);
  const poll = useServerFn(pollExtract);

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<ExtractedResult | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setFile(null);
    setStage(null);
    setError(undefined);
    setResult(null);
  }, []);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const handleFile = useCallback(
    async (f: File) => {
      setFile(f);
      setError(undefined);
      setResult(null);
      setStage("uploading");
      try {
        const fd = new FormData();
        fd.append("file", f);
        const { jobId } = await submit({ data: fd });
        setStage("extracting");
        // poll loop
        const startedAt = Date.now();
        const maxMs = 8 * 60 * 1000;
        const loop = async () => {
          try {
            const job: any = await poll({ data: { jobId } });
            const status = job?.status;
            if (status === "completed" || status === "review") {
              setStage("building");
              setResult(job.result as ExtractedResult);
              // brief build animation
              setTimeout(() => setStage("ready"), 600);
              return;
            }
            if (status === "failed") {
              setStage("error");
              setError(job?.error ?? "Extraction job failed");
              return;
            }
            if (Date.now() - startedAt > maxMs) {
              setStage("error");
              setError("Extraction timed out");
              return;
            }
            pollTimer.current = setTimeout(loop, 3000);
          } catch (e: any) {
            setStage("error");
            setError(e?.message ?? "Polling failed");
          }
        };
        loop();
      } catch (e: any) {
        setStage("error");
        setError(e?.message ?? "Upload failed");
      }
    },
    [submit, poll],
  );

  if (!stage) {
    return <DropZone onFile={handleFile} />;
  }

  if (stage === "ready" && result) {
    return <Dashboard result={result} file={file} onReset={reset} />;
  }

  // In-progress / error overlay
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="ts-card p-10 w-full max-w-xl text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {file?.name ?? "Processing"}
        </div>
        <h2 className="mt-2 text-2xl font-semibold">
          {stage === "uploading" && "Uploading your PDF…"}
          {stage === "extracting" && "Extracting structured data…"}
          {stage === "building" && "Building your dashboard…"}
          {stage === "error" && "We hit a snag"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {stage === "extracting"
            ? "Unsiloed is reading each page and grounding every value with a citation. This usually takes 30–90 seconds."
            : stage === "building"
              ? "Almost there."
              : stage === "error"
                ? "Try again with a different PDF, or check the file size (max 500 MB)."
                : "Securely uploading the file."}
        </p>
        <div className="mt-6 flex justify-center">
          <StatusChip stage={stage} error={error} />
        </div>
        {stage === "error" && (
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
          >
            Try another file
          </button>
        )}
      </div>
    </div>
  );
}
