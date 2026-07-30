"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
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
import { agruparPorProfissional } from "@/lib/parser";
import type { Agendamento } from "@/lib/types";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const GRID_STROKE = "#e5e7eb20";

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

export default function ProfissionaisPage() {
  const { agendamentos, loading, sessionActive, lastUpdate, refresh } =
    useAgendamentos({ autoRefreshMs: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalItems, setModalItems] = useState<Agendamento[]>([]);

  function openModal(title: string, items: Agendamento[]) {
    setModalTitle(title);
    setModalItems(items);
    setModalOpen(true);
  }

  const profissionais = useMemo(
    () => agruparPorProfissional(agendamentos),
    [agendamentos]
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
    const result: Record<
      string,
      { servico: string; qty: number; total: number }[]
    > = {};
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

  // Day of week distribution (stacked bar, top 3 + Outros)
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
      const d = new Date(
        Number(dateParts[2]),
        Number(dateParts[1]) - 1,
        Number(dateParts[0])
      );
      if (isNaN(d.getTime())) continue;
      const dayLabel = DIAS_SEMANA[d.getDay()];
      if (top3.includes(a.profissional)) {
        dayMap[dayLabel][a.profissional] =
          (dayMap[dayLabel][a.profissional] || 0) + 1;
      } else {
        dayMap[dayLabel]["Outros"] = (dayMap[dayLabel]["Outros"] || 0) + 1;
      }
    }

    // Return only Mon-Sat (skip Dom index 0 if you want, but keep all)
    return DIAS_SEMANA.map((label) => ({
      dia: label,
      ...dayMap[label],
    }));
  }, [agendamentos, profissionais]);

  const stackedKeys = useMemo(() => {
    const top3 = profissionais.slice(0, 3).map((p) => p.nome);
    const hasOutros = profissionais.length > 3;
    return hasOutros ? [...top3, "Outros"] : top3;
  }, [profissionais]);

  // Sparkline data per professional (daily revenue last 30 days)
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

  return (
    <>
      <Header
        title="Profissionais"
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
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
            value={formatBRL(
              totalAtendimentos > 0
                ? totalFaturamento / totalAtendimentos
                : 0
            )}
            icon={TrendingUp}
            color="accent"
          />
        </div>

        {profissionais.length > 0 && (
          <>
            {/* 1. Ranking de Faturamento - Horizontal Bar */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Ranking de Faturamento</h3>
              <ResponsiveContainer width="100%" height={profissionais.length * 52 + 20}>
                <BarChart
                  data={rankingData}
                  layout="vertical"
                  margin={{ top: 0, right: 80, left: 10, bottom: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={GRID_STROKE}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={formatBRLShort}
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={120}
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [formatBRL(value), "Faturamento"]}
                    cursor={{ fill: "#ffffff08" }}
                  />
                  <Bar
                    dataKey="faturamento"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(entry) => {
                      const items = agendamentos.filter(
                        (a) => a.profissional === entry.nome
                      );
                      openModal(`Agendamentos - ${entry.nome}`, items);
                    }}
                    label={{
                      position: "right",
                      formatter: (v: number) => formatBRLShort(v),
                      fill: "#6b7280",
                      fontSize: 11,
                    }}
                  >
                    {rankingData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Comparativo Atendimentos vs Faturamento - Two side-by-side charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Atendimentos por Profissional</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={atendimentosData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={GRID_STROKE}
                    />
                    <XAxis
                      dataKey="nome"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [value, "Atendimentos"]}
                      labelFormatter={(label: string, payload) => {
                        if (payload?.[0]?.payload?.fullName)
                          return payload[0].payload.fullName;
                        return label;
                      }}
                      cursor={{ fill: "#ffffff08" }}
                    />
                    <Bar
                      dataKey="atendimentos"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(entry) => {
                        const items = agendamentos.filter(
                          (a) =>
                            a.profissional === entry.fullName &&
                            a.status === "Realizado"
                        );
                        openModal(
                          `Atendimentos - ${entry.fullName}`,
                          items
                        );
                      }}
                    >
                      {atendimentosData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Faturamento por Profissional</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={faturamentoData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={GRID_STROKE}
                    />
                    <XAxis
                      dataKey="nome"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatBRLShort}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [formatBRL(value), "Faturamento"]}
                      labelFormatter={(label: string, payload) => {
                        if (payload?.[0]?.payload?.fullName)
                          return payload[0].payload.fullName;
                        return label;
                      }}
                      cursor={{ fill: "#ffffff08" }}
                    />
                    <Bar
                      dataKey="faturamento"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(entry) => {
                        const items = agendamentos.filter(
                          (a) =>
                            a.profissional === entry.fullName &&
                            a.status === "Realizado"
                        );
                        openModal(
                          `Faturamento - ${entry.fullName}`,
                          items
                        );
                      }}
                    >
                      {faturamentoData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Servicos por Profissional - Mini horizontal bar charts */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Servicos por Profissional</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profissionais.map((prof, pi) => {
                  const servicos = (servicosPorProf[prof.nome] || []).slice(
                    0,
                    6
                  );
                  if (servicos.length === 0) return null;
                  const chartData = servicos.map((s) => ({
                    servico:
                      s.servico.length > 18
                        ? s.servico.slice(0, 18) + "..."
                        : s.servico,
                    fullServico: s.servico,
                    qty: s.qty,
                    total: s.total,
                    profNome: prof.nome,
                  }));
                  return (
                    <div key={pi}>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{
                            backgroundColor:
                              CATEGORICAL[pi % CATEGORICAL.length],
                          }}
                        />
                        {prof.nome}
                      </p>
                      <ResponsiveContainer width="100%" height={servicos.length * 34 + 10}>
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            stroke={GRID_STROKE}
                          />
                          <XAxis
                            type="number"
                            tick={AXIS_STYLE}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="servico"
                            width={140}
                            tick={{ ...AXIS_STYLE, fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value: number, name: string) => {
                              if (name === "qty") return [value, "Quantidade"];
                              return [value, name];
                            }}
                            labelFormatter={(label: string, payload) => {
                              if (payload?.[0]?.payload?.fullServico)
                                return payload[0].payload.fullServico;
                              return label;
                            }}
                            cursor={{ fill: "#ffffff08" }}
                          />
                          <Bar
                            dataKey="qty"
                            fill={CATEGORICAL[pi % CATEGORICAL.length]}
                            radius={[0, 4, 4, 0]}
                            cursor="pointer"
                            label={{
                              position: "right",
                              fill: "#6b7280",
                              fontSize: 11,
                            }}
                            onClick={(entry) => {
                              const items = agendamentos.filter(
                                (a) =>
                                  a.profissional === entry.profNome &&
                                  a.servico === entry.fullServico &&
                                  a.status === "Realizado"
                              );
                              openModal(
                                `${entry.fullServico} - ${entry.profNome}`,
                                items
                              );
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Distribuicao por Dia da Semana - Stacked Bar */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">
                Distribuicao por Dia da Semana
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={diaSemanaData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke={GRID_STROKE}
                  />
                  <XAxis
                    dataKey="dia"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "#ffffff08" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#6b7280" }}
                  />
                  {stackedKeys.map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="a"
                      fill={
                        key === "Outros"
                          ? "#6b7280"
                          : CATEGORICAL[i % CATEGORICAL.length]
                      }
                      radius={
                        i === stackedKeys.length - 1
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 5. Cards individuais por profissional */}
            <div>
              <h3 className="font-semibold mb-4">Profissionais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profissionais.map((prof, i) => {
                  const servicos = (servicosPorProf[prof.nome] || []).slice(
                    0,
                    5
                  );
                  const ticketMedio =
                    prof.atendimentos > 0
                      ? prof.faturamento / prof.atendimentos
                      : 0;
                  const sparkData = sparklineByProf[prof.nome] || [];
                  const profColor = CATEGORICAL[i % CATEGORICAL.length];

                  return (
                    <div
                      key={i}
                      className="bg-card-bg border border-card-border rounded-xl p-5 cursor-pointer hover:border-accent/40 transition-colors"
                      onClick={() => {
                        const items = agendamentos.filter(
                          (a) => a.profissional === prof.nome
                        );
                        openModal(`Detalhes - ${prof.nome}`, items);
                      }}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                          style={{
                            backgroundColor: profColor + "22",
                            color: profColor,
                          }}
                        >
                          {getInitials(prof.nome)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">
                            {prof.nome}
                          </h4>
                          <p className="text-xs text-muted">
                            {prof.atendimentos} atendimentos
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-success">
                            {formatBRL(prof.faturamento)}
                          </p>
                          <p className="text-xs text-muted">
                            TM: {formatBRL(ticketMedio)}
                          </p>
                        </div>
                      </div>

                      {/* Sparkline */}
                      {sparkData.length > 1 && (
                        <div className="mb-3">
                          <ResponsiveContainer width="100%" height={40}>
                            <LineChart data={sparkData}>
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke={profColor}
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Top services tags */}
                      {servicos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {servicos.map((s, j) => (
                            <span
                              key={j}
                              className="text-xs px-2 py-0.5 rounded-full bg-background text-muted border border-card-border"
                            >
                              {s.servico} ({s.qty})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {profissionais.length === 0 && !loading && (
          <p className="text-sm text-muted text-center py-8">
            Sem dados no periodo selecionado.
          </p>
        )}
      </main>

      {/* Detail Modal */}
      <DetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
      >
        <AppointmentList items={modalItems} />
      </DetailModal>
    </>
  );
}
