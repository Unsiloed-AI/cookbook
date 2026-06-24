import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { ArrowUpDown, Search, Eye, EyeOff, RotateCcw } from "lucide-react";
import type { ExtractedField, ExtractedResult } from "./types";
import { parseNumeric, confidenceOf } from "./types";
import { TraceDrawer } from "./TraceDrawer";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

interface Props {
  result: ExtractedResult;
  file: File | null;
  onReset: () => void;
}

export function Dashboard({ result, file, onReset }: Props) {
  const [traceOn, setTraceOn] = useState(true);
  const [drawer, setDrawer] = useState<{ field: ExtractedField<unknown>; label: string } | null>(
    null,
  );

  const open = (label: string, field: ExtractedField<unknown> | undefined | null) => {
    if (!traceOn) return;
    if (!field || !field.citation) return;
    setDrawer({ field, label });
  };

  const fund = result.fund_name?.value ?? "Untitled fund";
  const date = result.report_date?.value ?? "";

  const assetAlloc = useMemo(() => {
    const items = result.asset_allocation?.value ?? [];
    return items
      .map((item) => ({
        name: item.asset_class?.value ?? "—",
        value: parseNumeric(item.percent?.value as string),
        raw: item.percent?.value as string,
        nameField: item.asset_class,
        valueField: item.percent,
      }))
      .filter((d) => Number.isFinite(d.value));
  }, [result]);

  const sectors = useMemo(() => {
    const items = result.sector_breakdown?.value ?? [];
    return items
      .map((item) => ({
        name: item.sector?.value ?? "—",
        value: parseNumeric(item.percent?.value as string),
        raw: item.percent?.value as string,
        nameField: item.sector,
        valueField: item.percent,
      }))
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => b.value - a.value);
  }, [result]);

  const performance = useMemo(() => {
    const items = result.performance?.value ?? [];
    return items
      .map((item) => ({
        name: item.period?.value ?? "—",
        value: parseNumeric(item.return_pct?.value as string),
        raw: item.return_pct?.value as string,
        nameField: item.period,
        valueField: item.return_pct,
      }))
      .filter((d) => Number.isFinite(d.value));
  }, [result]);

  const holdings = useMemo(() => result.top_holdings?.value ?? [], [result]);
  const topHoldingsRanked = useMemo(() => {
    return holdings
      .map((h) => ({
        name: h.security_name?.value ?? "—",
        value: parseNumeric(h.weight?.value as string),
        raw: h.weight?.value as string,
        valueField: h.weight,
        nameField: h.security_name,
      }))
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [holdings]);

  const largestSector = sectors[0];

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border"
      >
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Tearsheet
            </div>
            <h1
              className={`mt-0.5 text-xl md:text-2xl font-semibold truncate ${traceOn && result.fund_name?.citation ? "ts-traceable px-1 -mx-1" : ""}`}
              onClick={() => open("Fund name", result.fund_name)}
            >
              {fund}
            </h1>
            {date && (
              <div
                className={`text-xs text-muted-foreground mt-0.5 ${traceOn && result.report_date?.citation ? "ts-traceable inline-block px-1 -mx-1" : ""}`}
                onClick={() => open("Report date", result.report_date)}
              >
                As of {date}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTraceOn((v) => !v)}
              className={[
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors",
                traceOn
                  ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-pop)]"
                  : "bg-surface text-foreground border-border hover:bg-accent",
              ].join(" ")}
            >
              {traceOn ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              Trace to source
            </button>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border bg-surface text-foreground border-border hover:bg-accent"
            >
              <RotateCcw className="size-4" />
              New PDF
            </button>
          </div>
        </div>
        {traceOn && (
          <div className="mx-auto max-w-7xl px-6 pb-3 text-xs text-muted-foreground">
            Click any value with a soft pink underline to see the original page.
          </div>
        )}
      </motion.header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Net Assets"
            field={result.total_net_assets}
            traceOn={traceOn}
            onOpen={open}
            i={0}
          />
          <KpiCard
            label="NAV per Share"
            field={result.nav_per_share}
            traceOn={traceOn}
            onOpen={open}
            i={1}
          />
          <KpiCard
            label="Holdings"
            value={String(holdings.length || "—")}
            i={2}
          />
          <KpiCard
            label="Largest Sector"
            value={largestSector ? `${largestSector.name}` : "—"}
            sub={largestSector ? `${largestSector.raw}` : undefined}
            traceOn={traceOn}
            field={largestSector?.nameField as ExtractedField<unknown> | undefined}
            onOpen={open}
            i={3}
          />
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Asset Allocation" subtitle="By asset class">
            {assetAlloc.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={assetAlloc}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={68}
                    outerRadius={108}
                    paddingAngle={2}
                    isAnimationActive
                    animationDuration={900}
                    onClick={(d: any) =>
                      traceOn && open(`Allocation · ${d.name}`, d.valueField)
                    }
                  >
                    {assetAlloc.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke="var(--color-surface)"
                        strokeWidth={2}
                        cursor={traceOn ? "pointer" : "default"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PctTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <LegendList items={assetAlloc} traceOn={traceOn} onOpen={open} label="Allocation" />
          </ChartCard>

          <ChartCard title="Sector Breakdown" subtitle="Portfolio by sector">
            {sectors.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, sectors.length * 30)}>
                <BarChart data={sectors} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip content={<PctTooltip />} />
                  <Bar
                    dataKey="value"
                    radius={[0, 8, 8, 0]}
                    isAnimationActive
                    animationDuration={900}
                    onClick={(d: any) =>
                      traceOn && open(`Sector · ${d.name}`, d.valueField)
                    }
                  >
                    {sectors.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} cursor={traceOn ? "pointer" : "default"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Performance" subtitle="Trailing returns">
            {performance.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                {performance.length > 4 ? (
                  <LineChart data={performance}>
                    <CartesianGrid stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <Tooltip content={<PctTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "var(--color-primary)", cursor: traceOn ? "pointer" : "default" }}
                      activeDot={{ r: 7 }}
                      isAnimationActive
                      animationDuration={900}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={performance}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <Tooltip content={<PctTooltip />} />
                    <Bar
                      dataKey="value"
                      fill="var(--color-primary)"
                      radius={[8, 8, 0, 0]}
                      isAnimationActive
                      animationDuration={900}
                      onClick={(d: any) =>
                        traceOn && open(`Return · ${d.name}`, d.valueField)
                      }
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top Holdings by Weight" subtitle="Ranked">
            {topHoldingsRanked.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, topHoldingsRanked.length * 30)}>
                <BarChart data={topHoldingsRanked} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip content={<PctTooltip />} />
                  <Bar
                    dataKey="value"
                    fill="var(--color-primary)"
                    radius={[0, 8, 8, 0]}
                    isAnimationActive
                    animationDuration={900}
                    onClick={(d: any) =>
                      traceOn && open(`Holding · ${d.name}`, d.valueField)
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </section>

        {/* Holdings table */}
        <section>
          <HoldingsTable holdings={holdings} traceOn={traceOn} onOpen={open} />
        </section>

        <footer className="text-center text-xs text-muted-foreground py-6">
          Every number traces back to the page.
        </footer>
      </main>

      <TraceDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        file={file}
        field={drawer?.field ?? null}
        label={drawer?.label ?? ""}
      />
    </div>
  );
}

function KpiCard({
  label,
  field,
  value,
  sub,
  traceOn,
  onOpen,
  i,
}: {
  label: string;
  field?: ExtractedField<unknown> | null;
  value?: string;
  sub?: string;
  traceOn?: boolean;
  onOpen?: (label: string, f: ExtractedField<unknown> | undefined | null) => void;
  i: number;
}) {
  const display = value ?? (field?.value as string) ?? "—";
  const traceable = !!(traceOn && field?.citation);
  const conf = field ? confidenceOf(field) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
      className="ts-card p-5"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl md:text-3xl font-semibold tracking-tight ${traceable ? "ts-traceable px-1 -mx-1" : ""}`}
        onClick={() => traceable && onOpen?.(label, field)}
      >
        {display}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 min-h-5">
        <div className="text-xs text-muted-foreground truncate">{sub ?? ""}</div>
        {conf != null && <ConfidenceBadge conf={conf} />}
      </div>
    </motion.div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="ts-card p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-base font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
      No data extracted for this chart.
    </div>
  );
}

function PctTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="ts-card px-3 py-2 text-xs">
      <div className="font-medium">{p.payload.name}</div>
      <div className="text-muted-foreground">{p.payload.raw ?? p.value}</div>
    </div>
  );
}

function LegendList({
  items,
  traceOn,
  onOpen,
  label,
}: {
  items: Array<{ name: string; raw: string; valueField: ExtractedField<unknown> }>;
  traceOn: boolean;
  onOpen: (label: string, f: ExtractedField<unknown> | undefined | null) => void;
  label: string;
}) {
  if (!items.length) return null;
  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {items.map((it, i) => {
        const traceable = !!(traceOn && it.valueField?.citation);
        return (
          <li key={it.name + i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="size-2.5 rounded-sm shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate">{it.name}</span>
            </div>
            <span
              className={`tabular-nums text-muted-foreground ${traceable ? "ts-traceable px-1" : ""}`}
              onClick={() => traceable && onOpen(`${label} · ${it.name}`, it.valueField)}
            >
              {it.raw}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ConfidenceBadge({ conf }: { conf: number }) {
  const tier =
    conf >= 0.9
      ? { color: "bg-success/15 text-success" }
      : conf >= 0.7
        ? { color: "bg-warning/20 text-yellow-700" }
        : { color: "bg-destructive/15 text-destructive" };
  return (
    <span className={`ts-chip ${tier.color} border-transparent text-[10px] py-0.5 px-2`}>
      {(conf * 100).toFixed(0)}%
    </span>
  );
}

function HoldingsTable({
  holdings,
  traceOn,
  onOpen,
}: {
  holdings: NonNullable<ExtractedResult["top_holdings"]>["value"];
  traceOn: boolean;
  onOpen: (label: string, f: ExtractedField<unknown> | undefined | null) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "weight" | "mv"; dir: "asc" | "desc" }>({
    key: "weight",
    dir: "desc",
  });

  const rows = useMemo(() => {
    const mapped = holdings.map((h) => ({
      name: (h.security_name?.value as string) ?? "—",
      ticker: (h.ticker?.value as string) ?? "",
      weightRaw: (h.weight?.value as string) ?? "",
      weight: parseNumeric(h.weight?.value as string),
      mvRaw: (h.market_value?.value as string) ?? "",
      mv: parseNumeric(h.market_value?.value as string),
      raw: h,
    }));
    const filtered = q
      ? mapped.filter((r) =>
          [r.name, r.ticker].join(" ").toLowerCase().includes(q.toLowerCase()),
        )
      : mapped;
    return [...filtered].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      const av = sort.key === "weight" ? a.weight : a.mv;
      const bv = sort.key === "weight" ? b.weight : b.mv;
      if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      return (av - bv) * dir;
    });
  }, [holdings, q, sort]);

  const sortBtn = (key: "name" | "weight" | "mv", label: string, align: string = "text-left") => (
    <button
      className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${align}`}
      onClick={() =>
        setSort((s) => (s.key === key ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))
      }
    >
      {label}
      <ArrowUpDown className="size-3" />
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="ts-card overflow-hidden"
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap border-b border-border">
        <div>
          <div className="text-base font-semibold">Top Holdings</div>
          <div className="text-xs text-muted-foreground mt-0.5">{holdings.length} positions</div>
        </div>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or ticker…"
            className="pl-9 pr-3 py-2 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left px-5 py-3">{sortBtn("name", "Security")}</th>
              <th className="text-left px-5 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ticker</span>
              </th>
              <th className="text-right px-5 py-3">{sortBtn("weight", "Weight", "text-right")}</th>
              <th className="text-right px-5 py-3">{sortBtn("mv", "Market Value", "text-right")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                  No holdings to display.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const nameTrace = traceOn && r.raw.security_name?.citation;
              const weightTrace = traceOn && r.raw.weight?.citation;
              const mvTrace = traceOn && r.raw.market_value?.citation;
              const tickerTrace = traceOn && r.raw.ticker?.citation;
              return (
                <tr key={i} className="border-t border-border hover:bg-surface-muted/50">
                  <td className="px-5 py-3 font-medium">
                    <span
                      className={nameTrace ? "ts-traceable px-1 -mx-1" : ""}
                      onClick={() => nameTrace && onOpen(`Holding · ${r.name}`, r.raw.security_name)}
                    >
                      {r.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span
                      className={tickerTrace ? "ts-traceable px-1 -mx-1" : ""}
                      onClick={() => tickerTrace && r.raw.ticker && onOpen(`Ticker · ${r.name}`, r.raw.ticker)}
                    >
                      {r.ticker || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span
                      className={weightTrace ? "ts-traceable px-1 -mx-1" : ""}
                      onClick={() => weightTrace && onOpen(`Weight · ${r.name}`, r.raw.weight)}
                    >
                      {r.weightRaw || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    <span
                      className={mvTrace ? "ts-traceable px-1 -mx-1" : ""}
                      onClick={() => mvTrace && r.raw.market_value && onOpen(`Market value · ${r.name}`, r.raw.market_value)}
                    >
                      {r.mvRaw || "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
