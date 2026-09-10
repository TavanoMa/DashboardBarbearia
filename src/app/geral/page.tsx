"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  Users,
  CheckCircle,
  Calendar,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Building2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
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
} from "recharts";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import {
  CATEGORICAL,
  TOOLTIP_STYLE,
  AXIS_STYLE,
  GRID_STYLE,
  formatBRL,
  formatBRLShort,
} from "@/components/charts/ChartColors";
import { useStore } from "@/hooks/useStore";
import { useDateRange } from "@/hooks/useDateRange";
import type { Agendamento } from "@/lib/types";

const STORE_COLORS = [CATEGORICAL[0], CATEGORICAL[2], CATEGORICAL[4], CATEGORICAL[6]];

interface StoreData {
  storeId: string;
  storeName: string;
  agendamentos: Agendamento[];
  realizados: number;
  cancelados: number;
  ausentes: number;
  faturamento: number;
  ticketMedio: number;
  clientesUnicos: number;
}

function buildStoreData(
  storeId: string,
  storeName: string,
  agendamentos: Agendamento[]
): StoreData {
  const filtered = agendamentos.filter((a) => a.status !== "Bloqueado");
  const realizados = filtered.filter((a) => a.status === "Realizado");
  const faturamento = realizados.reduce((s, a) => s + a.valor, 0);
  const clientes = new Set(realizados.map((a) => a.cliente).filter(Boolean));

  return {
    storeId,
    storeName,
    agendamentos: filtered,
    realizados: realizados.length,
    cancelados: filtered.filter((a) => a.status === "Cancelado").length,
    ausentes: filtered.filter((a) => a.status === "Ausente").length,
    faturamento,
    ticketMedio: realizados.length > 0 ? faturamento / realizados.length : 0,
    clientesUnicos: clientes.size,
  };
}

