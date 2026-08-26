"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Scissors,
  MapPin,
  BarChart3,
  CreditCard,
  Package,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Header from "@/components/Header";
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

// Store-specific colors
const STORE_COLORS = [CATEGORICAL[0], CATEGORICAL[2]]; // blue, green-ish

interface StoreMetrics {
  storeId: string;
  storeName: string;
  agendamentos: Agendamento[];
  totalAgendamentos: number;
  realizados: number;
  cancelados: number;
  ausentes: number;
  faturamento: number;
  ticketMedio: number;
  clientesUnicos: number;
  profissionais: { nome: string; faturamento: number; atendimentos: number }[];
  servicos: { servico: string; qty: number; total: number }[];
  formasPgto: { forma: string; total: number; qty: number }[];
}

function buildMetrics(
  storeId: string,
  storeName: string,
  agendamentos: Agendamento[]
): StoreMetrics {
  const realizados = agendamentos.filter((a) => a.status === "Realizado");
  const faturamento = realizados.reduce((s, a) => s + a.valor, 0);

  // Profissionais
  const profMap = new Map<string, { faturamento: number; atendimentos: number }>();
  for (const a of realizados) {
    const entry = profMap.get(a.profissional) || { faturamento: 0, atendimentos: 0 };
    entry.faturamento += a.valor;
    entry.atendimentos++;
    profMap.set(a.profissional, entry);
  }
  const profissionais = Array.from(profMap.entries())
    .map(([nome, data]) => ({ nome, ...data }))
    .sort((a, b) => b.faturamento - a.faturamento);

  // Servicos
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

  // Formas pgto
  const pgtoMap = new Map<string, { total: number; qty: number }>();
  for (const a of realizados.filter((a) => a.formaPgto)) {
    const entry = pgtoMap.get(a.formaPgto) || { total: 0, qty: 0 };
    entry.total += a.valor;
    entry.qty++;
    pgtoMap.set(a.formaPgto, entry);
  }
  const formasPgto = Array.from(pgtoMap.entries())
    .map(([forma, data]) => ({ forma, ...data }))
    .sort((a, b) => b.total - a.total);

  // Clientes unicos
  const clientesUnicos = new Set(
    agendamentos
      .filter((a) => a.cliente !== "Sem Cadastro" && a.codCliente)
      .map((a) => a.codCliente)
  ).size;

  return {
    storeId,
    storeName,
    agendamentos,
    totalAgendamentos: agendamentos.length,
    realizados: realizados.length,
    cancelados: agendamentos.filter((a) => a.status === "Cancelado").length,
    ausentes: agendamentos.filter((a) => a.status === "Ausente").length,
    faturamento,
    ticketMedio: realizados.length > 0 ? faturamento / realizados.length : 0,
    clientesUnicos,
    profissionais,
    servicos,
    formasPgto,
  };
}

