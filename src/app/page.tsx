"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  CreditCard,
  Scissors,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import DetailModal from "@/components/charts/DetailModal";
import {
  TOOLTIP_STYLE,
  AXIS_STYLE,
  GRID_STYLE,
  CATEGORICAL,
  STATUS_COLORS,
  formatBRL,
  formatBRLShort,
} from "@/components/charts/ChartColors";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import {
  calcularMetricas,
  agruparPorProfissional,
  agruparPorServico,
  agruparPorFormaPgto,
} from "@/lib/parser";
import type { Agendamento } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types for chart data
// ---------------------------------------------------------------------------

interface DailyChartItem {
  dia: string;
  label: string;
  valor: number;
  agendamentos: Agendamento[];
}

interface HourlyChartItem {
  hora: string;
  valor: number;
  agendamentos: Agendamento[];
}

interface StatusBarItem {
  name: string;
  value: number;
  color: string;
  agendamentos: Agendamento[];
}

interface ProfissionalChartItem {
  nome: string;
  faturamento: number;
  atendimentos: number;
  agendamentos: Agendamento[];
}

interface ServicoChartItem {
  servico: string;
  qty: number;
  total: number;
  agendamentos: Agendamento[];
}

interface PgtoChartItem {
  forma: string;
  total: number;
  qty: number;
}

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function buildDailyChart(agendamentos: Agendamento[]): DailyChartItem[] {
  const map = new Map<string, { valor: number; agendamentos: Agendamento[] }>();
  for (const a of agendamentos.filter((a) => a.status === "Realizado")) {
    const datePart = a.dataIni.split(" ")[0] || "";
    const entry = map.get(datePart) || { valor: 0, agendamentos: [] };
    entry.valor += a.valor;
    entry.agendamentos.push(a);
    map.set(datePart, entry);
  }
  return Array.from(map.entries())
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
}

