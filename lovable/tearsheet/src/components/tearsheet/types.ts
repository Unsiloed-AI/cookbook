export interface Citation {
  bbox: [number, number, number, number];
  page: number;
  page_width: number;
  page_height: number;
}

export interface Score {
  grounding_score: number;
  extraction_score: number | null;
}

export interface ExtractedField<T = unknown> {
  value: T;
  score?: Score;
  citation?: Citation | null;
}

export interface ExtractedResult {
  fund_name?: ExtractedField<string>;
  report_date?: ExtractedField<string>;
  total_net_assets?: ExtractedField<string>;
  nav_per_share?: ExtractedField<string>;
  asset_allocation?: ExtractedField<
    Array<{ asset_class: ExtractedField<string>; percent: ExtractedField<string> }>
  >;
  sector_breakdown?: ExtractedField<
    Array<{ sector: ExtractedField<string>; percent: ExtractedField<string> }>
  >;
  top_holdings?: ExtractedField<
    Array<{
      security_name: ExtractedField<string>;
      ticker?: ExtractedField<string>;
      weight: ExtractedField<string>;
      market_value?: ExtractedField<string>;
    }>
  >;
  performance?: ExtractedField<
    Array<{ period: ExtractedField<string>; return_pct: ExtractedField<string> }>
  >;
}

/** Strip $ , % and parse a numeric value. Returns NaN if unparseable. */
export function parseNumeric(raw: string | undefined | null): number {
  if (!raw) return NaN;
  const cleaned = String(raw).replace(/[$,%\s]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function confidenceOf(field: ExtractedField | undefined | null): number | null {
  if (!field?.score) return null;
  const g = field.score.grounding_score ?? 0;
  const e = field.score.extraction_score ?? 0;
  // Lower of the two scores per spec
  return Math.min(g, e);
}

export type Traceable = {
  field: ExtractedField<unknown>;
  label: string;
};
