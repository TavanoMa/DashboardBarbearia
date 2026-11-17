"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
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
  ChevronLeft,
  ChevronRight,
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
import { useOcultarValores } from "@/lib/ocultar";
import { useStore } from "@/hooks/useStore";
import {
  calcularMetricas,
  agruparPorServico,
  agruparPorFormaPgto,
} from "@/lib/parser";
import type {
  Agendamento,
  FinanceiroResumo,
  FormaPagamentoResumo,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Dados do dia — fetch direto, fora do contexto global de datas
// ---------------------------------------------------------------------------

interface FinanceiroPayload {
  resumo: FinanceiroResumo;
  formasPagamento: FormaPagamentoResumo[];
}

function useDadosDoDia(dia: string, store: string | undefined) {
  const [ag, setAg] = useState<Agendamento[]>([]);
  const [fin, setFin] = useState<FinanceiroPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [rAg, rFin] = await Promise.all([
        fetch(`/api/agendamentos?dataIni=${dia}&dataFim=${dia}&store=${store}`),
        fetch(`/api/financeiro?dataIni=${dia}&dataFim=${dia}&store=${store}`),
      ]);
      const ok = rAg.ok;
      const dataAg = rAg.ok ? ((await rAg.json()) as Agendamento[]) : [];
      const dataFin = rFin.ok ? ((await rFin.json()) as FinanceiroPayload) : null;
      setAg(dataAg.filter((a) => a.servico !== "Bloqueado"));
      setFin(dataFin);
      if (ok) {
        setSessionActive(true);
        setLastUpdate(new Date());
      } else {
        const rCfg = await fetch("/api/config");
        const cfg = await rCfg.json();
        setSessionActive(!!cfg.configured);
      }
    } finally {
      setLoading(false);
    }
  }, [dia, store]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { agendamentos: ag, financeiro: fin, loading, sessionActive, lastUpdate, refresh: fetchData };
}

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarDias(iso: string, d: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const data = new Date(y, m - 1, dd + d);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function formatarDiaLongo(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

interface HourlyItem {
  hora: string;
  valor: number;
  qtd: number;
  agendamentos: Agendamento[];
}

function buildHourly(ag: Agendamento[]): HourlyItem[] {
  const map = new Map<string, HourlyItem>();
  for (const a of ag.filter((x) => x.status === "Realizado")) {
    const h = (a.hora.split(":")[0] || "00") + ":00";
    const e = map.get(h) || { hora: h, valor: 0, qtd: 0, agendamentos: [] };
    e.valor += a.valor;
    e.qtd++;
    e.agendamentos.push(a);
    map.set(h, e);
  }
  return Array.from(map.values()).sort((a, b) => a.hora.localeCompare(b.hora));
}

interface ProfItem {
  nome: string;
  atendimentos: number;
  faturamento: number;
  ticketMedio: number;
  agendamentos: Agendamento[];
}

function buildProf(ag: Agendamento[]): ProfItem[] {
  const map = new Map<string, ProfItem>();
  for (const a of ag.filter((x) => x.status === "Realizado")) {
    const e = map.get(a.profissional) || {
      nome: a.profissional,
      atendimentos: 0,
      faturamento: 0,
      ticketMedio: 0,
      agendamentos: [],
    };
    e.atendimentos++;
    e.faturamento += a.valor;
    e.agendamentos.push(a);
    map.set(a.profissional, e);
  }
  const arr = Array.from(map.values());
  for (const p of arr) p.ticketMedio = p.atendimentos > 0 ? p.faturamento / p.atendimentos : 0;
  return arr.sort((a, b) => b.faturamento - a.faturamento);
}

function buildStatus(ag: Agendamento[]) {
  const groups: Record<string, { color: string; list: Agendamento[] }> = {
    Realizados: { color: STATUS_COLORS.realizado, list: [] },
    Agendados: { color: STATUS_COLORS.agendado, list: [] },
    Cancelados: { color: STATUS_COLORS.cancelado, list: [] },
    Ausentes: { color: STATUS_COLORS.ausente, list: [] },
  };
  const key: Record<string, string> = {
    Realizado: "Realizados",
    Agendado: "Agendados",
    Cancelado: "Cancelados",
    Ausente: "Ausentes",
  };
  for (const a of ag) {
    const k = key[a.status];
    if (k && groups[k]) groups[k].list.push(a);
  }
  return Object.entries(groups).map(([name, g]) => ({
    name,
    value: g.list.length,
    color: g.color,
    agendamentos: g.list,
  }));
}

function AppointmentList({ items }: { items: Agendamento[] }) {
  if (items.length === 0)
    return <p className="text-sm text-muted">Nenhum agendamento encontrado.</p>;
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-background">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{a.cliente}</p>
            <p className="text-xs text-muted truncate">
              {a.servico} · {a.profissional}
            </p>
            <p className="text-xs text-muted">
              {a.hora} - {a.horaFim} ·{" "}
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
// Página
// ---------------------------------------------------------------------------

export default function DiaPage() {
  const ocultarKey = useOcultarValores() ? "oculto" : "visivel";
  const { currentStore } = useStore();
  const hoje = hojeIso();
  const [dia, setDia] = useState<string>(hoje);
  const ehHoje = dia === hoje;

  const { agendamentos, financeiro, loading, sessionActive, lastUpdate, refresh } =
    useDadosDoDia(dia, currentStore);

  const [modal, setModal] = useState<{ title: string; content: ReactNode } | null>(null);
  const openModal = (title: string, content: ReactNode) => setModal({ title, content });
  const closeModal = () => setModal(null);

  const metricas = useMemo(() => calcularMetricas(agendamentos), [agendamentos]);
  const hourly = useMemo(() => buildHourly(agendamentos), [agendamentos]);
  const prof = useMemo(() => buildProf(agendamentos), [agendamentos]);
  const statusData = useMemo(() => buildStatus(agendamentos), [agendamentos]);
  const servicoData = useMemo(() => agruparPorServico(agendamentos), [agendamentos]);
  const formasAg = useMemo(() => agruparPorFormaPgto(agendamentos), [agendamentos]);

  // Faturamento bruto: prefere o financeiro (bate com o AppBarber), senão soma dos realizados
  const faturamentoBruto = useMemo(() => {
    if (financeiro?.formasPagamento && financeiro.formasPagamento.length > 0) {
      return financeiro.formasPagamento.reduce((s, f) => s + f.totalBruto, 0);
    }
    return financeiro?.resumo?.totalBruto || metricas.faturamentoRealizado;
  }, [financeiro, metricas.faturamentoRealizado]);

  const totalStatus = statusData.reduce((s, d) => s + d.value, 0);

  const pgtoDonut = useMemo(() => {
    if (financeiro?.formasPagamento && financeiro.formasPagamento.length > 0) {
      return financeiro.formasPagamento.map((f) => ({
        forma: f.tipoPagamento,
        total: f.totalBruto,
        qty: 1,
      }));
    }
    return formasAg.map((f) => ({ forma: f.forma, total: f.total, qty: f.qty }));
  }, [financeiro, formasAg]);

  const pgtoTotal = pgtoDonut.reduce((s, d) => s + d.total, 0);
  const topBarbeiro = prof[0] || null;

  // Seletor de dia no header
  const diaActions = (
    <div className="flex items-center gap-1.5 bg-background rounded-lg px-2 py-1 border border-card-border">
      <button
        type="button"
        onClick={() => setDia(somarDias(dia, -1))}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent"
        aria-label="Dia anterior"
      >
        <ChevronLeft size={16} />
      </button>
      <input
        type="date"
        value={dia}
        max={hoje}
        onChange={(e) => setDia(e.target.value || hoje)}
        className="bg-transparent text-sm outline-none w-[130px]"
      />
      <button
        type="button"
        onClick={() => setDia(somarDias(dia, +1))}
        disabled={ehHoje}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Dia seguinte"
      >
        <ChevronRight size={16} />
      </button>
      {!ehHoje && (
        <button
          type="button"
          onClick={() => setDia(hoje)}
          className="ml-1 text-xs text-accent hover:underline"
        >
          Hoje
        </button>
      )}
    </div>
  );

  return (
    <>
      <Header
        title={ehHoje ? "Hoje" : "Dia"}
        subtitle={formatarDiaLongo(dia)}
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={refresh}
        hideDateRange
        actions={diaActions}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {!sessionActive && !loading && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-center gap-3">
            <Clock size={20} className="text-warning shrink-0" />
            <div>
              <p className="text-sm font-medium">Sessão não configurada</p>
              <p className="text-xs text-muted mt-0.5">
                Vá em{" "}
                <a href="/configuracoes" className="text-accent underline">
                  Configurações
                </a>{" "}
                e cole o PHPSESSID do AppBarber.
              </p>
            </div>
          </div>
        )}

        {/* HERO: Faturamento do dia */}
        <div className="bg-card-bg border border-card-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10">
            <DollarSign size={28} className="text-success" />
          </div>
          <div className="flex-1">
            <p className="text-muted text-sm">Faturamento do dia</p>
            <p className="text-5xl font-bold mt-1 tracking-tight">{formatBRL(faturamentoBruto)}</p>
            <p className="text-muted text-sm mt-2">
              Ticket médio:{" "}
              <span className="text-foreground font-semibold">{formatBRL(metricas.ticketMedio)}</span>
              {topBarbeiro && (
                <span className="ml-4">
                  Barbeiro do dia:{" "}
                  <span className="text-accent font-semibold">
                    {topBarbeiro.nome} ({topBarbeiro.atendimentos}x · {formatBRL(topBarbeiro.faturamento)})
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="cursor-pointer"
            onClick={() => openModal(`Agendamentos (${metricas.totalAgendamentos})`, <AppointmentList items={agendamentos} />)}
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
                <AppointmentList items={agendamentos.filter((a) => a.status === "Realizado")} />
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
              const seen = new Set<string>();
              const unicos = agendamentos.filter((a) => {
                if (a.cliente === "Sem Cadastro" || !a.codCliente) return false;
                if (seen.has(a.codCliente)) return false;
                seen.add(a.codCliente);
                return true;
              });
              openModal(`Clientes únicos (${unicos.length})`, <AppointmentList items={unicos} />);
            }}
          >
            <MetricCard
              title="Clientes únicos"
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
                <AppointmentList items={agendamentos.filter((a) => a.status === "Cancelado" || a.status === "Ausente")} />
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

        {/* Faturamento por horário + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-accent" />
              Faturamento por horário
            </h3>
            {hourly.length > 0 ? (
              <ResponsiveContainer key={ocultarKey} width="100%" height={280}>
                <LineChart data={hourly}>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} />
                  <XAxis dataKey="hora" tick={{ ...AXIS_STYLE }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ ...AXIS_STYLE }} tickLine={false} axisLine={false} tickFormatter={formatBRLShort} />
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
                      onClick: (e: unknown) => {
                        const p = e as unknown as { payload: HourlyItem };
                        openModal(
                          `${p.payload.hora} — ${formatBRL(p.payload.valor)}`,
                          <AppointmentList items={p.payload.agendamentos} />
                        );
                      },
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem atendimentos realizados</p>
            )}
          </div>

          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-accent" />
              Status
            </h3>
            {totalStatus > 0 ? (
              <div className="space-y-4">
                <div className="flex rounded-lg overflow-hidden h-10">
                  {statusData.map((s) => {
                    const pct = (s.value / totalStatus) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-center text-xs font-semibold text-white cursor-pointer transition-opacity hover:opacity-80"
                        style={{ width: `${pct}%`, backgroundColor: s.color, minWidth: "24px" }}
                        title={`${s.name}: ${s.value}`}
                        onClick={() =>
                          openModal(`${s.name} (${s.value})`, <AppointmentList items={s.agendamentos} />)
                        }
                      >
                        {pct >= 10 ? s.value : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {statusData.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between cursor-pointer hover:bg-background rounded-lg px-2 py-1.5 transition-colors"
                      onClick={() =>
                        openModal(`${s.name} (${s.value})`, <AppointmentList items={s.agendamentos} />)
                      }
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
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

        {/* Top barbeiros + Top serviços + Formas de pagamento */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top barbeiros */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-accent" />
              Top barbeiros do dia
            </h3>
            {prof.length > 0 ? (
              <div className="space-y-3">
                {prof.map((p, idx) => {
                  const pct = prof[0].faturamento > 0 ? (p.faturamento / prof[0].faturamento) * 100 : 0;
                  return (
                    <button
                      key={p.nome}
                      type="button"
                      onClick={() =>
                        openModal(
                          `${p.nome} — ${p.atendimentos} atendimento${p.atendimentos !== 1 ? "s" : ""}`,
                          <AppointmentList items={p.agendamentos} />
                        )
                      }
                      className="w-full text-left p-3 rounded-lg border border-card-border hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: CATEGORICAL[idx % CATEGORICAL.length] }}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium truncate">{p.nome}</span>
                        </div>
                        <span className="text-sm font-mono font-semibold whitespace-nowrap">
                          {formatBRL(p.faturamento)}
                        </span>
                      </div>
                      <div className="h-1 rounded bg-foreground/5 overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CATEGORICAL[idx % CATEGORICAL.length],
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{p.atendimentos} atendimento{p.atendimentos !== 1 ? "s" : ""}</span>
                        <span>ticket {formatBRL(p.ticketMedio)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem atendimentos realizados</p>
            )}
          </div>

          {/* Top serviços */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Scissors size={18} className="text-accent" />
              Top serviços
            </h3>
            {servicoData.length > 0 ? (
              <ResponsiveContainer
                key={ocultarKey}
                width="100%"
                height={Math.max(servicoData.length * 42 + 20, 200)}
              >
                <BarChart data={servicoData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
                  <XAxis type="number" tick={{ ...AXIS_STYLE }} tickLine={false} axisLine={false} />
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
                    formatter={(value, name) => [
                      name === "qty" ? `${Number(value)}x` : formatBRL(Number(value)),
                      name === "qty" ? "Quantidade" : "Total",
                    ]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar dataKey="qty" fill={CATEGORICAL[1]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted py-10 text-center">Sem dados</p>
            )}
          </div>

          {/* Formas de pagamento */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-accent" />
              Formas de pagamento
            </h3>
            {pgtoDonut.length > 0 && pgtoTotal > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer key={ocultarKey} width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pgtoDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="total"
                      nameKey="forma"
                      paddingAngle={2}
                    >
                      {pgtoDonut.map((_, idx) => (
                        <Cell key={idx} fill={CATEGORICAL[idx % CATEGORICAL.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [formatBRL(Number(value)), "Total"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5 mt-2">
                  {pgtoDonut.map((p, idx) => (
                    <div key={p.forma} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORICAL[idx % CATEGORICAL.length] }}
                        />
                        <span className="truncate">{p.forma}</span>
                      </div>
                      <span className="font-mono whitespace-nowrap">{formatBRL(p.total)}</span>
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

      <DetailModal open={modal !== null} onClose={closeModal} title={modal?.title || ""}>
        {modal?.content}
      </DetailModal>
    </>
  );
}