function buildHourlyChart(agendamentos: Agendamento[]): HourlyChartItem[] {
  const map = new Map<string, { valor: number; agendamentos: Agendamento[] }>();
  for (const a of agendamentos.filter((a) => a.status === "Realizado")) {
    const h = a.hora.split(":")[0] + ":00";
    const entry = map.get(h) || { valor: 0, agendamentos: [] };
    entry.valor += a.valor;
    entry.agendamentos.push(a);
    map.set(h, entry);
  }
  return Array.from(map.entries())
    .map(([hora, data]) => ({ hora, ...data }))
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

function buildStatusData(agendamentos: Agendamento[]): StatusBarItem[] {
  const groups: Record<string, { color: string; list: Agendamento[] }> = {
    Realizados: { color: STATUS_COLORS.realizado, list: [] },
    Agendados: { color: STATUS_COLORS.agendado, list: [] },
    Cancelados: { color: STATUS_COLORS.cancelado, list: [] },
    Ausentes: { color: STATUS_COLORS.ausente, list: [] },
  };
  const statusMap: Record<string, string> = {
    Realizado: "Realizados",
    Agendado: "Agendados",
    Cancelado: "Cancelados",
    Ausente: "Ausentes",
  };
  for (const a of agendamentos) {
    const key = statusMap[a.status];
    if (key && groups[key]) groups[key].list.push(a);
  }
  return Object.entries(groups).map(([name, { color, list }]) => ({
    name,
    value: list.length,
    color,
    agendamentos: list,
  }));
}

function buildProfissionalChart(agendamentos: Agendamento[]): ProfissionalChartItem[] {
  const map = new Map<string, { faturamento: number; atendimentos: number; agendamentos: Agendamento[] }>();
  for (const a of agendamentos.filter((x) => x.status === "Realizado")) {
    const entry = map.get(a.profissional) || { faturamento: 0, atendimentos: 0, agendamentos: [] };
    entry.faturamento += a.valor;
    entry.atendimentos++;
    entry.agendamentos.push(a);
    map.set(a.profissional, entry);
  }
  return Array.from(map.entries())
    .map(([nome, data]) => ({ nome, ...data }))
    .sort((a, b) => b.faturamento - a.faturamento);
}

function buildServicoChart(agendamentos: Agendamento[]): ServicoChartItem[] {
  const map = new Map<string, { qty: number; total: number; agendamentos: Agendamento[] }>();
  for (const a of agendamentos.filter((x) => x.status === "Realizado")) {
    const entry = map.get(a.servico) || { qty: 0, total: 0, agendamentos: [] };
    entry.qty++;
    entry.total += a.valor;
    entry.agendamentos.push(a);
    map.set(a.servico, entry);
  }
  return Array.from(map.entries())
    .map(([servico, data]) => ({ servico, ...data }))
    .sort((a, b) => b.qty - a.qty);
}

function buildPgtoDonut(
  finFormas: { tipoPagamento: string; totalBruto: number }[] | undefined,
  agFormas: { forma: string; qty: number; total: number }[]
): PgtoChartItem[] {
  if (finFormas && finFormas.length > 0) {
    const items = finFormas
      .map((f) => ({ forma: f.tipoPagamento, total: f.totalBruto, qty: 1 }))
      .sort((a, b) => b.total - a.total);
    if (items.length <= 5) return items;
    const top4 = items.slice(0, 4);
    const rest = items.slice(4);
    const outrosTotal = rest.reduce((s, r) => s + r.total, 0);
    return [...top4, { forma: "Outros", total: outrosTotal, qty: rest.length }];
  }
  const items = agFormas
    .map((f) => ({ forma: f.forma, total: f.total, qty: f.qty }))
    .sort((a, b) => b.total - a.total);
  if (items.length <= 5) return items;
  const top4 = items.slice(0, 4);
  const rest = items.slice(4);
  const outrosTotal = rest.reduce((s, r) => s + r.total, 0);
  const outrosQty = rest.reduce((s, r) => s + r.qty, 0);
  return [...top4, { forma: "Outros", total: outrosTotal, qty: outrosQty }];
}

// ---------------------------------------------------------------------------
// Appointment list renderer for modals
// ---------------------------------------------------------------------------

function AppointmentList({ items }: { items: Agendamento[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Nenhum agendamento encontrado.</p>;
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-background">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{a.cliente}</p>
            <p className="text-xs text-muted truncate">
              {a.servico} &middot; {a.profissional}
            </p>
            <p className="text-xs text-muted">
              {a.hora} - {a.horaFim} &middot;{" "}
              <span
                className={
                  a.status === "Realizado"
                    ? "text-success"
                    : a.status === "Cancelado"
                      ? "text-purple-400"
                      : a.status === "Ausente"
                        ? "text-danger"
                        : "text-blue-400"
                }
              >
                {a.status}
              </span>
            </p>
          </div>
          <p className="font-semibold text-sm text-success whitespace-nowrap">
            {formatBRL(a.valor)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { agendamentos, loading, sessionActive, lastUpdate, refresh } =
    useAgendamentos({ autoRefreshMs: 60000 });
  const { data: finData } = useFinanceiro();

  const [modal, setModal] = useState<{ title: string; content: ReactNode } | null>(null);

  // Computed data
  const metricas = useMemo(() => calcularMetricas(agendamentos), [agendamentos]);
  const formasPgto = useMemo(() => agruparPorFormaPgto(agendamentos), [agendamentos]);

  const faturamentoBruto = finData?.resumo?.totalBruto || metricas.faturamentoRealizado;

  const dailyData = useMemo(() => buildDailyChart(agendamentos), [agendamentos]);
  const hourlyData = useMemo(() => buildHourlyChart(agendamentos), [agendamentos]);
  const statusData = useMemo(() => buildStatusData(agendamentos), [agendamentos]);
  const profData = useMemo(() => buildProfissionalChart(agendamentos), [agendamentos]);
  const servicoData = useMemo(() => buildServicoChart(agendamentos), [agendamentos]);
  const pgtoData = useMemo(
    () => buildPgtoDonut(finData?.formasPagamento, formasPgto),
    [finData?.formasPagamento, formasPgto]
  );

  const totalStatus = statusData.reduce((s, d) => s + d.value, 0);
  const pgtoTotal = pgtoData.reduce((s, d) => s + d.total, 0);

  // Modal helpers
  const openModal = (title: string, content: ReactNode) => setModal({ title, content });
  const closeModal = () => setModal(null);

  return (
    <>
      <Header
        title="Dashboard"
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Session warning */}
        {!sessionActive && !loading && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-center gap-3">
            <Clock size={20} className="text-warning shrink-0" />
            <div>
              <p className="text-sm font-medium">Sessao nao configurada</p>
              <p className="text-xs text-muted mt-0.5">
                Va em{" "}
                <a href="/configuracoes" className="text-accent underline">
                  Configuracoes
                </a>{" "}
                e cole o PHPSESSID do App Barber.
              </p>
            </div>
          </div>
        )}

        {sessionActive && loading && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Atualizando dados...</p>
          </div>
        )}

        {/* ============================================================= */}
        {/* HERO: Faturamento Bruto */}
        {/* ============================================================= */}
        <div className="bg-card-bg border border-card-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10">
            <DollarSign size={28} className="text-success" />
          </div>
          <div className="flex-1">
            <p className="text-muted text-sm">Faturamento Bruto</p>
            <p className="text-5xl font-bold mt-1 tracking-tight">{formatBRL(faturamentoBruto)}</p>
            <p className="text-muted text-sm mt-2">
              Ticket medio:{" "}
              <span className="text-foreground font-semibold">{formatBRL(metricas.ticketMedio)}</span>
              {metricas.faturamentoPrevisto > 0 && (
                <span className="ml-4">
                  Previsto:{" "}
                  <span className="text-accent font-semibold">
                    {formatBRL(metricas.faturamentoPrevisto)}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ============================================================= */}
        {/* KPI STAT TILES */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="cursor-pointer"
            onClick={() =>
              openModal(
                `Agendamentos (${metricas.totalAgendamentos})`,
                <AppointmentList items={agendamentos} />
              )
            }
          >
            <MetricCard
              title="Agendamentos"
              value={metricas.totalAgendamentos}
              subtitle={`${metricas.realizados} realizados, ${metricas.agendados} agendados`}
              icon={Calendar}
              color="accent"
            />
          </div>
          <div
            className="cursor-pointer"
            onClick={() =>
              openModal(
                `Realizados (${metricas.realizados})`,
                <AppointmentList
                  items={agendamentos.filter((a) => a.status === "Realizado")}
                />
              )
            }
          >
            <MetricCard
              title="Realizados"
              value={metricas.realizados}
              subtitle={`${formatBRL(metricas.faturamentoRealizado)} faturado`}
              icon={CheckCircle}
              color="success"
            />
          </div>
          <div
            className="cursor-pointer"
            onClick={() => {
              const unicos = agendamentos.filter(
                (a) => a.cliente !== "Sem Cadastro" && a.codCliente
              );
              const seen = new Set<string>();
              const deduped = unicos.filter((a) => {
                if (seen.has(a.codCliente)) return false;
                seen.add(a.codCliente);
                return true;
              });
              openModal(
                `Clientes Unicos (${deduped.length})`,
                <AppointmentList items={deduped} />
              );
            }}
          >
            <MetricCard
              title="Clientes Unicos"
              value={metricas.clientesUnicos}
              icon={Users}
              color="accent"
            />
          </div>
          <div
            className="cursor-pointer"
            onClick={() =>
              openModal(
                `Cancelados + Ausentes (${metricas.cancelados + metricas.ausentes})`,
                <AppointmentList
                  items={agendamentos.filter(
                    (a) => a.status === "Cancelado" || a.status === "Ausente"
                  )}
                />
              )
            }
          >
            <MetricCard
              title="Cancelados + Ausentes"
              value={metricas.cancelados + metricas.ausentes}
              subtitle={
                metricas.cancelados + metricas.ausentes > 0
                  ? `${metricas.cancelados} cancel. / ${metricas.ausentes} ausentes`
                  : undefined
              }
              icon={AlertTriangle}
              color={metricas.cancelados + metricas.ausentes > 0 ? "warning" : "success"}
            />
          </div>
        </div>

        {/* ============================================================= */}
        {/* ROW: Faturamento por Dia + Status dos Agendamentos */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Faturamento por Dia */}
          <div className="lg:col-span-2 bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-accent" />
              Faturamento por Dia
            </h3>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <CartesianGrid
                    vertical={false}
                    stroke={GRID_STYLE.stroke}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ ...AXIS_STYLE }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ ...AXIS_STYLE }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatBRLShort}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatBRL(Number(value)), "Faturamento"]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar
                    dataKey="valor"
                    fill={CATEGORICAL[0]}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: DailyChartItem) => {
                      openModal(
                        `Dia ${data.dia} - ${formatBRL(data.valor)}`,
                        <AppointmentList items={data.agendamentos} />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem dados</p>
            )}
          </div>

          {/* Status dos Agendamentos - Horizontal stacked bar */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-accent" />
              Status dos Agendamentos
            </h3>
            {totalStatus > 0 ? (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="flex rounded-lg overflow-hidden h-10">
                  {statusData.map((s) => {
                    const pct = (s.value / totalStatus) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-center text-xs font-semibold text-white cursor-pointer transition-opacity hover:opacity-80"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: s.color,
                          minWidth: pct > 0 ? "24px" : 0,
                        }}
                        title={`${s.name}: ${s.value}`}
                        onClick={() =>
                          openModal(
                            `${s.name} (${s.value})`,
                            <AppointmentList items={s.agendamentos} />
                          )
                        }
                      >
                        {pct >= 10 ? s.value : ""}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  {statusData.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between cursor-pointer hover:bg-background rounded-lg px-2 py-1.5 transition-colors"
                      onClick={() =>
                        openModal(
                          `${s.name} (${s.value})`,
                          <AppointmentList items={s.agendamentos} />
                        )
                      }
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-sm">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{s.value}</span>
                        <span className="text-xs text-muted">
                          ({totalStatus > 0 ? ((s.value / totalStatus) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem dados</p>
            )}
          </div>
        </div>

        {/* ============================================================= */}
        {/* Faturamento por Horario */}
        {/* ============================================================= */}
        <div className="bg-card-bg border border-card-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-accent" />
            Faturamento por Horario
          </h3>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hourlyData}>
                <CartesianGrid
                  vertical={false}
                  stroke={GRID_STYLE.stroke}
                />
                <XAxis
                  dataKey="hora"
                  tick={{ ...AXIS_STYLE }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ ...AXIS_STYLE }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatBRLShort}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatBRL(Number(value)), "Faturamento"]}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke={CATEGORICAL[0]}
                  strokeWidth={2}
                  dot={{ r: 5, fill: CATEGORICAL[0], cursor: "pointer" }}
                  activeDot={{
                    r: 7,
                    onClick: (_: unknown, payload: { payload: HourlyChartItem }) => {
                      const item = payload.payload;
                      openModal(
                        `Horario ${item.hora} - ${formatBRL(item.valor)}`,
                        <AppointmentList items={item.agendamentos} />
                      );
                    },
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted py-10 text-center">Sem dados</p>
          )}
        </div>

        {/* ============================================================= */}
        {/* ROW: Top Profissionais + Top Servicos + Formas de Pagamento */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Profissionais */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-accent" />
              Top Profissionais
            </h3>
            {profData.length > 0 ? (
              <ResponsiveContainer width="100%" height={profData.length * 48 + 20}>
                <BarChart data={profData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid
                    horizontal={false}
                    stroke={GRID_STYLE.stroke}
                  />
                  <XAxis
                    type="number"
                    tick={{ ...AXIS_STYLE }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatBRLShort}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={{ ...AXIS_STYLE }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatBRL(Number(value)), "Faturamento"]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar
                    dataKey="faturamento"
                    fill={CATEGORICAL[2]}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data: ProfissionalChartItem) => {
                      openModal(
                        `${data.nome} - ${data.atendimentos} atendimentos`,
                        <AppointmentList items={data.agendamentos} />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem dados</p>
            )}
          </div>

          {/* Top Servicos */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Scissors size={18} className="text-accent" />
              Top Servicos
            </h3>
            {servicoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={servicoData.length * 48 + 20}>
                <BarChart data={servicoData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid
                    horizontal={false}
                    stroke={GRID_STYLE.stroke}
                  />
                  <XAxis
                    type="number"
                    tick={{ ...AXIS_STYLE }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="servico"
                    tick={{ ...AXIS_STYLE }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [
                      name === "qty" ? `${value}x` : formatBRL(value),
                      name === "qty" ? "Quantidade" : "Total",
                    ]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar
                    dataKey="qty"
                    fill={CATEGORICAL[1]}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data: ServicoChartItem) => {
                      openModal(
                        `${data.servico} (${data.qty}x)`,
                        <AppointmentList items={data.agendamentos} />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem dados</p>
            )}
          </div>

          {/* Formas de Pagamento - Donut */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-accent" />
              Formas de Pagamento
            </h3>
            {pgtoData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pgtoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="total"
                      nameKey="forma"
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(data: PgtoChartItem) => {
                        openModal(
                          `${data.forma} - ${formatBRL(data.total)}`,
                          <div className="space-y-2">
                            <div className="flex justify-between p-3 rounded-lg bg-background">
                              <span className="text-sm">Valor total</span>
                              <span className="text-sm font-semibold text-success">
                                {formatBRL(data.total)}
                              </span>
                            </div>
                            <div className="flex justify-between p-3 rounded-lg bg-background">
                              <span className="text-sm">Percentual</span>
                              <span className="text-sm font-semibold">
                                {pgtoTotal > 0 ? ((data.total / pgtoTotal) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    >
                      {pgtoData.map((_, idx) => (
                        <Cell key={idx} fill={CATEGORICAL[idx % CATEGORICAL.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [formatBRL(value), "Total"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="w-full space-y-1.5 mt-2">
                  {pgtoData.map((p, idx) => (
                    <div
                      key={p.forma}
                      className="flex items-center justify-between cursor-pointer hover:bg-background rounded-lg px-2 py-1 transition-colors"
                      onClick={() =>
                        openModal(
                          `${p.forma} - ${formatBRL(p.total)}`,
                          <div className="space-y-2">
                            <div className="flex justify-between p-3 rounded-lg bg-background">
                              <span className="text-sm">Valor total</span>
                              <span className="text-sm font-semibold text-success">
                                {formatBRL(p.total)}
                              </span>
                            </div>
                            <div className="flex justify-between p-3 rounded-lg bg-background">
                              <span className="text-sm">Percentual</span>
                              <span className="text-sm font-semibold">
                                {pgtoTotal > 0 ? ((p.total / pgtoTotal) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </div>
                        )
                      }
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CATEGORICAL[idx % CATEGORICAL.length] }}
                        />
                        <span className="text-sm truncate">{p.forma}</span>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {formatBRL(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem dados</p>
            )}
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <DetailModal open={modal !== null} onClose={closeModal} title={modal?.title || ""}>
        {modal?.content}
      </DetailModal>
    </>
  );
}
