"use client";

import { useState, useMemo } from "react";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Layers,
  Search,
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
import { useEstoque } from "@/hooks/useEstoque";
import type { ProdutoEstoque } from "@/app/api/estoque/route";

export default function EstoquePage() {
  const { data, loading, error, refresh } = useEstoque();
  const [modal, setModal] = useState<{
    title: string;
    content: React.ReactNode;
  } | null>(null);
  const [busca, setBusca] = useState("");

  const produtos = data?.produtos || [];

  // --- KPIs ---
  const totalProdutos = produtos.length;

  const valorTotalEstoque = useMemo(
    () => produtos.reduce((s, p) => s + p.saldo * p.valor, 0),
    [produtos]
  );

  const produtosAbaixoMinimo = useMemo(
    () => produtos.filter((p) => p.saldo < p.qtdMinima),
    [produtos]
  );

  const categoriasUnicas = useMemo(
    () => new Set(produtos.map((p) => p.categoria).filter(Boolean)).size,
    [produtos]
  );

  // --- Donut: products per category ---
  const donutData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of produtos) {
      const cat = p.categoria || "Sem categoria";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [produtos]);

  // --- Top 10 by stock value ---
  const top10Valor = useMemo(
    () =>
      [...produtos]
        .map((p) => ({ name: p.descricao, value: p.saldo * p.valor }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [produtos]
  );

  // --- Filtered products ---
  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return produtos;
    const q = busca.toLowerCase();
    return produtos.filter(
      (p) =>
        p.descricao.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q)
    );
  }, [produtos, busca]);

  // --- Modal: product detail ---
  function openProdutoModal(p: ProdutoEstoque) {
    const abaixo = p.saldo < p.qtdMinima;
    setModal({
      title: p.descricao,
      content: (
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Codigo</span>
            <span className="text-sm">{p.codigo}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Categoria</span>
            <span className="text-sm">{p.categoria || "-"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Marca</span>
            <span className="text-sm">{p.marca || "-"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Estoque</span>
            <span
              className={`text-sm font-medium ${
                abaixo ? "text-danger" : "text-foreground"
              }`}
            >
              {p.saldo} {p.unidade}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Qtd Minima</span>
            <span className="text-sm">{p.qtdMinima} {p.unidade}</span>
          </div>
          {abaixo && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 text-xs text-danger">
              Produto abaixo do estoque minimo!
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Preco Venda</span>
            <span className="text-sm font-medium text-success">
              {formatBRL(p.valor)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Preco Compra</span>
            <span className="text-sm">{formatBRL(p.valorCompra)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Valor Profissional</span>
            <span className="text-sm">{formatBRL(p.valorProfissional)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border/50">
            <span className="text-sm text-muted">Comissao</span>
            <span className="text-sm">{p.comissao || "-"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted">Valor em Estoque</span>
            <span className="text-sm font-bold text-success">
              {formatBRL(p.saldo * p.valor)}
            </span>
          </div>
        </div>
      ),
    });
  }

  // --- Custom tooltips ---
  const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties}>
        <p className="font-medium mb-1">{payload[0].name}</p>
        <p>{payload[0].value} produtos</p>
      </div>
    );
  };

  const BarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties}>
        <p className="font-medium mb-1">{payload[0].payload.name}</p>
        <p>{formatBRL(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <>
      <Header
        title="Estoque"
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
            {error}. Va em{" "}
            <a href="/configuracoes" className="text-accent underline">
              Configuracoes
            </a>{" "}
            para configurar a sessao.
          </div>
        )}

        {/* 1. KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Produtos"
            value={totalProdutos}
            icon={Package}
            color="accent"
          />
          <MetricCard
            title="Valor Total em Estoque"
            value={formatBRL(valorTotalEstoque)}
            icon={DollarSign}
            color="success"
          />
          <MetricCard
            title="Abaixo do Minimo"
            value={produtosAbaixoMinimo.length}
            icon={AlertTriangle}
            color={produtosAbaixoMinimo.length > 0 ? "danger" : "success"}
          />
          <MetricCard
            title="Categorias"
            value={categoriasUnicas}
            icon={Layers}
            color="accent"
          />
        </div>

        {/* 2. Charts Row */}
        {produtos.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut: distribution by category */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Layers size={18} className="text-accent" />
                Produtos por Categoria
              </h3>
              <div className="h-[300px]">
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

            {/* Horizontal BarChart: top 10 by stock value */}
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-success" />
                Top 10 - Valor em Estoque
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top10Valor}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
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
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      content={<BarTooltip />}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {top10Valor.map((_, index) => (
                        <Cell
                          key={index}
                          fill={CATEGORICAL[index % CATEGORICAL.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 3. Alert: products below minimum */}
        {produtosAbaixoMinimo.length > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-danger">
              <AlertTriangle size={18} />
              Produtos Abaixo do Estoque Minimo ({produtosAbaixoMinimo.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {produtosAbaixoMinimo.map((p) => (
                <div
                  key={p.codigo}
                  className="bg-background/50 border border-danger/20 rounded-lg p-3 cursor-pointer hover:border-danger/50 transition-colors"
                  onClick={() => openProdutoModal(p)}
                >
                  <p className="text-sm font-medium truncate">{p.descricao}</p>
                  <div className="flex justify-between mt-1 text-xs">
                    <span className="text-danger font-medium">
                      Estoque: {p.saldo} {p.unidade}
                    </span>
                    <span className="text-muted">
                      Min: {p.qtdMinima} {p.unidade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Products Table */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package size={18} className="text-accent" />
              Todos os Produtos ({produtosFiltrados.length})
            </h3>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                placeholder="Buscar produto, categoria ou marca..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="bg-background border border-card-border rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-accent/50 w-full sm:w-72 transition-colors"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card-bg">
                <tr className="border-b border-card-border text-muted">
                  <th className="text-left px-4 py-2 font-medium">Produto</th>
                  <th className="text-left px-4 py-2 font-medium">Categoria</th>
                  <th className="text-left px-4 py-2 font-medium">Marca</th>
                  <th className="text-right px-4 py-2 font-medium">Estoque</th>
                  <th className="text-right px-4 py-2 font-medium">Minimo</th>
                  <th className="text-right px-4 py-2 font-medium">
                    Preco Venda
                  </th>
                  <th className="text-right px-4 py-2 font-medium">
                    Valor Profissional
                  </th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((p) => {
                  const abaixo = p.saldo < p.qtdMinima;
                  return (
                    <tr
                      key={p.codigo}
                      className={`border-b border-card-border/50 cursor-pointer transition-colors ${
                        abaixo
                          ? "bg-danger/10 hover:bg-danger/15"
                          : "hover:bg-accent/5"
                      }`}
                      onClick={() => openProdutoModal(p)}
                    >
                      <td className="px-4 py-2">
                        <span className="truncate block max-w-[200px]">
                          {p.descricao}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted">{p.categoria || "-"}</td>
                      <td className="px-4 py-2 text-muted">{p.marca || "-"}</td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          abaixo ? "text-danger" : "text-foreground"
                        }`}
                      >
                        {p.saldo}
                      </td>
                      <td className="px-4 py-2 text-right text-muted">
                        {p.qtdMinima}
                      </td>
                      <td className="px-4 py-2 text-right text-success font-medium whitespace-nowrap">
                        {formatBRL(p.valor)}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {formatBRL(p.valorProfissional)}
                      </td>
                    </tr>
                  );
                })}
                {produtosFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted"
                    >
                      {busca
                        ? "Nenhum produto encontrado"
                        : "Sem produtos cadastrados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
