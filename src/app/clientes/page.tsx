"use client";

import { useMemo, useState } from "react";
import {
  Users,
  Search,
  DollarSign,
  Calendar,
  Repeat,
} from "lucide-react";
import {
  BarChart,
  Bar,
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
  CATEGORICAL,
  TOOLTIP_STYLE,
  formatBRL,
} from "@/components/charts/ChartColors";
import { useAgendamentos } from "@/hooks/useAgendamentos";
import type { Agendamento } from "@/lib/types";

interface ClienteResumo {
  nome: string;
  codCliente: string;
  telefone: string;
  email: string;
  visitas: number;
  totalGasto: number;
  ticketMedio: number;
  servicosFavoritos: string[];
  ultimoAtendimento: string;
  agendamentos: Agendamento[];
}

export default function ClientesPage() {
  const { agendamentos, loading, sessionActive, lastUpdate, refresh } =
    useAgendamentos({ autoRefreshMs: 0 });
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    content: React.ReactNode;
  }>({ open: false, title: "", content: null });

  // ---- Build client map ----
  const clientes = useMemo(() => {
    const map = new Map<string, ClienteResumo>();

    for (const a of agendamentos) {
      if (!a.codCliente || a.cliente === "Sem Cadastro") continue;

      const existing = map.get(a.codCliente);
      if (existing) {
        existing.visitas++;
        if (a.status === "Realizado") existing.totalGasto += a.valor;
        if (!existing.servicosFavoritos.includes(a.servico))
          existing.servicosFavoritos.push(a.servico);
        if (a.dataIni > existing.ultimoAtendimento)
          existing.ultimoAtendimento = a.dataIni;
        if (!existing.telefone && a.telefone) existing.telefone = a.telefone;
        if (!existing.email && a.email) existing.email = a.email;
        existing.agendamentos.push(a);
      } else {
        map.set(a.codCliente, {
          nome: a.cliente,
          codCliente: a.codCliente,
          telefone: a.telefone || "",
          email: a.email || "",
          visitas: 1,
          totalGasto: a.status === "Realizado" ? a.valor : 0,
          ticketMedio: 0,
          servicosFavoritos: [a.servico],
          ultimoAtendimento: a.dataIni,
          agendamentos: [a],
        });
      }
    }

    const list = Array.from(map.values());
    for (const c of list) {
      const realized = c.agendamentos.filter(
        (a) => a.status === "Realizado"
      ).length;
      c.ticketMedio = realized > 0 ? c.totalGasto / realized : 0;
    }
    return list.sort((a, b) => b.visitas - a.visitas);
  }, [agendamentos]);

  const filtrados = useMemo(() => {
    if (!busca) return clientes;
    const q = busca.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.telefone.includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clientes, busca]);

  // ---- KPI calculations ----
  const totalClientes = clientes.length;
  const mediaVisitas =
    totalClientes > 0
      ? clientes.reduce((s, c) => s + c.visitas, 0) / totalClientes
      : 0;
  const totalFaturamento = clientes.reduce((s, c) => s + c.totalGasto, 0);
  const clientesRecorrentes = clientes.filter((c) => c.visitas >= 3).length;

  // ---- Chart data ----

  // Top 10 by spend
  const top10Gasto = useMemo(
    () =>
      [...clientes]
        .sort((a, b) => b.totalGasto - a.totalGasto)
        .slice(0, 10)
        .map((c, i) => ({ ...c, color: CATEGORICAL[i % CATEGORICAL.length] })),
    [clientes]
  );

  // Visit frequency distribution
  const freqVisitas = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const c of clientes) {
      const names = map.get(c.visitas) || [];
      names.push(c.nome);
      map.set(c.visitas, names);
    }
    return Array.from(map.entries())
      .map(([visitas, nomes]) => ({
        visitas: `${visitas}`,
        count: nomes.length,
        nomes,
      }))
      .sort((a, b) => Number(a.visitas) - Number(b.visitas));
  }, [clientes]);

  // Novos vs Recorrentes
  const novosVsRecorrentes = useMemo(() => {
    const novos = clientes.filter((c) => c.visitas === 1).length;
    const recorrentes = clientes.filter((c) => c.visitas >= 2).length;
    return [
      { label: "Novos", count: novos },
      { label: "Recorrentes", count: recorrentes },
    ];
  }, [clientes]);

  // ---- Handlers ----

  function openClientModal(c: ClienteResumo) {
    setModal({
      open: true,
      title: c.nome,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted text-xs">Telefone</p>
              <p>{c.telefone || "-"}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Email</p>
              <p>{c.email || "-"}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Visitas</p>
              <p className="font-semibold">{c.visitas}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Total Gasto</p>
              <p className="font-semibold text-success">
                {formatBRL(c.totalGasto)}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs">Ticket Medio</p>
              <p>{formatBRL(c.ticketMedio)}</p>
            </div>
          </div>

          {c.servicosFavoritos.length > 0 && (
            <div>
              <p className="text-muted text-xs mb-1.5">Servicos Favoritos</p>
              <div className="flex flex-wrap gap-1.5">
                {c.servicosFavoritos.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-muted text-xs mb-2">Historico</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {c.agendamentos
                .sort((a, b) => (b.dataIni > a.dataIni ? 1 : -1))
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border-b border-card-border pb-2 last:border-0 text-sm"
                  >
                    <div>
                      <p className="font-medium">{a.servico}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(a.dataIni)} - {a.profissional}
                      </p>
                    </div>
                    <div className="text-right">
                      <p>{a.valor > 0 ? formatBRL(a.valor) : "-"}</p>
                      <p className="text-xs text-muted">{a.status}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ),
    });
  }

  function openClientListModal(title: string, clientList: ClienteResumo[]) {
    setModal({
      open: true,
      title,
      content: (
        <div className="space-y-2">
          {clientList.length === 0 ? (
            <p className="text-muted text-sm">Nenhum cliente encontrado.</p>
          ) : (
            clientList.map((c) => (
              <div
                key={c.codCliente}
                className="flex items-center justify-between border-b border-card-border pb-2 last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">{c.nome}</p>
                  <p className="text-xs text-muted">
                    {c.visitas} visita{c.visitas !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm font-medium text-success">
                  {formatBRL(c.totalGasto)}
                </p>
              </div>
            ))
          )}
        </div>
      ),
    });
  }

  return (
    <>
      <Header
        title="Clientes"
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total de Clientes"
            value={totalClientes}
            icon={Users}
            color="accent"
          />
          <MetricCard
            title="Media de Visitas"
            value={mediaVisitas.toFixed(1)}
            icon={Calendar}
            color="accent"
          />
          <MetricCard
            title="Faturamento Total"
            value={formatBRL(totalFaturamento)}
            icon={DollarSign}
            color="success"
          />
          <MetricCard
            title="Clientes Recorrentes"
            value={clientesRecorrentes}
            subtitle="3+ visitas"
            icon={Repeat}
            color="warning"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Clientes por Gasto */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Top 10 Clientes por Gasto</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10Gasto} layout="vertical">
                <CartesianGrid
                  stroke="#e5e7eb20"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                  }
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                  formatter={(value) => [formatBRL(Number(value)), "Gasto"]}
                />
                <Bar
                  dataKey="totalGasto"
                  name="Total Gasto"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const client = data?.payload as ClienteResumo | undefined;
                    if (client) openClientModal(client);
                  }}
                >
                  {top10Gasto.map((c, i) => (
                    <Cell
                      key={c.codCliente}
                      fill={CATEGORICAL[i % CATEGORICAL.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Frequencia de Visitas */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Frequencia de Visitas</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={freqVisitas}>
                <CartesianGrid stroke="#e5e7eb20" vertical={false} />
                <XAxis
                  dataKey="visitas"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  label={{
                    value: "Visitas",
                    position: "insideBottom",
                    offset: -5,
                    fill: "#6b7280",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  allowDecimals={false}
                  label={{
                    value: "Clientes",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#6b7280",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                  formatter={(value) => [Number(value), "Clientes"]}
                />
                <Bar
                  dataKey="count"
                  name="Clientes"
                  fill="#2a78d6"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const visitas = data?.payload?.visitas;
                    if (visitas != null) {
                      const visitCount = Number(visitas);
                      const matchingClients = clientes.filter(
                        (c) => c.visitas === visitCount
                      );
                      openClientListModal(
                        `Clientes com ${visitas} visita${visitCount !== 1 ? "s" : ""}`,
                        matchingClients
                      );
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Novos vs Recorrentes + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut */}
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Novos vs Recorrentes</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={novosVsRecorrentes}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(data) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const entry = data as any;
                    const label = entry?.payload?.label ?? entry?.label;
                    if (typeof label !== "string") return;
                    const isNovos = label === "Novos";
                    const list = clientes.filter((c) =>
                      isNovos ? c.visitas === 1 : c.visitas >= 2
                    );
                    openClientListModal(
                      `Clientes ${label}`,
                      list
                    );
                  }}
                >
                  <Cell fill={CATEGORICAL[0]} />
                  <Cell fill={CATEGORICAL[2]} />
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: CATEGORICAL[0] }}
                />
                Novos: {novosVsRecorrentes[0]?.count ?? 0}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: CATEGORICAL[2] }}
                />
                Recorrentes: {novosVsRecorrentes[1]?.count ?? 0}
              </div>
            </div>
          </div>

          {/* Client Table */}
          <div className="lg:col-span-2">
            <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
                <h3 className="font-semibold">Clientes</h3>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-56"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted">
                      <th className="text-left px-5 py-3 font-medium">
                        Cliente
                      </th>
                      <th className="text-left px-5 py-3 font-medium">
                        Telefone
                      </th>
                      <th className="text-left px-5 py-3 font-medium">
                        Servicos
                      </th>
                      <th className="text-center px-5 py-3 font-medium">
                        Visitas
                      </th>
                      <th className="text-right px-5 py-3 font-medium">
                        Total Gasto
                      </th>
                      <th className="text-left px-5 py-3 font-medium">
                        Ultimo Atendimento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((c) => (
                      <tr
                        key={c.codCliente}
                        className="border-b border-card-border/50 hover:bg-accent/5 cursor-pointer transition-colors"
                        onClick={() => openClientModal(c)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs shrink-0">
                              {c.nome
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{c.nome}</p>
                              {c.email && (
                                <p className="text-xs text-muted">{c.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted whitespace-nowrap">
                          {c.telefone || "-"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.servicosFavoritos.slice(0, 3).map((s, j) => (
                              <span
                                key={j}
                                className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs"
                              >
                                {s}
                              </span>
                            ))}
                            {c.servicosFavoritos.length > 3 && (
                              <span className="text-xs text-muted">
                                +{c.servicosFavoritos.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              c.visitas >= 5
                                ? "bg-success/20 text-success"
                                : c.visitas >= 3
                                ? "bg-accent/20 text-accent"
                                : "bg-background text-muted"
                            }`}
                          >
                            {c.visitas}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-success whitespace-nowrap">
                          {formatBRL(c.totalGasto)}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                          {formatDateTime(c.ultimoAtendimento)}
                        </td>
                      </tr>
                    ))}
                    {filtrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-8 text-center text-muted"
                        >
                          {loading
                            ? "Carregando..."
                            : busca
                            ? "Nenhum cliente encontrado"
                            : "Sem dados de clientes no periodo"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filtrados.length > 0 && (
                <div className="px-5 py-3 border-t border-card-border text-xs text-muted">
                  {filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}{" "}
                  {busca ? "encontrado(s)" : "no periodo"}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <DetailModal
        open={modal.open}
        onClose={() => setModal({ open: false, title: "", content: null })}
        title={modal.title}
      >
        {modal.content}
      </DetailModal>
    </>
  );
}

function formatDateTime(dt: string): string {
  if (!dt) return "-";
  const [date] = dt.split(" ");
  return date || dt;
}
