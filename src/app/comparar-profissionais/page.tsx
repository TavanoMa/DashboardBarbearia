"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Scissors,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import Header from "@/components/Header";
import {
  CATEGORICAL,
  TOOLTIP_STYLE,
  AXIS_STYLE,
  formatBRL,
  formatBRLShort,
} from "@/components/charts/ChartColors";
import { useStore } from "@/hooks/useStore";
import { useDateRange } from "@/hooks/useDateRange";
import type { Agendamento } from "@/lib/types";

const GRID_STROKE = "#e5e7eb20";
const PROF_COLORS = [CATEGORICAL[0], CATEGORICAL[2]]; // blue, green

interface ProfOption {
  nome: string;
  storeId: string;
  storeName: string;
  label: string; // "Nome — Loja"
}

interface ProfStats {
  nome: string;
  storeId: string;
  storeName: string;
  atendimentos: number;
  faturamento: number;
  ticketMedio: number;
  cancelados: number;
  ausentes: number;
  totalAgendamentos: number;
  taxaRealizacao: number;
  servicos: { servico: string; qty: number; total: number }[];
  diario: { dia: string; label: string; valor: number; atendimentos: number }[];
  horasPopulares: { hora: string; qty: number }[];
  agendamentos: Agendamento[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildProfStats(
  nome: string,
  storeId: string,
  storeName: string,
  agendamentos: Agendamento[]
): ProfStats {
  const profAgs = agendamentos.filter((a) => a.profissional === nome);
  const realizados = profAgs.filter((a) => a.status === "Realizado");
  const faturamento = realizados.reduce((s, a) => s + a.valor, 0);
  const atendimentos = realizados.length;
  const cancelados = profAgs.filter((a) => a.status === "Cancelado").length;
  const ausentes = profAgs.filter((a) => a.status === "Ausente").length;

  // Services
  const servMap = new Map<string, { qty: number; total: number }>();
  for (const a of realizados) {
    const entry = servMap.get(a.servico) || { qty: 0, total: 0 };
    entry.qty++;
    entry.total += a.valor;
    servMap.set(a.servico, entry);
  }
  const servicos = Array.from(servMap.entries())
    .map(([servico, data]) => ({ servico, ...data }))
    .sort((a, b) => b.qty - a.qty);

  // Daily breakdown
  const dayMap = new Map<string, { valor: number; atendimentos: number }>();
  for (const a of realizados) {
    const dia = a.dataIni.split(" ")[0] || "";
    const entry = dayMap.get(dia) || { valor: 0, atendimentos: 0 };
    entry.valor += a.valor;
    entry.atendimentos++;
    dayMap.set(dia, entry);
  }
  const diario = Array.from(dayMap.entries())
    .map(([dia, data]) => {
      const parts = dia.split("/");
      const label = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : dia;
      return { dia, label, ...data };
    })
    .sort((a, b) => {
      const [da, ma, ya] = a.dia.split("/").map(Number);
      const [db, mb, yb] = b.dia.split("/").map(Number);
      return (ya * 10000 + ma * 100 + da) - (yb * 10000 + mb * 100 + db);
    });

  // Popular hours
  const horaMap = new Map<string, number>();
  for (const a of realizados) {
    const hora = a.hora?.split(":")[0] || "";
    if (hora) horaMap.set(hora, (horaMap.get(hora) || 0) + 1);
  }
  const horasPopulares = Array.from(horaMap.entries())
    .map(([hora, qty]) => ({ hora: hora + "h", qty }))
    .sort((a, b) => parseInt(a.hora) - parseInt(b.hora));

  return {
    nome,
    storeId,
    storeName,
    atendimentos,
    faturamento,
    ticketMedio: atendimentos > 0 ? faturamento / atendimentos : 0,
    cancelados,
    ausentes,
    totalAgendamentos: profAgs.length,
    taxaRealizacao: profAgs.length > 0 ? (atendimentos / profAgs.length) * 100 : 0,
    servicos,
    diario,
    horasPopulares,
    agendamentos: profAgs,
  };
}

/* ---------- Searchable Dropdown ---------- */
function ProfSelector({
  options,
  value,
  onChange,
  placeholder,
  color,
  otherSelected,
}: {
  options: ProfOption[];
  value: ProfOption | null;
  onChange: (opt: ProfOption | null) => void;
  placeholder: string;
  color: string;
  otherSelected: ProfOption | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) &&
        !(otherSelected && o.nome === otherSelected.nome && o.storeId === otherSelected.storeId)
    );
  }, [options, search, otherSelected]);

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(!open); }}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-colors text-left bg-card-bg hover:border-opacity-80 cursor-pointer"
        style={{ borderColor: value ? color : "var(--card-border)" }}
      >
        {value ? (
          <>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
              style={{ backgroundColor: color + "22", color }}
            >
              {getInitials(value.nome)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{value.nome}</p>
              <p className="text-xs text-muted flex items-center gap-1">
                <MapPin size={10} />
                {value.storeName}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="p-1 rounded-md hover:bg-white/10"
            >
              <X size={16} className="text-muted" />
            </button>
          </>
        ) : (
          <>
            <Search size={18} className="text-muted" />
            <span className="text-muted flex-1">{placeholder}</span>
            <ChevronDown size={16} className="text-muted" />
          </>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-card-bg border border-card-border rounded-xl shadow-xl z-20 max-h-72 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-card-border">
              <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg">
                <Search size={14} className="text-muted shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar profissional..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm outline-none flex-1"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 && (
                <p className="text-sm text-muted text-center py-4">Nenhum encontrado</p>
              )}
              {filtered.map((opt) => (
                <button
                  key={`${opt.storeId}-${opt.nome}`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ backgroundColor: color + "15", color }}
                  >
                    {getInitials(opt.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{opt.nome}</p>
                    <p className="text-xs text-muted flex items-center gap-1">
                      <MapPin size={9} />
                      {opt.storeName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Stat Card ---------- */
function StatCompare({
  label,
  val1,
  val2,
  format = "number",
}: {
  label: string;
  val1: number;
  val2: number;
  format?: "currency" | "number" | "percent";
}) {
  const fmt = (v: number) => {
    if (format === "currency") return formatBRL(v);
    if (format === "percent") return v.toFixed(0) + "%";
    return String(v);
  };

  const diff = val1 - val2;
  const winner = diff > 0 ? 0 : diff < 0 ? 1 : -1;

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4">
      <p className="text-xs text-muted mb-3 font-medium">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1 text-center">
          <p
            className="text-xl font-bold"
            style={{ color: winner === 0 ? PROF_COLORS[0] : undefined }}
          >
            {fmt(val1)}
          </p>
          {winner === 0 && (
            <ArrowUpRight size={14} className="inline" style={{ color: PROF_COLORS[0] }} />
          )}
        </div>
        <div className="text-muted text-xs px-2">vs</div>
        <div className="flex-1 text-center">
          <p
            className="text-xl font-bold"
            style={{ color: winner === 1 ? PROF_COLORS[1] : undefined }}
          >
            {fmt(val2)}
          </p>
          {winner === 1 && (
            <ArrowUpRight size={14} className="inline" style={{ color: PROF_COLORS[1] }} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function CompararProfissionaisPage() {
  const { stores } = useStore();
  const { dataIni, dataFim } = useDateRange();

  const [loading, setLoading] = useState(false);
  const [allAgendamentos, setAllAgendamentos] = useState<
    { storeId: string; storeName: string; agendamentos: Agendamento[] }[]
  >([]);
  const [selected1, setSelected1] = useState<ProfOption | null>(null);
  const [selected2, setSelected2] = useState<ProfOption | null>(null);

  const fetchAll = useCallback(async () => {
    if (stores.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        stores.map(async (s) => {
          const res = await fetch(
            `/api/agendamentos?dataIni=${dataIni}&dataFim=${dataFim}&store=${s.id}`
          );
          if (!res.ok) return { storeId: s.id, storeName: s.name, agendamentos: [] as Agendamento[] };
          const data: Agendamento[] = await res.json();
          return {
            storeId: s.id,
            storeName: s.name,
            agendamentos: data.filter((a) => a.servico !== "Bloqueado"),
          };
        })
      );
      setAllAgendamentos(results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [stores, dataIni, dataFim]);

  useEffect(() => {
    fetchAll();
  }, [stores, dataIni, dataFim]);

  // Build options list
  const profOptions: ProfOption[] = useMemo(() => {
    const opts: ProfOption[] = [];
    for (const store of allAgendamentos) {
      const profNames = new Set<string>();
      for (const a of store.agendamentos) {
        if (a.profissional && a.status === "Realizado") {
          profNames.add(a.profissional);
        }
      }
      for (const nome of profNames) {
        opts.push({
          nome,
          storeId: store.storeId,
          storeName: store.storeName,
          label: `${nome} — ${store.storeName}`,
        });
      }
    }
    return opts.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allAgendamentos]);

  // Build stats for selected professionals
  const stats1 = useMemo(() => {
    if (!selected1) return null;
    const store = allAgendamentos.find((s) => s.storeId === selected1.storeId);
    if (!store) return null;
    return buildProfStats(selected1.nome, selected1.storeId, selected1.storeName, store.agendamentos);
  }, [selected1, allAgendamentos]);

  const stats2 = useMemo(() => {
    if (!selected2) return null;
    const store = allAgendamentos.find((s) => s.storeId === selected2.storeId);
    if (!store) return null;
    return buildProfStats(selected2.nome, selected2.storeId, selected2.storeName, store.agendamentos);
  }, [selected2, allAgendamentos]);

  // Chart data
  const metricsChartData = useMemo(() => {
    if (!stats1 || !stats2) return [];
    return [
      { metric: "Atendimentos", [stats1.nome]: stats1.atendimentos, [stats2.nome]: stats2.atendimentos },
      { metric: "Faturamento", [stats1.nome]: stats1.faturamento, [stats2.nome]: stats2.faturamento },
      { metric: "Ticket Médio", [stats1.nome]: stats1.ticketMedio, [stats2.nome]: stats2.ticketMedio },
      { metric: "Cancelamentos", [stats1.nome]: stats1.cancelados, [stats2.nome]: stats2.cancelados },
    ];
  }, [stats1, stats2]);

  // Daily comparison
  const dailyChartData = useMemo(() => {
    if (!stats1 || !stats2) return [];
    const allDays = new Set([
      ...stats1.diario.map((d) => d.dia),
      ...stats2.diario.map((d) => d.dia),
    ]);
    return Array.from(allDays)
      .map((dia) => {
        const d1 = stats1.diario.find((d) => d.dia === dia);
        const d2 = stats2.diario.find((d) => d.dia === dia);
        const parts = dia.split("/");
        const label = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : dia;
        return {
          dia,
          label,
          [stats1.nome]: d1?.valor || 0,
          [stats2.nome]: d2?.valor || 0,
        };
      })
      .sort((a, b) => {
        const [da, ma, ya] = a.dia.split("/").map(Number);
        const [db, mb, yb] = b.dia.split("/").map(Number);
        return (ya * 10000 + ma * 100 + da) - (yb * 10000 + mb * 100 + db);
      });
  }, [stats1, stats2]);

  // Radar chart data
  const radarData = useMemo(() => {
    if (!stats1 || !stats2) return [];
    // Normalize values to 0-100 scale for radar
    const maxAtend = Math.max(stats1.atendimentos, stats2.atendimentos, 1);
    const maxFat = Math.max(stats1.faturamento, stats2.faturamento, 1);
    const maxTM = Math.max(stats1.ticketMedio, stats2.ticketMedio, 1);
    const maxTaxa = 100;
    const maxServicos = Math.max(stats1.servicos.length, stats2.servicos.length, 1);

    return [
      {
        metric: "Atendimentos",
        [stats1.nome]: (stats1.atendimentos / maxAtend) * 100,
        [stats2.nome]: (stats2.atendimentos / maxAtend) * 100,
      },
      {
        metric: "Faturamento",
        [stats1.nome]: (stats1.faturamento / maxFat) * 100,
        [stats2.nome]: (stats2.faturamento / maxFat) * 100,
      },
      {
        metric: "Ticket Médio",
        [stats1.nome]: (stats1.ticketMedio / maxTM) * 100,
        [stats2.nome]: (stats2.ticketMedio / maxTM) * 100,
      },
      {
        metric: "Taxa Realização",
        [stats1.nome]: (stats1.taxaRealizacao / maxTaxa) * 100,
        [stats2.nome]: (stats2.taxaRealizacao / maxTaxa) * 100,
      },
      {
        metric: "Variedade Serviços",
        [stats1.nome]: (stats1.servicos.length / maxServicos) * 100,
        [stats2.nome]: (stats2.servicos.length / maxServicos) * 100,
      },
    ];
  }, [stats1, stats2]);

  // Services comparison table
  const servicesComparison = useMemo(() => {
    if (!stats1 || !stats2) return [];
    const allServicos = new Set([
      ...stats1.servicos.map((s) => s.servico),
      ...stats2.servicos.map((s) => s.servico),
    ]);
    return Array.from(allServicos)
      .map((servico) => {
        const s1 = stats1.servicos.find((s) => s.servico === servico);
        const s2 = stats2.servicos.find((s) => s.servico === servico);
        return {
          servico,
          qty1: s1?.qty || 0,
          total1: s1?.total || 0,
          qty2: s2?.qty || 0,
          total2: s2?.total || 0,
        };
      })
      .sort((a, b) => (b.qty1 + b.qty2) - (a.qty1 + a.qty2));
  }, [stats1, stats2]);

  const bothSelected = stats1 && stats2;

  return (
    <>
      <Header
        title="Comparar Profissionais"
        hideStore
        loading={loading}
        onRefresh={fetchAll}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-auto">
        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted mb-2 font-medium flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: PROF_COLORS[0] }}
              />
              Profissional 1
            </p>
            <ProfSelector
              options={profOptions}
              value={selected1}
              onChange={setSelected1}
              placeholder="Selecionar profissional..."
              color={PROF_COLORS[0]}
              otherSelected={selected2}
            />
          </div>
          <div>
            <p className="text-xs text-muted mb-2 font-medium flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: PROF_COLORS[1] }}
              />
              Profissional 2
            </p>
            <ProfSelector
              options={profOptions}
              value={selected2}
              onChange={setSelected2}
              placeholder="Selecionar profissional..."
              color={PROF_COLORS[1]}
              otherSelected={selected1}
            />
          </div>
        </div>

        {/* Empty state */}
        {!bothSelected && (
          <div className="bg-card-bg border border-card-border border-dashed rounded-xl p-12 text-center">
            <Users size={48} className="mx-auto text-muted/30 mb-4" />
            <p className="text-muted font-medium">
              Selecione dois profissionais para comparar
            </p>
            <p className="text-sm text-muted/60 mt-1">
              Você pode escolher profissionais de lojas diferentes
            </p>
          </div>
        )}

        {/* Comparison content */}
        {bothSelected && stats1 && stats2 && (
          <>
            {/* Hero cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[stats1, stats2].map((stats, i) => (
                <div
                  key={`${stats.storeId}-${stats.nome}`}
                  className="bg-card-bg border border-card-border rounded-xl p-5"
                  style={{ borderLeftColor: PROF_COLORS[i], borderLeftWidth: 4 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shrink-0"
                      style={{ backgroundColor: PROF_COLORS[i] + "22", color: PROF_COLORS[i] }}
                    >
                      {getInitials(stats.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg truncate">{stats.nome}</h4>
                      <p className="text-xs text-muted flex items-center gap-1">
                        <MapPin size={10} />
                        {stats.storeName}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-background rounded-lg p-3 text-center">
                      <p className="text-xs text-muted">Faturamento</p>
                      <p className="font-bold text-success text-lg">{formatBRL(stats.faturamento)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 text-center">
                      <p className="text-xs text-muted">Atendimentos</p>
                      <p className="font-bold text-lg">{stats.atendimentos}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 text-center">
                      <p className="text-xs text-muted">Ticket Médio</p>
                      <p className="font-bold text-lg">{formatBRL(stats.ticketMedio)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* KPI Comparison Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCompare label="Faturamento" val1={stats1.faturamento} val2={stats2.faturamento} format="currency" />
              <StatCompare label="Atendimentos" val1={stats1.atendimentos} val2={stats2.atendimentos} />
              <StatCompare label="Ticket Médio" val1={stats1.ticketMedio} val2={stats2.ticketMedio} format="currency" />
              <StatCompare label="Taxa Realização" val1={stats1.taxaRealizacao} val2={stats2.taxaRealizacao} format="percent" />
              <StatCompare label="Cancelamentos" val1={stats1.cancelados} val2={stats2.cancelados} />
              <StatCompare label="Ausentes" val1={stats1.ausentes} val2={stats2.ausentes} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-accent" />
                  Perfil Comparativo
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={GRID_STROKE} />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <Radar
                      name={stats1.nome}
                      dataKey={stats1.nome}
                      stroke={PROF_COLORS[0]}
                      fill={PROF_COLORS[0]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Radar
                      name={stats2.nome}
                      dataKey={stats2.nome}
                      stroke={PROF_COLORS[1]}
                      fill={PROF_COLORS[1]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [value.toFixed(0) + "%", ""]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart metrics */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Scissors size={18} className="text-accent" />
                  Métricas Lado a Lado
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="metric" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey={stats1.nome} fill={PROF_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={stats2.nome} fill={PROF_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily revenue comparison */}
            {dailyChartData.length > 0 && (
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-success" />
                  Faturamento Diário
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatBRLShort} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [formatBRL(value), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey={stats1.nome}
                      stroke={PROF_COLORS[0]}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: PROF_COLORS[0] }}
                    />
                    <Line
                      type="monotone"
                      dataKey={stats2.nome}
                      stroke={PROF_COLORS[1]}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: PROF_COLORS[1] }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Services comparison table */}
            {servicesComparison.length > 0 && (
              <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-card-border">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar size={18} className="text-accent" />
                    Comparação de Serviços
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-card-border text-muted">
                        <th className="text-left px-4 py-3 font-medium">Serviço</th>
                        <th className="text-center px-4 py-3 font-medium" style={{ color: PROF_COLORS[0] }}>
                          {stats1.nome.split(" ")[0]} (Qtd)
                        </th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: PROF_COLORS[0] }}>
                          Faturamento
                        </th>
                        <th className="text-center px-4 py-3 font-medium" style={{ color: PROF_COLORS[1] }}>
                          {stats2.nome.split(" ")[0]} (Qtd)
                        </th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: PROF_COLORS[1] }}>
                          Faturamento
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicesComparison.slice(0, 12).map((s) => (
                        <tr key={s.servico} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 font-medium">{s.servico}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className="inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-bold"
                              style={{
                                backgroundColor: s.qty1 >= s.qty2 && s.qty1 > 0 ? PROF_COLORS[0] + "20" : "transparent",
                                color: s.qty1 > 0 ? PROF_COLORS[0] : "var(--muted)",
                              }}
                            >
                              {s.qty1}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-success text-xs">
                            {s.total1 > 0 ? formatBRL(s.total1) : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className="inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-bold"
                              style={{
                                backgroundColor: s.qty2 >= s.qty1 && s.qty2 > 0 ? PROF_COLORS[1] + "20" : "transparent",
                                color: s.qty2 > 0 ? PROF_COLORS[1] : "var(--muted)",
                              }}
                            >
                              {s.qty2}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-success text-xs">
                            {s.total2 > 0 ? formatBRL(s.total2) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hours comparison */}
            {(stats1.horasPopulares.length > 0 || stats2.horasPopulares.length > 0) && (
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-accent" />
                  Horários Mais Atendidos
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={(() => {
                      const allHours = new Set([
                        ...stats1.horasPopulares.map((h) => h.hora),
                        ...stats2.horasPopulares.map((h) => h.hora),
                      ]);
                      return Array.from(allHours)
                        .sort((a, b) => parseInt(a) - parseInt(b))
                        .map((hora) => ({
                          hora,
                          [stats1.nome]: stats1.horasPopulares.find((h) => h.hora === hora)?.qty || 0,
                          [stats2.nome]: stats2.horasPopulares.find((h) => h.hora === hora)?.qty || 0,
                        }));
                    })()}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="hora" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey={stats1.nome} fill={PROF_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={stats2.nome} fill={PROF_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