export default function GeralPage() {
  const { stores } = useStore();
  const { dataIni, dataFim } = useDateRange();

  const [loading, setLoading] = useState(false);
  const [storesData, setStoresData] = useState<StoreData[]>([]);

  const fetchAll = useCallback(async () => {
    if (stores.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        stores.map(async (s) => {
          const res = await fetch(
            `/api/agendamentos?dataIni=${dataIni}&dataFim=${dataFim}&store=${s.id}`
          );
          if (!res.ok) return buildStoreData(s.id, s.name, []);
          const data: Agendamento[] = await res.json();
          return buildStoreData(s.id, s.name, data);
        })
      );
      setStoresData(results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [stores, dataIni, dataFim]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Totals
  const totals = useMemo(() => {
    const totalFaturamento = storesData.reduce((s, d) => s + d.faturamento, 0);
    const totalRealizados = storesData.reduce((s, d) => s + d.realizados, 0);
    const totalCancelados = storesData.reduce((s, d) => s + d.cancelados, 0);
    const totalAusentes = storesData.reduce((s, d) => s + d.ausentes, 0);
    const totalAgendamentos = storesData.reduce((s, d) => s + d.agendamentos.length, 0);
    const totalClientes = storesData.reduce((s, d) => s + d.clientesUnicos, 0);
    const ticketMedio = totalRealizados > 0 ? totalFaturamento / totalRealizados : 0;
    const taxaRealizacao = totalAgendamentos > 0 ? (totalRealizados / totalAgendamentos) * 100 : 0;

    return {
      faturamento: totalFaturamento,
      realizados: totalRealizados,
      cancelados: totalCancelados,
      ausentes: totalAusentes,
      agendamentos: totalAgendamentos,
      clientes: totalClientes,
      ticketMedio,
      taxaRealizacao,
    };
  }, [storesData]);

  // Pie chart data — faturamento por loja
  const pieData = useMemo(() => {
    return storesData
      .filter((d) => d.faturamento > 0)
      .map((d, i) => ({
        name: d.storeName,
        value: d.faturamento,
        color: STORE_COLORS[i % STORE_COLORS.length],
      }));
  }, [storesData]);

  // Bar chart — métricas por loja
  const barData = useMemo(() => {
    return storesData.map((d) => ({
      loja: d.storeName,
      Faturamento: d.faturamento,
      Realizados: d.realizados,
      Cancelados: d.cancelados,
    }));
  }, [storesData]);

  // Daily faturamento combined
  const dailyData = useMemo(() => {
    const dayMap = new Map<string, Record<string, number>>();

    for (const store of storesData) {
      const realizados = store.agendamentos.filter((a) => a.status === "Realizado");
      for (const a of realizados) {
        const dia = a.dataIni.split(" ")[0] || "";
        if (!dayMap.has(dia)) dayMap.set(dia, {});
        const entry = dayMap.get(dia)!;
        entry[store.storeName] = (entry[store.storeName] || 0) + a.valor;
        entry["Total"] = (entry["Total"] || 0) + a.valor;
      }
    }

    return Array.from(dayMap.entries())
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
  }, [storesData]);

  const storeNames = storesData.map((d) => d.storeName);

  return (
    <>
      <Header
        title="Visão Geral"
        loading={loading}
        onRefresh={fetchAll}
        hideStore
      />

      <main className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Faturamento Total"
            value={formatBRL(totals.faturamento)}
            subtitle={`Ticket médio: ${formatBRL(totals.ticketMedio)}`}
            icon={DollarSign}
            color="accent"
          />
          <MetricCard
            title="Realizados"
            value={totals.realizados}
            subtitle={`${formatBRL(totals.faturamento)} faturado`}
            icon={CheckCircle}
            color="success"
          />
          <MetricCard
            title="Agendamentos"
            value={totals.agendamentos}
            subtitle={`${totals.realizados} realizados, ${totals.agendamentos - totals.realizados - totals.cancelados - totals.ausentes} agendados`}
            icon={Calendar}
            color="accent"
          />
          <MetricCard
            title="Cancelamentos"
            value={totals.cancelados}
            subtitle={`${totals.ausentes} ausentes`}
            icon={AlertTriangle}
            color="danger"
          />
        </div>

        {/* Store breakdown cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storesData.map((store, i) => (
            <div
              key={store.storeId}
              className="bg-card-bg border border-card-border rounded-xl p-5"
              style={{ borderLeftWidth: 4, borderLeftColor: STORE_COLORS[i % STORE_COLORS.length] }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={18} style={{ color: STORE_COLORS[i % STORE_COLORS.length] }} />
                <h3 className="font-semibold text-lg capitalize">{store.storeName}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted">Faturamento</p>
                  <p className="text-xl font-bold" style={{ color: STORE_COLORS[i % STORE_COLORS.length] }}>
                    {formatBRL(store.faturamento)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Realizados</p>
                  <p className="text-xl font-bold">{store.realizados}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Ticket Médio</p>
                  <p className="text-lg font-semibold">{formatBRL(store.ticketMedio)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Clientes Únicos</p>
                  <p className="text-lg font-semibold">{store.clientesUnicos}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Cancelados</p>
                  <p className="text-lg font-semibold text-danger">{store.cancelados}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Taxa Realização</p>
                  <p className="text-lg font-semibold">
                    {store.agendamentos.length > 0
                      ? ((store.realizados / store.agendamentos.length) * 100).toFixed(0)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie — faturamento por loja */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-accent" />
              Faturamento por Loja
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatBRL(Number(value)), ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar — realizados/cancelados por loja */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users size={18} className="text-accent" />
              Atendimentos por Loja
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="loja" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="Realizados" fill={CATEGORICAL[3]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cancelados" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily line chart */}
        {dailyData.length > 0 && (
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-accent" />
              Faturamento Diário
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="label" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} tickFormatter={(v) => formatBRLShort(v)} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatBRL(Number(value)), ""]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {storeNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={STORE_COLORS[i % STORE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke={CATEGORICAL[5]}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>
    </>
  );
}
