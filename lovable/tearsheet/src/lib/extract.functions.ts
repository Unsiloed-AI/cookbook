import { createServerFn } from "@tanstack/react-start";

const SCHEMA = {
  type: "object",
  properties: {
    fund_name: { type: "string", description: "Name of the fund" },
    report_date: { type: "string", description: "As-of date of the report" },
    total_net_assets: { type: "string", description: "Total net assets / AUM" },
    nav_per_share: { type: "string", description: "Net asset value per share" },
    asset_allocation: {
      type: "array",
      description: "Allocation by asset class",
      items: {
        type: "object",
        properties: {
          asset_class: { type: "string", description: "Asset class name" },
          percent: { type: "string", description: "Percent of portfolio" },
        },
        required: ["asset_class", "percent"],
        additionalProperties: false,
      },
    },
    sector_breakdown: {
      type: "array",
      description: "Allocation by sector",
      items: {
        type: "object",
        properties: {
          sector: { type: "string", description: "Sector name" },
          percent: { type: "string", description: "Percent of portfolio" },
        },
        required: ["sector", "percent"],
        additionalProperties: false,
      },
    },
    top_holdings: {
      type: "array",
      description: "Largest holdings",
      items: {
        type: "object",
        properties: {
          security_name: { type: "string", description: "Name of the security" },
          ticker: { type: "string", description: "Ticker or identifier" },
          weight: { type: "string", description: "Percent of net assets" },
          market_value: { type: "string", description: "Market value" },
        },
        required: ["security_name", "weight"],
        additionalProperties: false,
      },
    },
    performance: {
      type: "array",
      description: "Trailing returns by period",
      items: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period, e.g. 1M, YTD, 1Y, 3Y, 5Y" },
          return_pct: { type: "string", description: "Return for the period" },
        },
        required: ["period", "return_pct"],
        additionalProperties: false,
      },
    },
  },
  required: ["fund_name", "top_holdings"],
  additionalProperties: false,
};

const BASE = "https://prod.visionapi.unsiloed.ai";

export const submitExtract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    return { file };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.UNSILOED_API_KEY;
    if (!apiKey) throw new Error("UNSILOED_API_KEY not configured");
    const fd = new FormData();
    fd.append("pdf_file", data.file, data.file.name || "document.pdf");
    fd.append("schema_data", JSON.stringify(SCHEMA));
    fd.append("enable_citations", "true");
    fd.append("model", "gamma");
    const res = await fetch(`${BASE}/v2/extract`, {
      method: "POST",
      headers: { accept: "application/json", "api-key": apiKey },
      body: fd,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Unsiloed submit failed (${res.status}): ${text}`);
    const json = JSON.parse(text) as {
      job_id: string | null;
      status: string;
      blocked?: boolean;
      reason?: string;
    };
    if (json.blocked || !json.job_id) {
      throw new Error(`Extraction blocked: ${json.reason ?? json.status}`);
    }
    return { jobId: json.job_id, status: json.status };
  });

export const pollExtract = createServerFn({ method: "GET" })
  .inputValidator((data: { jobId: string }) => {
    if (!data?.jobId) throw new Error("Missing jobId");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.UNSILOED_API_KEY;
    if (!apiKey) throw new Error("UNSILOED_API_KEY not configured");
    const res = await fetch(`${BASE}/extract/${data.jobId}`, {
      headers: { accept: "application/json", "api-key": apiKey },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Unsiloed poll failed (${res.status}): ${text}`);
    return JSON.parse(text);
  });