export default function ComparativoPage() {
  const { stores } = useStore();
  const { dataIni, dataFim } = useDateRange();
  const [storeData, setStoreData] = useState<StoreMetrics[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (stores.length < 2) return;
    setLoading(true);

    try {
      const results = await Promise.all(
        stores.map(async (s) => {
          const res = await fetch(
            `/api/agendamentos?dataIni=${dataIni}&dataFim=${dataFim}&store=${s.id}`
          );
          if (!res.ok) return { store: s, data: [] as Agendamento[] };
          const data: Agendamento[] = await res.json();
          return { store: s, data: data.filter((a) => a.servico !== "Bloqueado") };
        })
      );

      setStoreData(
        results.map((r) => buildMetrics(r.store.id, r.store.name, r.data))
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [stores, dataIni, dataFim]);

  useEffect(() => {
    fetchAll();
  }, [stores, dataIni, dataFim]);

  // --- Chart data ---
  const kpiComparison = useMemo(() => {
    if (storeData.length < 2) return [];
    return [
      {
        label: "Faturamento",
        [storeData[0].storeName]: storeData[0].faturamento,
        [storeData[1].storeName]: storeData[1].faturamento,
      },
      {
        label: "Realizados",
        [storeData[0].storeName]: storeData[0].realizados,
        [storeData[1].storeName]: storeData[1].realizados,
      },
      {
        label: "Clientes",
        [storeData[0].storeName]: storeData[0].clientesUnicos,
        [storeData[1].storeName]: storeData[1].clientesUnicos,
      },
      {
        label: "Cancel + Ausentes",
        [storeData[0].storeName]: storeData[0].cancelados + storeData[0].ausentes,
        [storeData[1].storeName]: storeData[1].cancelados + storeData[1].ausentes,
      },
    ];
  }, [storeData]);

  // Professional ranking across stores
  const profComparison = useMemo(() => {
    if (storeData.length < 2) return [];
    const allProfs = new Map<string, { loja1: number; loja2: number; store1: string; store2: string }>();

    for (const p of storeData[0].profissionais) {
      allProfs.set(p.nome, {
        loja1: p.faturamento,
        loja2: 0,
        store1: storeData[0].storeName,
        store2: storeData[1].storeName,
      });
    }
    for (const p of storeData[1].profissionais) {
      const existing = allProfs.get(p.nome) || {
        loja1: 0,
        loja2: 0,
        store1: storeData[0].storeName,
        store2: storeData[1].storeName,
      };
      existing.loja2 = p.faturamento;
      allProfs.set(p.nome, existing);
    }

    return Array.from(allProfs.entries())
      .map(([nome, data]) => ({
        nome: nome.split(" ")[0],
        fullName: nome,
        [storeData[0].storeName]: data.loja1,
        [storeData[1].storeName]: data.loja2,
      }))
      .sort((a, b) => {
        const totalA = (a[storeData[0].storeName] as number) + (a[storeData[1].storeName] as number);
        const totalB = (b[storeData[0].storeName] as number) + (b[storeData[1].storeName] as number);
        return totalB - totalA;
      })
      .slice(0, 10);
  }, [storeData]);

  // Service comparison
  const serviceComparison = useMemo(() => {
    if (storeData.length < 2) return [];
    const allServices = new Map<string, { loja1: number; loja2: number }>();

    for (const s of storeData[0].servicos) {
      allServices.set(s.servico, { loja1: s.qty, loja2: 0 });
    }
    for (const s of storeData[1].servicos) {
      const existing = allServices.get(s.servico) || { loja1: 0, loja2: 0 };
      existing.loja2 = s.qty;
      allServices.set(s.servico, existing);
    }

    return Array.from(allServices.entries())
      .map(([servico, data]) => ({
        servico: servico.length > 20 ? servico.slice(0, 18) + "…" : servico,
        fullServico: servico,
        [storeData[0].storeName]: data.loja1,
        [storeData[1].storeName]: data.loja2,
      }))
      .sort((a, b) => {
        const totalA = (a[storeData[0].storeName] as number) + (a[storeData[1].storeName] as number);
        const totalB = (b[storeData[0].storeName] as number) + (b[storeData[1].storeName] as number);
        return totalB - totalA;
      })
      .slice(0, 10);
  }, [storeData]);

  // Daily revenue comparison
  const dailyComparison = useMemo(() => {
    if (storeData.length < 2) return [];
    const dayMap = new Map<string, { loja1: number; loja2: number }>();

    for (const a of storeData[0].agendamentos.filter((a) => a.status === "Realizado")) {
      const dia = a.dataIni.split(" ")[0] || "";
      const entry = dayMap.get(dia) || { loja1: 0, loja2: 0 };
      entry.loja1 += a.valor;
      dayMap.set(dia, entry);
    }
    for (const a of storeData[1].agendamentos.filter((a) => a.status === "Realizado")) {
      const dia = a.dataIni.split(" ")[0] || "";
      const entry = dayMap.get(dia) || { loja1: 0, loja2: 0 };
      entry.loja2 += a.valor;
      dayMap.set(dia, entry);
    }

    return Array.from(dayMap.entries())
      .map(([dia, data]) => {
        const parts = dia.split("/");
        const label = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : dia;
        return {
          dia,
          label,
          [storeData[0].storeName]: data.loja1,
          [storeData[1].storeName]: data.loja2,
        };
      })
      .sort((a, b) => {
        const [da, ma, ya] = a.dia.split("/").map(Number);
        const [db, mb, yb] = b.dia.split("/").map(Number);
        return (ya * 10000 + ma * 100 + da) - (yb * 10000 + mb * 100 + db);
      });
  }, [storeData]);

  if (stores.length < 2) {
    return (
      <>
        <Header title="Comparar Lojas" hideStore />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted">Adicione pelo menos duas lojas nas configurações.</p>
        </main>
      </>
    );
  }

  const s1 = storeData[0];
  const s2 = storeData[1];
  const storeNames = storeData.map((s) => s.storeName);

  return (
    <>
      <Header
        title="Comparar Lojas"
        hideStore
        loading={loading}
        onRefresh={fetchAll}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-auto">
        {loading && storeData.length === 0 && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Carregando dados das duas lojas...</p>
          </div>
        )}

        {storeData.length >= 2 && (
          <>
            {/* ============================================================= */}
            {/* HERO: Faturamento lado a lado */}
            {/* ============================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeData.map((s, i) => (
                <div
                  key={s.storeId}
                  className="bg-card-bg border border-card-border rounded-xl p-6"
                  style={{ borderLeftColor: STORE_COLORS[i], borderLeftWidth: 4 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={16} style={{ color: STORE_COLORS[i] }} />
                    <span className="text-sm font-medium text-muted">{s.storeName}</span>
                  </div>
                  <p className="text-4xl font-bold text-success">{formatBRL(s.faturamento)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted text-xs">Realizados</p>
                      <p className="font-semibold">{s.realizados}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Ticket Médio</p>
                      <p className="font-semibold">{formatBRL(s.ticketMedio)}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Clientes Únicos</p>
                      <p className="font-semibold">{s.clientesUnicos}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Cancel. + Ausentes</p>
                      <p className="font-semibold text-danger">{s.cancelados + s.ausentes}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ============================================================= */}
            {/* KPI Grouped Bar */}
            {/* ============================================================= */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-accent" />
                Comparação Geral
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={kpiComparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} />
                  <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={storeNames[0]} fill={STORE_COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={storeNames[1]} fill={STORE_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ============================================================= */}
            {/* Faturamento Diário */}
            {/* ============================================================= */}
            {dailyComparison.length > 0 && (
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-success" />
                  Faturamento Diário
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dailyComparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} />
                    <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatBRLShort} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [formatBRL(Number(value)), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey={storeNames[0]} fill={STORE_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={storeNames[1]} fill={STORE_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ============================================================= */}
            {/* Profissionais & Serviços */}
            {/* ============================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profissionais */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Scissors size={18} className="text-accent" />
                  Profissionais por Faturamento
                </h3>
                {profComparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height={profComparison.length * 48 + 30}>
                    <BarChart data={profComparison} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
                      <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatBRLShort} />
                      <YAxis type="category" dataKey="nome" width={80} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => [formatBRL(Number(value)), ""]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey={storeNames[0]} fill={STORE_COLORS[0]} radius={[0, 4, 4, 0]} />
                      <Bar dataKey={storeNames[1]} fill={STORE_COLORS[1]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted text-center py-10">Sem dados</p>
                )}
              </div>

              {/* Serviços */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-accent" />
                  Serviços por Quantidade
                </h3>
                {serviceComparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height={serviceComparison.length * 48 + 30}>
                    <BarChart data={serviceComparison} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
                      <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="servico" width={120} tick={{ ...AXIS_STYLE, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullServico || ""}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey={storeNames[0]} fill={STORE_COLORS[0]} radius={[0, 4, 4, 0]} />
                      <Bar dataKey={storeNames[1]} fill={STORE_COLORS[1]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted text-center py-10">Sem dados</p>
                )}
              </div>
            </div>

            {/* ============================================================= */}
            {/* Formas de Pagamento lado a lado */}
            {/* ============================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {storeData.map((s, i) => (
                <div key={s.storeId} className="bg-card-bg border border-card-border rounded-xl p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard size={18} style={{ color: STORE_COLORS[i] }} />
                    Pagamentos - {s.storeName}
                  </h3>
                  {s.formasPgto.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={s.formasPgto}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={80}
                            dataKey="total"
                            nameKey="forma"
                            paddingAngle={2}
                          >
                            {s.formasPgto.map((_, idx) => (
                              <Cell key={idx} fill={CATEGORICAL[idx % CATEGORICAL.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value) => [formatBRL(Number(value)), "Total"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-full space-y-1 mt-1">
                        {s.formasPgto.slice(0, 5).map((p, idx) => {
                          const total = s.formasPgto.reduce((sum, f) => sum + f.total, 0);
                          return (
                            <div key={p.forma} className="flex items-center justify-between px-2 py-1 text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: CATEGORICAL[idx % CATEGORICAL.length] }}
                                />
                                <span className="truncate">{p.forma}</span>
                              </div>
                              <span className="font-medium whitespace-nowrap">
                                {formatBRL(p.total)}{" "}
                                <span className="text-muted text-xs">
                                  ({total > 0 ? ((p.total / total) * 100).toFixed(0) : 0}%)
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted text-center py-10">Sem dados</p>
                  )}
                </div>
              ))}
            </div>

            {/* ============================================================= */}
            {/* Tabela resumo por profissional em cada loja */}
            {/* ============================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {storeData.map((s, i) => (
                <div key={s.storeId} className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
                  <div
                    className="px-5 py-4 border-b border-card-border flex items-center gap-2"
                    style={{ borderLeftColor: STORE_COLORS[i], borderLeftWidth: 4 }}
                  >
                    <Users size={18} className="text-accent" />
                    <h3 className="font-semibold">Profissionais - {s.storeName}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-card-border text-muted">
                          <th className="text-left px-4 py-2 font-medium">Profissional</th>
                          <th className="text-center px-4 py-2 font-medium">Atend.</th>
                          <th className="text-right px-4 py-2 font-medium">Faturamento</th>
                          <th className="text-right px-4 py-2 font-medium">Ticket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.profissionais.map((p) => (
                          <tr key={p.nome} className="border-b border-card-border/50">
                            <td className="px-4 py-2 font-medium">{p.nome}</td>
                            <td className="px-4 py-2 text-center">{p.atendimentos}</td>
                            <td className="px-4 py-2 text-right text-success font-medium">
                              {formatBRL(p.faturamento)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {formatBRL(p.atendimentos > 0 ? p.faturamento / p.atendimentos : 0)}
                            </td>
                          </tr>
                        ))}
                        {s.profissionais.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-muted">
                              Sem dados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* ============================================================= */}
            {/* Resumo total */}
            {/* ============================================================= */}
            <div className="bg-card-bg border border-card-border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-accent" />
                Total Consolidado (Ambas as Lojas)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-xs text-muted mb-1">Faturamento Total</p>
                  <p className="text-2xl font-bold text-success">
                    {formatBRL(storeData.reduce((s, d) => s + d.faturamento, 0))}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-xs text-muted mb-1">Total Realizados</p>
                  <p className="text-2xl font-bold">
                    {storeData.reduce((s, d) => s + d.realizados, 0)}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-xs text-muted mb-1">Total Clientes</p>
                  <p className="text-2xl font-bold">
                    {storeData.reduce((s, d) => s + d.clientesUnicos, 0)}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-xs text-muted mb-1">Ticket Médio Geral</p>
                  <p className="text-2xl font-bold">
                    {formatBRL(
                      (() => {
                        const totalFat = storeData.reduce((s, d) => s + d.faturamento, 0);
                        const totalReal = storeData.reduce((s, d) => s + d.realizados, 0);
                        return totalReal > 0 ? totalFat / totalReal : 0;
                      })()
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
