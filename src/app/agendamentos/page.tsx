"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Lock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
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
import AppointmentTable from "@/components/AppointmentTable";
import MetricCard from "@/components/MetricCard";
import DetailModal from "@/components/charts/DetailModal";
import {
  STATUS_COLORS,
  TOOLTIP_STYLE,
  CATEGORICAL,
  formatBRL,
} from "@/components/charts/ChartColors";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import { calcularMetricas } from "@/lib/parser";
import type { Agendamento } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  realizado: "Realizado",
  agendado: "Agendado",
  cancelado: "Cancelado",
  ausente: "Ausente",
};

const STATUS_KEYS = ["realizado", "agendado", "cancelado", "ausente"] as const;

export default function AgendamentosPage() {
  const { agendamentos, bloqueados, loading, sessionActive, lastUpdate, refresh } =
    useAgendamentos({ autoRefreshMs: 60000 });

  const metricas = useMemo(
    () => calcularMetricas(agendamentos),
    [agendamentos]
  );

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    items: Agendamento[];
  }>({ open: false, title: "", items: [] });

  // ---- Derived data ----

  const filteredAgendamentos = useMemo(() => {
    if (!statusFilter) return agendamentos;
    return agendamentos.filter(
      (a) => a.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }, [agendamentos, statusFilter]);

  // Status distribution (horizontal stacked bar)
  const statusDistribution = useMemo(() => {
    const total = agendamentos.length || 1;
    return STATUS_KEYS.map((key) => {
      const count =
        key === "realizado"
          ? metricas.realizados
          : key === "agendado"
          ? metricas.agendados
          : key === "cancelado"
          ? metricas.cancelados
          : metricas.ausentes;
      return {
        key,
        label: STATUS_LABELS[key],
        count,
        pct: ((count / total) * 100).toFixed(1),
        color: STATUS_COLORS[key],
      };
    });
  }, [agendamentos, metricas]);

  // Agendamentos por dia
  const porDia = useMemo(() => {
    const map = new Map<
      string,
      { dia: string; realizado: number; agendado: number; cancelado: number; ausente: number }
    >();
    for (const a of agendamentos) {
      const dia = a.dataIni.split(" ")[0] || "";
      if (!dia) continue;
      const entry = map.get(dia) || {
        dia,
        realizado: 0,
        agendado: 0,
        cancelado: 0,
        ausente: 0,
      };
      const st = a.status.toLowerCase();
      if (st === "realizado") entry.realizado++;
      else if (st === "agendado") entry.agendado++;
      else if (st === "cancelado") entry.cancelado++;
      else if (st === "ausente") entry.ausente++;
      map.set(dia, entry);
    }
    return Array.from(map.values()).sort((a, b) => {
      const [da, ma, ya] = a.dia.split("/").map(Number);
      const [db, mb, yb] = b.dia.split("/").map(Number);
      return ya * 10000 + ma * 100 + da - (yb * 10000 + mb * 100 + db);
    });
  }, [agendamentos]);

  // Agendamentos por horario
  const porHorario = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of agendamentos) {
      const hour = a.hora?.split(":")[0] || "";
      if (!hour) continue;
      map.set(hour, (map.get(hour) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([hora, total]) => ({ hora: `${hora}h`, rawHour: hora, total }))
      .sort((a, b) => Number(a.rawHour) - Number(b.rawHour));
  }, [agendamentos]);

  // Tipos de agendamento
  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of agendamentos) {
      const tipo = a.tipo || "Normal";
      map.set(tipo, (map.get(tipo) || 0) + 1);
    }
    return Array.from(map.entries()).map(([tipo, count]) => ({
      tipo,
      count,
    }));
  }, [agendamentos]);

  // ---- Handlers ----

  function handleStatusBarClick(key: string) {
    setStatusFilter((prev) => (prev === key ? null : key));
  }

  function handleDayBarClick(dia: string, status: string) {
    const label = STATUS_LABELS[status] || status;
    const items = agendamentos.filter(
      (a) =>
        a.dataIni.startsWith(dia) &&
        a.status.toLowerCase() === status.toLowerCase()
    );
    setModal({ open: true, title: `${label} - ${dia}`, items });
  }

  function handleHourClick(rawHour: string) {
    const items = agendamentos.filter(
      (a) => a.hora?.split(":")[0] === rawHour
    );
    setModal({
      open: true,
      title: `Agendamentos as ${rawHour}h`,
      items,
    });
  }

  function handleTipoClick(tipo: string) {
    const items = agendamentos.filter((a) => (a.tipo || "Normal") === tipo);
    setModal({
      open: true,
      title: `Tipo: ${tipo}`,
      items,
    });
  }

  return (
    <>
      <Header
        title="Agendamentos"
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total"
            value={metricas.totalAgendamentos}
            icon={Calendar}
            color="accent"
          />
          <MetricCard
            title="Realizados"
            value={metricas.realizados}
            icon={CheckCircle}
            color="success"
          />
          <MetricCard
            title="Cancelados"
            value={metricas.cancelados}
            icon={XCircle}
            color="warning"
          />
          <MetricCard
            title="Ausentes"
            value={metricas.ausentes}
            icon={Clock}
            color="danger"
          />
        </div>

        {/* Status Distribution - Horizontal Stacked Bar */}
        <div className="bg-card-bg border border-card-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Distribuicao de Status</h3>
          <div className="w-full h-8 rounded-lg overflow-hidden flex">
            {statusDistribution.map((s) =>
              s.count > 0 ? (
                <div
                  key={s.key}
                  className="h-full cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: s.color,
                    opacity: statusFilter && statusFilter !== s.key ? 0.3 : 1,
                  }}
                  onClick={() => handleStatusBarClick(s.key)}
                  title={`${s.label}: ${s.count} (${s.pct}%)`}
                />
              ) : null
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {statusDistribution.map((s) => (
              <button
                key={s.key}
                className="flex items-center gap-2 text-sm cursor-pointer transition-opacity"
                style={{
                  opacity: statusFilter && statusFilter !== s.key ? 0.4 : 1,
                }}
                onClick={() => handleStatusBarClick(s.key)}
              >
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted">
                  {s.label}: {s.count} ({s.pct}%)
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agendamentos por Dia */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Agendamentos por Dia</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porDia}>
                <CartesianGrid stroke="#e5e7eb20" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tickLine={false}
                  axisLine={false}
                  fill="#6b7280"
                  fontSize={12}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fill="#6b7280"
                  fontSize={12}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                />
                {STATUS_KEYS.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={STATUS_LABELS[key]}
                    stackId="status"
                    fill={STATUS_COLORS[key]}
                    cursor="pointer"
                    onClick={(data) => {
                      const dia = data?.payload?.dia;
                      if (typeof dia === "string") {
                        handleDayBarClick(dia, key);
                      }
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Agendamentos por Horario */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Agendamentos por Horario</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={porHorario}
                onClick={(state) => {
                  const idx =
                    typeof state?.activeTooltipIndex === "number"
                      ? state.activeTooltipIndex
                      : -1;
                  const point = porHorario[idx];
                  if (point) handleHourClick(point.rawHour);
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid stroke="#e5e7eb20" vertical={false} />
                <XAxis
                  dataKey="hora"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Agendamentos"
                  stroke="#2a78d6"
                  fill="#2a78d6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tipos de Agendamento - Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Tipos de Agendamento</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={porTipo}
                  dataKey="count"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(data) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const entry = data as any;
                    const tipo = entry?.payload?.tipo ?? entry?.tipo;
                    if (typeof tipo === "string") handleTipoClick(tipo);
                  }}
                >
                  {porTipo.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CATEGORICAL[i % CATEGORICAL.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {porTipo.map((t, i) => (
                <div key={t.tipo} className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{
                      backgroundColor: CATEGORICAL[i % CATEGORICAL.length],
                    }}
                  />
                  {t.tipo}: {t.count}
                </div>
              ))}
            </div>
          </div>

          {/* Table with filter */}
          <div className="lg:col-span-2">
            {/* Filter pills */}
            {statusFilter && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-muted">Filtro:</span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{
                    backgroundColor:
                      STATUS_COLORS[
                        statusFilter as keyof typeof STATUS_COLORS
                      ],
                  }}
                >
                  {STATUS_LABELS[statusFilter] || statusFilter}
                  <button
                    onClick={() => setStatusFilter(null)}
                    className="hover:opacity-70"
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}
            <AppointmentTable
              agendamentos={filteredAgendamentos}
              title="Agendamentos"
            />
          </div>
        </div>

        {/* Bloqueios de Agenda */}
        {bloqueados.length > 0 && (
          <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Lock size={18} className="text-muted" />
                Bloqueios de Agenda
              </h3>
              <span className="text-xs text-muted">
                {bloqueados.length} bloqueio{bloqueados.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted">
                    <th className="text-left px-5 py-3 font-medium">Horário</th>
                    <th className="text-left px-5 py-3 font-medium">Profissional</th>
                    <th className="text-left px-5 py-3 font-medium">Motivo</th>
                    <th className="text-left px-5 py-3 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {bloqueados.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-card-border/50 last:border-0 hover:bg-accent/5"
                    >
                      <td className="px-5 py-3 font-medium whitespace-nowrap">
                        {b.hora} - {b.horaFim}
                      </td>
                      <td className="px-5 py-3">{b.profissional}</td>
                      <td className="px-5 py-3 text-muted">
                        {b.obs || b.tipo || "Bloqueado"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted/10 text-muted">
                          {b.tipo || "Bloqueado"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <DetailModal
        open={modal.open}
        onClose={() => setModal({ open: false, title: "", items: [] })}
        title={modal.title}
      >
        {modal.items.length === 0 ? (
          <p className="text-muted text-sm">Nenhum agendamento encontrado.</p>
        ) : (
          <div className="space-y-3">
            {modal.items.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-card-border pb-2 last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">{a.cliente}</p>
                  <p className="text-xs text-muted">
                    {a.servico} - {a.profissional}
                  </p>
                  <p className="text-xs text-muted">
                    {a.hora} - {a.horaFim}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {a.valor > 0 ? formatBRL(a.valor) : "-"}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${
                        STATUS_COLORS[
                          a.status.toLowerCase() as keyof typeof STATUS_COLORS
                        ] || "#6b7280"
                      }20`,
                      color:
                        STATUS_COLORS[
                          a.status.toLowerCase() as keyof typeof STATUS_COLORS
                        ] || "#6b7280",
                    }}
                  >
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailModal>
    </>
  );
}
