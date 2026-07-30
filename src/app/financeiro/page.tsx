"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart3,
  Receipt,
  ChevronDown,
  ChevronUp,
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
  Legend,
} from "recharts";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import DetailModal from "@/components/charts/DetailModal";
import {
  CATEGORICAL,
  TOOLTIP_STYLE,
  GRID_STYLE,
  formatBRL,
  formatBRLShort,
} from "@/components/charts/ChartColors";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { agruparTransacoesPorDia } from "@/lib/parser";

function pgtoIcon(forma: string): string {
  const f = forma.toLowerCase();
  if (f.includes("pix")) return "⚡";
  if (f.includes("credito") || f.includes("crédito")) return "💳";
  if (f.includes("debito") || f.includes("débito")) return "💳";
  if (f.includes("dinheiro")) return "💵";
  if (f.includes("transfer")) return "🏦";
  return "💰";
}

export default function FinanceiroPage() {
  const { data, loading, error, refresh } = useFinanceiro();
  const [modal, setModal] = useState<{
    title: string;
    content: React.ReactNode;
  } | null>(null);
  const [showAllTransacoes, setShowAllTransacoes] = useState(false);
  const [filtroForma, setFiltroForma] = useState<string | null>(null);

  const resumo = data?.resumo;
  const transacoes = data?.transacoes || [];
  const formasPagamento = data?.formasPagamento || [];
  const comandas = data?.comandas || [];
  const dashboardGeral = data?.dashboardGeral;
  const grafico = data?.grafico || [];

  const faturamentoBruto = dashboardGeral?.totalBruto || resumo?.totalBruto || 0;
  const faturamentoLiquido = dashboardGeral?.totalBrutoReal || resumo?.totalLiquido || 0;
  const taxas = faturamentoBruto - faturamentoLiquido;

  const porDia = useMemo(
    () => agruparTransacoesPorDia(transacoes),
    [transacoes]
  );

  const ticketMedio =
    comandas.length > 0
      ? faturamentoBruto / comandas.length
      : 0;

  const totalFormasPgto = formasPagamento.reduce(
    (s, f) => s + f.totalBruto,
    0
  );

  const comandasFiltradas = useMemo(() => {
    if (!filtroForma) return comandas;
    return comandas.filter((c) => c.tipoPagamento === filtroForma);
  }, [comandas, filtroForma]);

  const transacoesVisiveis = showAllTransacoes
    ? transacoes
    : transacoes.slice(0, 50);

  // Helper: open modal with day transactions
  function openDayModal(dia: string) {
    const dayTx = transacoes.filter(
      (t) => t.dataMovimentacao.split(" ")[0] === dia
    );
    setModal({
      title: `Transações - ${dia}`,
      content: (
        <div className="space-y-2">
          {dayTx.length === 0 && (
            <p className="text-muted text-sm">Nenhuma transação</p>
          )}
          {dayTx.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-card-border/50 last:border-0"
            >
              <div>
                <span className="text-sm">
                  {pgtoIcon(t.tipoPagamento)} {t.tipoPagamento}
                </span>
                {t.bandeira && (
                  <span className="text-xs text-muted ml-2">
                    ({t.bandeira})
                  </span>
                )}
                <p className="text-xs text-muted">{t.dataMovimentacao}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatBRL(t.valorBruto)}</p>
                {t.valorTaxa > 0 && (
                  <p className="text-xs text-muted">
                    Taxa: {formatBRL(t.valorTaxa)}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-card-border flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-success">
              {formatBRL(dayTx.reduce((s, t) => s + t.valorBruto, 0))}
            </span>
          </div>
        </div>
      ),
    });
  }

  // Helper: open modal with month breakdown
  function openMonthModal(
    m: (typeof grafico)[0]
  ) {
    setModal({
      title: `Detalhes - ${m.mes}`,
      content: (
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Faturamento Bruto</span>
            <span className="font-medium text-success">
              {formatBRL(m.totalBruto)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Serviços</span>
            <span className="font-medium">{formatBRL(m.totalServico)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Produtos</span>
            <span className="font-medium">{formatBRL(m.totalProduto)}</span>
          </div>
          {m.totalOutros > 0 && (
            <div className="flex justify-between py-2 border-b border-card-border/50">
              <span className="text-sm text-muted">Outros</span>
              <span className="font-medium">{formatBRL(m.totalOutros)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Líquido</span>
            <span className="font-medium text-success">
              {formatBRL(m.totalLiquido)}
            </span>
          </div>
        </div>
      ),
    });
  }

  // Helper: open comanda detail modal grouped by client
  function openComandaModal(
    c: (typeof comandas)[0]
  ) {
    const clientCmds = comandas.filter(
      (cmd) => cmd.cliente === c.cliente
    );
    setModal({
      title: c.cliente
        ? `Comandas - ${c.cliente}`
        : "Detalhes da Comanda",
      content: (
        <div className="space-y-3">
          {clientCmds.map((cmd, i) => (
            <div
              key={i}
              className="p-3 bg-background rounded-lg space-y-1"
            >
              <div className="flex justify-between">
                <span className="text-sm font-medium">{cmd.descricao || "Comanda"}</span>
                <span className="text-sm font-bold text-success">
                  {formatBRL(cmd.valorBruto)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>{cmd.dataCadastro}</span>
                <span>
                  {pgtoIcon(cmd.tipoPagamento)} {cmd.tipoPagamento}
                </span>
              </div>
              {cmd.valorReal !== cmd.valorBruto && (
                <p className="text-xs text-muted">
                  Valor real: {formatBRL(cmd.valorReal)}
                </p>
              )}
              {cmd.codExterno && (
                <p className="text-xs text-muted">
                  Cód: {cmd.codExterno}
                </p>
              )}
            </div>
          ))}
          <div className="pt-2 border-t border-card-border flex justify-between font-semibold">
            <span>Total ({clientCmds.length} comandas)</span>
            <span className="text-success">
              {formatBRL(
                clientCmds.reduce((s, cmd) => s + cmd.valorBruto, 0)
              )}
            </span>
          </div>
        </div>
      ),
    });
  }

  // Helper: open forma pagamento detail in modal
  function openFormaModal(tipo: string) {
    const cmds = comandas.filter((c) => c.tipoPagamento === tipo);
    const txs = transacoes.filter((t) => t.tipoPagamento === tipo);
    setModal({
      title: `${pgtoIcon(tipo)} ${tipo}`,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-xs text-muted">Comandas</p>
              <p className="text-lg font-bold">{cmds.length}</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-xs text-muted">Transações</p>
              <p className="text-lg font-bold">{txs.length}</p>
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Total Bruto</span>
            <span className="font-medium text-success">
              {formatBRL(txs.reduce((s, t) => s + t.valorBruto, 0))}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Total Taxas</span>
            <span className="font-medium text-warning">
              {formatBRL(txs.reduce((s, t) => s + t.valorTaxa, 0))}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted">Total Líquido</span>
            <span className="font-medium text-success">
              {formatBRL(txs.reduce((s, t) => s + t.valorLiquido, 0))}
            </span>
          </div>
        </div>
      ),
    });
  }

  // Open transaction detail modal
  function openTransacaoModal(
    t: (typeof transacoes)[0]
  ) {
    setModal({
      title: "Detalhes da Transação",
      content: (
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Data</span>
            <span className="text-sm">{t.dataMovimentacao}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Pagamento</span>
            <span className="text-sm">
              {pgtoIcon(t.tipoPagamento)} {t.tipoPagamento}
            </span>
          </div>
          {t.bandeira && (
            <div className="flex justify-between py-2 border-b border-card-border/50">
              <span className="text-sm text-muted">Bandeira</span>
              <span className="text-sm">{t.bandeira}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Valor Bruto</span>
            <span className="text-sm font-medium">{formatBRL(t.valorBruto)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Taxa</span>
            <span className="text-sm text-warning">
              {t.valorTaxa > 0 ? formatBRL(t.valorTaxa) : "-"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Valor Líquido</span>
            <span className="text-sm font-bold text-success">
              {formatBRL(t.valorLiquido)}
            </span>
          </div>
          {t.comCodigo && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-muted">Código</span>
              <span className="text-sm">{t.comCodigo}</span>
            </div>
          )}
        </div>
      ),
    });
  }

  // Donut chart data
  const donutData = formasPagamento.map((f) => ({
    name: f.tipoPagamento,
    value: f.totalBruto,
  }));

  // Custom tooltip for bar charts
  const DayBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties}>
        <p className="font-medium mb-1">{label}</p>
        <p>{formatBRL(payload[0].value)}</p>
      </div>
    );
  };

  const FormaBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties}>
        <p className="font-medium mb-1">{payload[0].payload.name}</p>
        <p>{formatBRL(payload[0].value)}</p>
        {totalFormasPgto > 0 && (
          <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
            {((payload[0].value / totalFormasPgto) * 100).toFixed(1)}%
          </p>
        )}
      </div>
    );
  };

  const MonthBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties}>
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {formatBRL(p.value)}
          </p>
        ))}
      </div>
    );
  };

  const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties}>
        <p className="font-medium mb-1">{payload[0].name}</p>
        <p>{formatBRL(payload[0].value)}</p>
      </div>
    );
  };

  // Horizontal bar data for formas de pagamento
  const formaBarData = formasPagamento.map((f) => ({
    name: f.tipoPagamento,
    value: f.totalBruto,
  }));

  return (
    <>
      <Header
        title="Financeiro"
        sessionActive={!error}
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
            {error}. Vá em{" "}
            <a href="/configuracoes" className="text-accent underline">
              Configurações
            </a>{" "}
            para configurar a sessão.
          </div>
        )}

        {/* 1. Hero Figure */}
        <div className="bg-card-bg border border-card-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm uppercase tracking-wider mb-2">
            Faturamento Bruto
          </p>
          <p className="text-5xl font-bold text-success leading-tight">
            {formatBRL(faturamentoBruto)}
          </p>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <span className="text-muted">
              Líquido:{" "}
              <span className="text-foreground font-medium">
                {formatBRL(faturamentoLiquido)}
              </span>
            </span>
            <span className="text-muted">
              Taxas:{" "}
              <span className="text-warning font-medium">
                {formatBRL(taxas)}
              </span>
            </span>
          </div>
        </div>

        {/* 2. KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Faturamento Bruto"
            value={formatBRL(faturamentoBruto)}
            icon={DollarSign}
            color="success"
          />
          <MetricCard
            title="Faturamento Líquido"
            value={formatBRL(faturamentoLiquido)}
            icon={TrendingUp}
            color="success"
          />
          <MetricCard
            title="Taxas"
            value={formatBRL(taxas)}
            icon={TrendingDown}
            color="warning"
          />
          <MetricCard
            title="Ticket Médio"
            value={formatBRL(ticketMedio)}
            subtitle={`${comandas.length} comandas`}
            icon={CreditCard}
            color="accent"
          />
        </div>

        {/* 3. Faturamento por Dia - BarChart */}
        {porDia.length > 0 && (
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-accent" />
              Faturamento por Dia
            </h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={porDia}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke={GRID_STYLE.stroke}
                  />
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
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickFormatter={(v) => formatBRLShort(v)}
                  />
                  <Tooltip content={<DayBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Bar
                    dataKey="valor"
                    fill="#2a78d6"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => {
                      if (data?.dia) openDayModal(data.dia);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 4. Resumo Mensal */}
        {grafico.length > 0 && (
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-accent" />
              Resumo Mensal
            </h3>
            {grafico.length > 1 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={grafico}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={GRID_STYLE.stroke}
                    />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickFormatter={(v) => formatBRLShort(v)}
                    />
                    <Tooltip content={<MonthBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "#6b7280" }}
                    />
                    <Bar
                      dataKey="totalServico"
                      name="Serviços"
                      fill="#2a78d6"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(_: any, index: number) => {
                        if (grafico[index]) openMonthModal(grafico[index]);
                      }}
                    />
                    <Bar
                      dataKey="totalProduto"
                      name="Produtos"
                      fill="#eb6834"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(_: any, index: number) => {
                        if (grafico[index]) openMonthModal(grafico[index]);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 cursor-pointer"
                onClick={() => openMonthModal(grafico[0])}
              >
                <div className="p-4 bg-background rounded-lg">
                  <p className="text-sm text-muted mb-1">{grafico[0].mes}</p>
                  <p className="text-lg font-bold text-success">
                    {formatBRL(grafico[0].totalBruto)}
                  </p>
                </div>
                <div className="p-4 bg-background rounded-lg">
                  <p className="text-sm text-muted mb-1">Serviços</p>
                  <p className="text-lg font-bold">
                    {formatBRL(grafico[0].totalServico)}
                  </p>
                </div>
                <div className="p-4 bg-background rounded-lg">
                  <p className="text-sm text-muted mb-1">Produtos</p>
                  <p className="text-lg font-bold">
                    {formatBRL(grafico[0].totalProduto)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Formas de Pagamento - Side by Side */}
        {formasPagamento.length > 0 && (
          <div className="bg-card-bg border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-accent" />
              Formas de Pagamento
              {filtroForma && (
                <button
                  onClick={() => setFiltroForma(null)}
                  className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full hover:bg-accent/30 transition-colors"
                >
                  Limpar filtro: {filtroForma} ×
                </button>
              )}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Horizontal Bar Chart */}
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={formaBarData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke={GRID_STYLE.stroke}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickFormatter={(v) => formatBRLShort(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      width={75}
                    />
                    <Tooltip content={<FormaBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Bar
                      dataKey="value"
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data?.name) setFiltroForma(data.name);
                      }}
                    >
                      {formaBarData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={CATEGORICAL[index % CATEGORICAL.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Right: Donut Chart */}
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<DonutTooltip />} />
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data?.name) openFormaModal(data.name);
                      }}
                    >
                      {donutData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={CATEGORICAL[index % CATEGORICAL.length]}
                        />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value: string) => (
                        <span style={{ color: "#9ca3af", fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 6. Comandas */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Receipt size={18} className="text-accent" />
              Comandas ({comandasFiltradas.length})
              {filtroForma && (
                <span className="text-xs text-muted ml-1">
                  - filtrado por {filtroForma}
                </span>
              )}
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card-bg">
                <tr className="border-b border-card-border text-muted">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">Cliente</th>
                  <th className="text-left px-4 py-2 font-medium">
                    Pagamento
                  </th>
                  <th className="text-right px-4 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {comandasFiltradas.slice(0, 150).map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-card-border/50 hover:bg-accent/5 cursor-pointer"
                    onClick={() => openComandaModal(c)}
                  >
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {c.dataCadastro}
                    </td>
                    <td className="px-4 py-2">
                      <span className="truncate block max-w-[180px]">
                        {c.cliente || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1">
                        {pgtoIcon(c.tipoPagamento)}
                        {c.tipoPagamento}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-success whitespace-nowrap">
                      {formatBRL(c.valorBruto)}
                    </td>
                  </tr>
                ))}
                {comandasFiltradas.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted"
                    >
                      Sem comandas no período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {comandasFiltradas.length > 150 && (
            <div className="px-4 py-2 text-xs text-muted text-center border-t border-card-border">
              Exibindo 150 de {comandasFiltradas.length} comandas
            </div>
          )}
        </div>

        {/* 7. Transacoes Detalhadas - Collapsible */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign size={18} className="text-success" />
              Transações Detalhadas ({transacoes.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card-bg">
                <tr className="border-b border-card-border text-muted">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">
                    Pagamento
                  </th>
                  <th className="text-right px-4 py-2 font-medium">Valor</th>
                  <th className="text-right px-4 py-2 font-medium">Taxa</th>
                  <th className="text-right px-4 py-2 font-medium">
                    Líquido
                  </th>
                </tr>
              </thead>
              <tbody>
                {transacoesVisiveis.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b border-card-border/50 hover:bg-accent/5 cursor-pointer"
                    onClick={() => openTransacaoModal(t)}
                  >
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {t.dataMovimentacao}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1">
                        {pgtoIcon(t.tipoPagamento)}
                        {t.tipoPagamento}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatBRL(t.valorBruto)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted">
                      {t.valorTaxa > 0 ? formatBRL(t.valorTaxa) : "-"}
                    </td>
                    <td className="px-4 py-2 text-right text-success font-medium">
                      {formatBRL(t.valorLiquido)}
                    </td>
                  </tr>
                ))}
                {transacoes.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted"
                    >
                      Sem transações no período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {transacoes.length > 50 && (
            <div className="px-4 py-3 border-t border-card-border flex items-center justify-center">
              <button
                onClick={() => setShowAllTransacoes(!showAllTransacoes)}
                className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors font-medium"
              >
                {showAllTransacoes ? (
                  <>
                    <ChevronUp size={16} />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Mostrar todas ({transacoes.length} transações)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <DetailModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.title || ""}
      >
        {modal?.content}
      </DetailModal>
    </>
  );
}
