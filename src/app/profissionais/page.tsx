"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Scissors,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import DetailModal from "@/components/charts/DetailModal";
import {
  CATEGORICAL,
  TOOLTIP_STYLE,
  AXIS_STYLE,
  formatBRL,
  formatBRLShort,
} from "@/components/charts/ChartColors";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import { useDateRange } from "@/hooks/useDateRange";
import { agruparPorProfissional } from "@/lib/parser";
import type { Agendamento } from "@/lib/types";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const GRID_STROKE = "#e5e7eb20";

type Tab = "cadastro" | "desempenho" | "comparativo";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AppointmentList({ items }: { items: Agendamento[] }) {
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between text-sm py-2 border-b border-card-border last:border-0"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{a.servico}</p>
            <p className="text-xs text-muted truncate">
              {a.cliente} - {a.hora}
            </p>
          </div>
          <div className="text-right ml-3 shrink-0">
            <p className="font-semibold text-success">{formatBRL(a.valor)}</p>
            <p className="text-xs text-muted">{a.status}</p>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          Nenhum agendamento encontrado.
        </p>
      )}
    </div>
  );
}

function DeltaBadge({ current, previous, format = "number" }: { current: number; previous: number; format?: "number" | "currency" | "percent" }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted">-</span>;
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100) : current > 0 ? 100 : 0;
  const isPositive = diff > 0;
  const isZero = diff === 0;

  const Icon = isZero ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  const color = isZero ? "text-muted" : isPositive ? "text-success" : "text-danger";
  const bg = isZero ? "bg-muted/10" : isPositive ? "bg-success/10" : "bg-danger/10";

  let label = "";
  if (format === "currency") label = `${isPositive ? "+" : ""}${formatBRL(diff)}`;
  else if (format === "percent") label = `${isPositive ? "+" : ""}${pct.toFixed(1)}%`;
  else label = `${isPositive ? "+" : ""}${diff}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md font-medium ${color} ${bg}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

export default function ProfissionaisPage() {
  const { agendamentos, loading, sessionActive, lastUpdate, refresh } =
    useAgendamentos({ autoRefreshMs: 0 });
  const { dataIni, dataFim } = useDateRange();

  const [tab, setTab] = useState<Tab>("cadastro");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalItems, setModalItems] = useState<Agendamento[]>([]);

  // Fetch previous period data for comparison
  const [prevAgendamentos, setPrevAgendamentos] = useState<Agendamento[]>([]);
  const [prevLoading, setPrevLoading] = useState(false);

  const prevPeriod = useMemo(() => {
    const ini = new Date(dataIni);
    const fim = new Date(dataFim);
    const diffMs = fim.getTime() - ini.getTime();
    const prevFim = new Date(ini.getTime() - 86400000);
    const prevIni = new Date(prevFim.getTime() - diffMs);
    return {
      dataIni: prevIni.toISOString().split("T")[0],
      dataFim: prevFim.toISOString().split("T")[0],
    };
  }, [dataIni, dataFim]);

  const fetchPrev = useCallback(async () => {
    setPrevLoading(true);
    try {
      const res = await fetch(
        `/api/agendamentos?dataIni=${prevPeriod.dataIni}&dataFim=${prevPeriod.dataFim}`
      );
      if (res.ok) {
        const data: Agendamento[] = await res.json();
        setPrevAgendamentos(data.filter((a) => a.servico !== "Bloqueado"));
      }
    } catch {
      // ignore
    } finally {
      setPrevLoading(false);
    }
  }, [prevPeriod.dataIni, prevPeriod.dataFim]);

  useEffect(() => {
    if (tab === "comparativo") fetchPrev();
  }, [tab, fetchPrev]);

  function openModal(title: string, items: Agendamento[]) {
    setModalTitle(title);
    setModalItems(items);
    setModalOpen(true);
  }

  const profissionais = useMemo(
    () => agruparPorProfissional(agendamentos),
    [agendamentos]
  );
  const prevProfissionais = useMemo(
    () => agruparPorProfissional(prevAgendamentos),
    [prevAgendamentos]
  );

  const totalFaturamento = useMemo(
    () => profissionais.reduce((s, p) => s + p.faturamento, 0),
    [profissionais]
  );
  const totalAtendimentos = useMemo(
    () => profissionais.reduce((s, p) => s + p.atendimentos, 0),
    [profissionais]
  );

  // --- Chart data ---
  const rankingData = useMemo(
    () =>
      profissionais.map((p, i) => ({
        nome: p.nome,
        faturamento: p.faturamento,
        fill: CATEGORICAL[i % CATEGORICAL.length],
      })),
    [profissionais]
  );

  const atendimentosData = useMemo(
    () =>
      profissionais.map((p, i) => ({
        nome: p.nome.split(" ")[0],
        fullName: p.nome,
        atendimentos: p.atendimentos,
        fill: CATEGORICAL[i % CATEGORICAL.length],
      })),
    [profissionais]
  );

  const faturamentoData = useMemo(
    () =>
      profissionais.map((p, i) => ({
        nome: p.nome.split(" ")[0],
        fullName: p.nome,
        faturamento: p.faturamento,
        fill: CATEGORICAL[i % CATEGORICAL.length],
      })),
    [profissionais]
  );

  // Services per professional
  const servicosPorProf = useMemo(() => {
    const result: Record<string, { servico: string; qty: number; total: number }[]> = {};
    for (const prof of profissionais) {
      const profAgs = agendamentos.filter(
        (a) => a.profissional === prof.nome && a.status === "Realizado"
      );
      const map = new Map<string, { qty: number; total: number }>();
      for (const a of profAgs) {
        const entry = map.get(a.servico) || { qty: 0, total: 0 };
        entry.qty++;
        entry.total += a.valor;
        map.set(a.servico, entry);
      }
      result[prof.nome] = Array.from(map.entries())
        .map(([servico, data]) => ({ servico, ...data }))
        .sort((a, b) => b.qty - a.qty);
    }
    return result;
  }, [agendamentos, profissionais]);

  // Day of week distribution
  const diaSemanaData = useMemo(() => {
    const top3 = profissionais.slice(0, 3).map((p) => p.nome);
    const dayMap: Record<string, Record<string, number>> = {};
    for (const label of DIAS_SEMANA) {
      dayMap[label] = {};
      for (const name of top3) dayMap[label][name] = 0;
      dayMap[label]["Outros"] = 0;
    }

    for (const a of agendamentos) {
      if (a.status !== "Realizado") continue;
      const dateParts = a.dataIni.split(" ")[0].split("/");
      if (dateParts.length < 3) continue;
      const d = new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]));
      if (isNaN(d.getTime())) continue;
      const dayLabel = DIAS_SEMANA[d.getDay()];
      if (top3.includes(a.profissional)) {
        dayMap[dayLabel][a.profissional] = (dayMap[dayLabel][a.profissional] || 0) + 1;
      } else {
        dayMap[dayLabel]["Outros"] = (dayMap[dayLabel]["Outros"] || 0) + 1;
      }
    }

    return DIAS_SEMANA.map((label) => ({ dia: label, ...dayMap[label] }));
  }, [agendamentos, profissionais]);

  const stackedKeys = useMemo(() => {
    const top3 = profissionais.slice(0, 3).map((p) => p.nome);
    return profissionais.length > 3 ? [...top3, "Outros"] : top3;
  }, [profissionais]);

  // Sparkline data per professional
  const sparklineByProf = useMemo(() => {
    const result: Record<string, { day: string; value: number }[]> = {};
    for (const prof of profissionais) {
      const dayMap = new Map<string, number>();
      const profAgs = agendamentos.filter(
        (a) => a.profissional === prof.nome && a.status === "Realizado"
      );
      for (const a of profAgs) {
        const dateStr = a.dataIni.split(" ")[0];
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + a.valor);
      }
      const sorted = Array.from(dayMap.entries())
        .map(([day, value]) => ({ day, value }))
        .sort((a, b) => {
          const pa = a.day.split("/");
          const pb = b.day.split("/");
          const da = new Date(Number(pa[2]), Number(pa[1]) - 1, Number(pa[0]));
          const db = new Date(Number(pb[2]), Number(pb[1]) - 1, Number(pb[0]));
          return da.getTime() - db.getTime();
        })
        .slice(-30);
      result[prof.nome] = sorted;
    }
    return result;
  }, [agendamentos, profissionais]);

  // --- Comparativo data ---
  const comparativoData = useMemo(() => {
    const allNames = new Set([
      ...profissionais.map((p) => p.nome),
      ...prevProfissionais.map((p) => p.nome),
    ]);

    return Array.from(allNames).map((nome) => {
      const curr = profissionais.find((p) => p.nome === nome);
      const prev = prevProfissionais.find((p) => p.nome === nome);

      const currAtend = curr?.atendimentos || 0;
      const prevAtend = prev?.atendimentos || 0;
      const currFat = curr?.faturamento || 0;
      const prevFat = prev?.faturamento || 0;
      const currTM = currAtend > 0 ? currFat / currAtend : 0;
      const prevTM = prevAtend > 0 ? prevFat / prevAtend : 0;

      // Services breakdown
      const currServicos = agendamentos.filter(
        (a) => a.profissional === nome && a.status === "Realizado"
      );
      const prevServicos = prevAgendamentos.filter(
        (a) => a.profissional === nome && a.status === "Realizado"
      );

      const currServiceMap = new Map<string, number>();
      for (const a of currServicos) currServiceMap.set(a.servico, (currServiceMap.get(a.servico) || 0) + 1);
      const prevServiceMap = new Map<string, number>();
      for (const a of prevServicos) prevServiceMap.set(a.servico, (prevServiceMap.get(a.servico) || 0) + 1);

      const allServicos = new Set([...currServiceMap.keys(), ...prevServiceMap.keys()]);
      const servicosComp = Array.from(allServicos)
        .map((s) => ({
          servico: s,
          atual: currServiceMap.get(s) || 0,
          anterior: prevServiceMap.get(s) || 0,
        }))
        .sort((a, b) => b.atual - a.atual)
        .slice(0, 6);

      // Cancelamentos
      const currCancel = agendamentos.filter((a) => a.profissional === nome && a.status === "Cancelado").length;
      const prevCancel = prevAgendamentos.filter((a) => a.profissional === nome && a.status === "Cancelado").length;
      const currAusente = agendamentos.filter((a) => a.profissional === nome && a.status === "Ausente").length;
      const prevAusente = prevAgendamentos.filter((a) => a.profissional === nome && a.status === "Ausente").length;

      return {
        nome,
        currAtend, prevAtend,
        currFat, prevFat,
        currTM, prevTM,
        currCancel, prevCancel,
        currAusente, prevAusente,
        servicosComp,
      };
    }).sort((a, b) => b.currFat - a.currFat);
  }, [profissionais, prevProfissionais, agendamentos, prevAgendamentos]);

  // Comparativo chart data
  const compChartData = useMemo(() =>
    comparativoData.map((p, i) => ({
      nome: p.nome.split(" ")[0],
      fullName: p.nome,
      atual: p.currAtend,
      anterior: p.prevAtend,
      fill: CATEGORICAL[i % CATEGORICAL.length],
    })),
    [comparativoData]
  );

  const compFatChartData = useMemo(() =>
    comparativoData.map((p, i) => ({
      nome: p.nome.split(" ")[0],
      fullName: p.nome,
      atual: p.currFat,
      anterior: p.prevFat,
      fill: CATEGORICAL[i % CATEGORICAL.length],
    })),
    [comparativoData]
  );

  const prevPeriodLabel = useMemo(() => {
    const ini = new Date(prevPeriod.dataIni);
    const fim = new Date(prevPeriod.dataFim);
    return `${ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }, [prevPeriod]);

  const currPeriodLabel = useMemo(() => {
    const ini = new Date(dataIni);
    const fim = new Date(dataFim);
    return `${ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }, [dataIni, dataFim]);

  return (
    <>
      <Header
        title="Profissionais"
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading || prevLoading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-card-bg border border-card-border rounded-lg p-1 w-fit">
          {([
            { key: "cadastro" as Tab, label: "Cadastro" },
            { key: "desempenho" as Tab, label: "Desempenho" },
            { key: "comparativo" as Tab, label: "Comparativo" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent text-sidebar-bg"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Faturamento Total"
            value={formatBRL(totalFaturamento)}
            icon={DollarSign}
            color="success"
          />
          <MetricCard
            title="Profissionais Ativos"
            value={profissionais.length}
            icon={Users}
            color="accent"
          />
          <MetricCard
            title="Total Atendimentos"
            value={totalAtendimentos}
            icon={Calendar}
            color="accent"
          />
          <MetricCard
            title="Ticket Medio Geral"
            value={formatBRL(totalAtendimentos > 0 ? totalFaturamento / totalAtendimentos : 0)}
            icon={TrendingUp}
            color="accent"
          />
        </div>

        {/* ============ CADASTRO TAB ============ */}
        {tab === "cadastro" && profissionais.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profissionais.map((prof, i) => {
              const servicos = (servicosPorProf[prof.nome] || []).slice(0, 5);
              const ticketMedio = prof.atendimentos > 0 ? prof.faturamento / prof.atendimentos : 0;
              const sparkData = sparklineByProf[prof.nome] || [];
              const profColor = CATEGORICAL[i % CATEGORICAL.length];
              const totalAgs = agendamentos.filter((a) => a.profissional === prof.nome).length;
              const cancelados = agendamentos.filter((a) => a.profissional === prof.nome && a.status === "Cancelado").length;
              const ausentes = agendamentos.filter((a) => a.profissional === prof.nome && a.status === "Ausente").length;
              const taxaRealizacao = totalAgs > 0 ? ((prof.atendimentos / totalAgs) * 100) : 0;

              return (
                <div
                  key={i}
                  className="bg-card-bg border border-card-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer"
                  onClick={() => {
                    const items = agendamentos.filter((a) => a.profissional === prof.nome);
                    openModal(`Detalhes - ${prof.nome}`, items);
                  }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shrink-0"
                      style={{ backgroundColor: profColor + "22", color: profColor }}
                    >
                      {getInitials(prof.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg truncate">{prof.nome}</h4>
                      <p className="text-xs text-muted">
                        <Scissors size={12} className="inline mr-1" />
                        {prof.atendimentos} cortes realizados
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted">Faturamento</p>
                      <p className="font-bold text-success">{formatBRL(prof.faturamento)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted">Ticket Medio</p>
                      <p className="font-bold">{formatBRL(ticketMedio)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted">Taxa Realizacao</p>
                      <p className="font-bold">{taxaRealizacao.toFixed(0)}%</p>
                    </div>
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted">Cancel. / Ausentes</p>
                      <p className="font-bold text-danger">{cancelados} / {ausentes}</p>
                    </div>
                  </div>

                  {/* Sparkline */}
                  {sparkData.length > 1 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted mb-1">Faturamento diario</p>
                      <ResponsiveContainer width="100%" height={40}>
                        <LineChart data={sparkData}>
                          <Line type="monotone" dataKey="value" stroke={profColor} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Services */}
                  {servicos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {servicos.map((s, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-background text-muted border border-card-border">
                          {s.servico} ({s.qty})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ============ DESEMPENHO TAB ============ */}
        {tab === "desempenho" && profissionais.length > 0 && (
          <>
            {/* Ranking */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Ranking de Faturamento</h3>
              <ResponsiveContainer width="100%" height={profissionais.length * 52 + 20}>
                <BarChart data={rankingData} layout="vertical" margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                  <XAxis type="number" tickFormatter={formatBRLShort} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="nome" width={120} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatBRL(Number(value)), "Faturamento"]} cursor={{ fill: "#ffffff08" }} />
                  <Bar dataKey="faturamento" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(_entry) => {
                      const entry = _entry as unknown as { nome: string };
                      openModal(`Agendamentos - ${entry.nome}`, agendamentos.filter((a) => a.profissional === entry.nome));
                    }}
                    label={{ position: "right", formatter: (v: unknown) => formatBRLShort(Number(v)), fill: "#6b7280", fontSize: 11 }}
                  >
                    {rankingData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Atendimentos vs Faturamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Atendimentos por Profissional</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={atendimentosData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="nome" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [Number(value), "Atendimentos"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      cursor={{ fill: "#ffffff08" }} />
                    <Bar dataKey="atendimentos" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(_entry) => {
                        const entry = _entry as unknown as { fullName: string };
                        openModal(`Atendimentos - ${entry.fullName}`, agendamentos.filter((a) => a.profissional === entry.fullName && a.status === "Realizado"));
                      }}>
                      {atendimentosData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Faturamento por Profissional</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={faturamentoData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="nome" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatBRLShort} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatBRL(Number(value)), "Faturamento"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      cursor={{ fill: "#ffffff08" }} />
                    <Bar dataKey="faturamento" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(_entry) => {
                        const entry = _entry as unknown as { fullName: string };
                        openModal(`Faturamento - ${entry.fullName}`, agendamentos.filter((a) => a.profissional === entry.fullName && a.status === "Realizado"));
                      }}>
                      {faturamentoData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Servicos por Profissional */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Servicos por Profissional</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profissionais.map((prof, pi) => {
                  const servicos = (servicosPorProf[prof.nome] || []).slice(0, 6);
                  if (servicos.length === 0) return null;
                  const chartData = servicos.map((s) => ({
                    servico: s.servico.length > 18 ? s.servico.slice(0, 18) + "..." : s.servico,
                    fullServico: s.servico, qty: s.qty, total: s.total, profNome: prof.nome,
                  }));
                  return (
                    <div key={pi}>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: CATEGORICAL[pi % CATEGORICAL.length] }} />
                        {prof.nome}
                      </p>
                      <ResponsiveContainer width="100%" height={servicos.length * 34 + 10}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                          <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis type="category" dataKey="servico" width={140} tick={{ ...AXIS_STYLE, fontSize: 11 }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE}
                            formatter={(value, name) => { if (name === "qty") return [Number(value), "Quantidade"]; return [Number(value), name as string]; }}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullServico || label}
                            cursor={{ fill: "#ffffff08" }} />
                          <Bar dataKey="qty" fill={CATEGORICAL[pi % CATEGORICAL.length]} radius={[0, 4, 4, 0]} cursor="pointer"
                            label={{ position: "right", fill: "#6b7280", fontSize: 11 }}
                            onClick={(_entry) => {
                              const entry = _entry as unknown as { profNome: string; fullServico: string };
                              openModal(`${entry.fullServico} - ${entry.profNome}`, agendamentos.filter((a) => a.profissional === entry.profNome && a.servico === entry.fullServico && a.status === "Realizado"));
                            }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribuicao por Dia da Semana */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Distribuicao por Dia da Semana</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={diaSemanaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                  <XAxis dataKey="dia" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#ffffff08" }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
                  {stackedKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a"
                      fill={key === "Outros" ? "#6b7280" : CATEGORICAL[i % CATEGORICAL.length]}
                      radius={i === stackedKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ============ COMPARATIVO TAB ============ */}
        {tab === "comparativo" && (
          <>
            <div className="bg-card-bg border border-card-border rounded-xl p-4 text-sm text-muted">
              Comparando <span className="font-medium text-foreground">{currPeriodLabel}</span> (atual) com{" "}
              <span className="font-medium text-foreground">{prevPeriodLabel}</span> (anterior)
            </div>

            {comparativoData.length > 0 && (
              <>
                {/* Grouped bar charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-card-bg border border-card-border rounded-xl p-5">
                    <h3 className="font-semibold mb-4">Atendimentos: Atual vs Anterior</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={compChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                        <XAxis dataKey="nome" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="atual" name="Atual" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="anterior" name="Anterior" fill={CATEGORICAL[0] + "55"} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-card-bg border border-card-border rounded-xl p-5">
                    <h3 className="font-semibold mb-4">Faturamento: Atual vs Anterior</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={compFatChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                        <XAxis dataKey="nome" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatBRLShort} />
                        <Tooltip contentStyle={TOOLTIP_STYLE}
                          formatter={(value) => [formatBRL(Number(value)), ""]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="atual" name="Atual" fill={CATEGORICAL[2]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="anterior" name="Anterior" fill={CATEGORICAL[2] + "55"} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Professional comparison cards */}
                <div className="space-y-4">
                  {comparativoData.map((prof, i) => {
                    const profColor = CATEGORICAL[i % CATEGORICAL.length];
                    return (
                      <div key={prof.nome} className="bg-card-bg border border-card-border rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                            style={{ backgroundColor: profColor + "22", color: profColor }}
                          >
                            {getInitials(prof.nome)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{prof.nome}</h4>
                          </div>
                        </div>

                        {/* Metrics comparison grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-xs text-muted mb-1">Atendimentos</p>
                            <p className="font-bold text-lg">{prof.currAtend}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted">era {prof.prevAtend}</span>
                              <DeltaBadge current={prof.currAtend} previous={prof.prevAtend} />
                            </div>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-xs text-muted mb-1">Faturamento</p>
                            <p className="font-bold text-lg text-success">{formatBRLShort(prof.currFat)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted">era {formatBRLShort(prof.prevFat)}</span>
                              <DeltaBadge current={prof.currFat} previous={prof.prevFat} format="percent" />
                            </div>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-xs text-muted mb-1">Ticket Medio</p>
                            <p className="font-bold text-lg">{formatBRL(prof.currTM)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted">era {formatBRL(prof.prevTM)}</span>
                              <DeltaBadge current={prof.currTM} previous={prof.prevTM} format="currency" />
                            </div>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-xs text-muted mb-1">Cancelamentos</p>
                            <p className="font-bold text-lg">{prof.currCancel}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted">era {prof.prevCancel}</span>
                              {prof.currCancel <= prof.prevCancel ? (
                                <span className="text-xs text-success">
                                  {prof.currCancel < prof.prevCancel ? <TrendingDown size={12} className="inline" /> : null}
                                </span>
                              ) : (
                                <span className="text-xs text-danger"><TrendingUp size={12} className="inline" /></span>
                              )}
                            </div>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-xs text-muted mb-1">Ausentes</p>
                            <p className="font-bold text-lg">{prof.currAusente}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted">era {prof.prevAusente}</span>
                            </div>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-xs text-muted mb-1">Media/dia</p>
                            <p className="font-bold text-lg">
                              {(() => {
                                const ini = new Date(dataIni);
                                const fim = new Date(dataFim);
                                const days = Math.max(1, Math.ceil((fim.getTime() - ini.getTime()) / 86400000));
                                return (prof.currAtend / days).toFixed(1);
                              })()}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted">
                                era {(() => {
                                  const ini = new Date(prevPeriod.dataIni);
                                  const fim = new Date(prevPeriod.dataFim);
                                  const days = Math.max(1, Math.ceil((fim.getTime() - ini.getTime()) / 86400000));
                                  return (prof.prevAtend / days).toFixed(1);
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Services comparison */}
                        {prof.servicosComp.length > 0 && (
                          <div>
                            <p className="text-xs text-muted mb-2 font-medium">Servicos</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {prof.servicosComp.map((s) => (
                                <div key={s.servico} className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                  <span className="text-sm truncate flex-1">{s.servico}</span>
                                  <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <span className="text-sm font-medium">{s.atual}x</span>
                                    <DeltaBadge current={s.atual} previous={s.anterior} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {comparativoData.length === 0 && !loading && !prevLoading && (
              <p className="text-sm text-muted text-center py-8">Sem dados para comparar.</p>
            )}
          </>
        )}

        {profissionais.length === 0 && !loading && (
          <p className="text-sm text-muted text-center py-8">Sem dados no periodo selecionado.</p>
        )}
      </main>

      <DetailModal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        <AppointmentList items={modalItems} />
      </DetailModal>
    </>
  );
}
