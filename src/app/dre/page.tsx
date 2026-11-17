"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Percent,
} from "lucide-react";
import Header from "@/components/Header";
import ModoBarbeiroToggle from "@/components/ModoBarbeiroToggle";
import MesSelect from "@/components/financeiro/MesSelect";
import { useFinanceiroLocal } from "@/hooks/useFinanceiroLocal";
import {
  calcDRE,
  mesRelativo,
  type LinhaDRE,
} from "@/lib/financeiro";

// ---------------------------------------------------------------------------
// Helpers visuais
// ---------------------------------------------------------------------------

const corValor = (valor: number, sinal: LinhaDRE["sinal"]) => {
  if (sinal === "menos") return "text-danger";
  if (sinal === "igual") return valor >= 0 ? "text-success" : "text-danger";
  return "";
};

const corMargem = (pct: number) =>
  pct >= 20 ? "text-success" : pct >= 10 ? "text-warning" : pct >= 0 ? "text-muted" : "text-danger";

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function DrePage() {
  const { pronto, hoje, dados, t, op, cifra, cifraNum } = useFinanceiroLocal();
  const [offset, setOffset] = useState(0);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  const dre = useMemo(() => {
    const periodo = mesRelativo(hoje, offset);
    return calcDRE(dados.lancamentos, periodo.inicio, periodo.fim);
  }, [dados.lancamentos, hoje, offset]);

  const periodo = mesRelativo(hoje, offset);

  const header = (
    <Header
      title={t("menu_dre")}
      subtitle={periodo.nome}
      hideDateRange
      actions={
        <>
          <MesSelect value={offset} onChange={setOffset} />
          <ModoBarbeiroToggle />
        </>
      }
    />
  );

  if (!pronto) {
    return (
      <>
        {header}
        <main className="flex-1 p-6">
          <div className="h-40 rounded-xl bg-card-bg border border-card-border animate-pulse" />
        </main>
      </>
    );
  }

  const temLancamento = dre.receitaBruta > 0 || dre.linhas.some((l) => l.valor !== 0);
  const resultadoPositivo = dre.resultadoLiquido >= 0;
  const abaixoDaLinhaTotal = dre.capex + dre.retiradas + dre.depreciacao + dre.provisoes;

  const toggleLinha = (key: string) =>
    setAberto((a) => ({ ...a, [key]: !a[key] }));

  return (
    <>
      {header}
      <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-auto">
        <p className="text-xs text-muted">{t("exemplo_aviso")}</p>

        {!temLancamento ? (
          <div className="bg-card-bg border border-card-border rounded-xl p-10 text-center">
            <Receipt size={32} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">{t("dre_vazio")}</p>
          </div>
        ) : (
          <>
            {/* 4 cards — resumo visual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <CardResumo
                titulo={t("dre_card_receita")}
                valor={cifra(dre.receitaLiquida)}
                sub={t("dre_card_receita_sub")}
                icone={<Wallet size={18} />}
                tom="accent"
              />
              <CardResumo
                titulo={t("dre_card_lucro")}
                valor={cifra(dre.lucroBruto)}
                sub={`${t("dre_margem_bruta")}: ${dre.margemBruta.toFixed(1)}%`}
                icone={<TrendingUp size={18} />}
                tom={dre.lucroBruto >= 0 ? "ok" : "ruim"}
              />
              <CardResumo
                titulo={t("dre_card_ebitda")}
                valor={cifra(dre.ebitda)}
                sub={`${t("dre_margem_op")}: ${dre.margemOperacional.toFixed(1)}%`}
                icone={<Percent size={18} />}
                tom={dre.ebitda >= 0 ? "ok" : "ruim"}
              />
              <CardResumo
                titulo={t("dre_card_liquido")}
                valor={cifra(dre.resultadoLiquido)}
                sub={`${t("dre_margem_liq")}: ${dre.margemLiquida.toFixed(1)}%`}
                icone={resultadoPositivo ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                tom={resultadoPositivo ? "ok" : "ruim"}
                destaque
              />
            </div>

            {/* Tabela DRE */}
            <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-card-border text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {t("dre_h_rotulo")}
                    </th>
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {t("dre_h_valor")}
                    </th>
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted hidden sm:table-cell">
                      {t("dre_h_pct")}
                    </th>
                    <th className="px-2 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {dre.linhas.map((l, idx) => {
                    const expansivel = !!l.itens && l.itens.length > 0;
                    const key = `${idx}-${l.rotulo}`;
                    const expandido = aberto[key];
                    const pct =
                      dre.receitaLiquida > 0
                        ? (Math.abs(l.valor) / dre.receitaLiquida) * 100
                        : 0;

                    return (
                      <React.Fragment key={key}>
                        <tr
                          className={`border-b border-card-border/60 ${
                            l.destaque
                              ? "bg-background/50 font-semibold"
                              : expansivel
                                ? "hover:bg-foreground/[0.02] cursor-pointer"
                                : ""
                          }`}
                          onClick={expansivel ? () => toggleLinha(key) : undefined}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {l.destaque && (
                                <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
                              )}
                              <span
                                className={
                                  l.destaque
                                    ? "text-foreground"
                                    : l.sinal === "menos"
                                      ? "text-muted"
                                      : ""
                                }
                              >
                                {opRotulo(l.rotulo, op)}
                              </span>
                              {l.rotulo.includes("Resultado Líquido") && (
                                <span
                                  className={`ml-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                    resultadoPositivo
                                      ? "bg-success/15 text-success"
                                      : "bg-danger/15 text-danger"
                                  }`}
                                >
                                  {resultadoPositivo ? "Lucro" : "Prejuízo"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono ${corValor(l.valor, l.sinal)}`}
                          >
                            {l.sinal === "menos" && l.valor !== 0
                              ? `(${cifraNum(Math.abs(l.valor))})`
                              : cifra(l.valor)}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-muted hidden sm:table-cell">
                            {l.rotulo.startsWith("Receita Bruta")
                              ? ""
                              : l.rotulo.includes("Lucro Bruto")
                                ? `${dre.margemBruta.toFixed(1)}%`
                                : l.rotulo.includes("EBITDA")
                                  ? `${dre.margemOperacional.toFixed(1)}%`
                                  : l.rotulo.includes("Resultado Líquido")
                                    ? `${dre.margemLiquida.toFixed(1)}%`
                                    : l.valor !== 0 && dre.receitaLiquida > 0
                                      ? `${pct.toFixed(1)}%`
                                      : ""}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {expansivel &&
                              (expandido ? (
                                <ChevronDown size={14} className="text-muted inline" />
                              ) : (
                                <ChevronRight size={14} className="text-muted inline" />
                              ))}
                          </td>
                        </tr>
                        {expansivel &&
                          expandido &&
                          l.itens!.map((item) => (
                            <tr
                              key={`${key}-${item.nome}`}
                              className="border-b border-card-border/30 bg-background/30 text-xs"
                            >
                              <td className="pl-10 pr-4 py-2 text-muted">{op(item.nome)}</td>
                              <td
                                className={`px-3 py-2 text-right font-mono ${
                                  l.sinal === "menos" ? "text-danger/80" : ""
                                }`}
                              >
                                {l.sinal === "menos"
                                  ? `(${cifraNum(item.total)})`
                                  : cifraNum(item.total)}
                              </td>
                              <td className="px-3 py-2 text-right text-muted hidden sm:table-cell">
                                {dre.receitaLiquida > 0
                                  ? `${((item.total / dre.receitaLiquida) * 100).toFixed(1)}%`
                                  : ""}
                              </td>
                              <td />
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Margens em destaque */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CardMargem rotulo={t("dre_margem_bruta")} pct={dre.margemBruta} />
              <CardMargem rotulo={t("dre_margem_op")} pct={dre.margemOperacional} />
              <CardMargem rotulo={t("dre_margem_liq")} pct={dre.margemLiquida} />
            </div>

            {/* Abaixo da linha */}
            {abaixoDaLinhaTotal > 0 && (
              <div className="bg-card-bg border border-card-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{t("dre_abaixo")}</h3>
                    <p className="text-xs text-muted mt-0.5">{t("dre_abaixo_nota")}</p>
                  </div>
                  <span className="font-mono text-base tabular-nums text-muted">
                    {cifra(abaixoDaLinhaTotal)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <ItemAbaixo rotulo={t("dre_capex")} valor={dre.capex} cifra={cifra} />
                  <ItemAbaixo rotulo={t("dre_retiradas")} valor={dre.retiradas} cifra={cifra} />
                  <ItemAbaixo rotulo={t("dre_depreciacao")} valor={dre.depreciacao} cifra={cifra} />
                  <ItemAbaixo rotulo={t("dre_provisoes")} valor={dre.provisoes} cifra={cifra} />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pequenos componentes
// ---------------------------------------------------------------------------

function CardResumo({
  titulo,
  valor,
  sub,
  icone,
  tom,
  destaque,
}: {
  titulo: string;
  valor: string;
  sub: string;
  icone: React.ReactNode;
  tom: "accent" | "ok" | "ruim";
  destaque?: boolean;
}) {
  const borda =
    tom === "ok" ? "border-success/40" : tom === "ruim" ? "border-danger/40" : "border-card-border";
  const bg =
    tom === "ok"
      ? "bg-success/10 text-success"
      : tom === "ruim"
        ? "bg-danger/10 text-danger"
        : "bg-accent/10 text-accent";
  return (
    <div
      className={`bg-card-bg border rounded-xl p-4 text-center ${borda} ${
        destaque ? "ring-1 ring-accent/20" : ""
      }`}
    >
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mx-auto mb-2 ${bg}`}>
        {icone}
      </div>
      <p className="text-xs text-muted">{titulo}</p>
      <p className="font-mono text-lg sm:text-xl tabular-nums mt-0.5">{valor}</p>
      <p className="text-[11px] text-muted/80 mt-1">{sub}</p>
    </div>
  );
}

function CardMargem({ rotulo, pct }: { rotulo: string; pct: number }) {
  const barWidth = Math.min(100, Math.max(0, pct));
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{rotulo}</p>
        <p className={`font-mono text-base font-semibold tabular-nums ${corMargem(pct)}`}>
          {pct.toFixed(1)}%
        </p>
      </div>
      <div className="h-1.5 mt-2 rounded bg-foreground/5 overflow-hidden">
        <div
          className={`h-full rounded ${
            pct >= 20
              ? "bg-success"
              : pct >= 10
                ? "bg-warning"
                : pct >= 0
                  ? "bg-muted/60"
                  : "bg-danger"
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

function ItemAbaixo({
  rotulo,
  valor,
  cifra,
}: {
  rotulo: string;
  valor: number;
  cifra: (n: number) => string;
}) {
  return (
    <div className="bg-background border border-card-border/60 rounded-lg p-3 text-center">
      <p className="text-[11px] text-muted">{rotulo}</p>
      <p className={`font-mono text-sm mt-1 ${valor > 0 ? "text-danger" : "text-muted"}`}>
        {cifra(valor)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tradução dos rótulos fixos pro Modo Barbearia
// ---------------------------------------------------------------------------

const ROTULOS_TRAD: Record<string, string> = {
  "Receita Bruta": "Entrou (sem tirar taxa)",
  "(−) Deduções da receita (taxas de cartão)": "(−) Taxa do cartão",
  "(=) Receita Líquida": "(=) Entrou (depois das taxas)",
  "(−) Custos Operacionais": "(−) Custos do dia a dia",
  "(=) Lucro Bruto": "(=) Sobrou dos custos",
  "(−) Despesas Fixas": "(−) Contas fixas",
  "(−) Despesas Variáveis": "(−) Contas que variam",
  "(−) Despesas Administrativas": "(−) Administração",
  "(−) Despesas Comerciais": "(−) Marketing e venda",
  "(=) Resultado Operacional (EBITDA)": "(=) Sobrou da operação",
  "(−) Despesas Financeiras": "(−) Juros e bancos",
  "(−) Despesas Tributárias": "(−) Impostos",
  "(=) Resultado Líquido": "(=) Sobrou no fim",
};

function opRotulo(rotulo: string, op: (v: string) => string) {
  // Só reaproveita o op() para marcar que o Modo Barbearia alterou alguma coisa;
  // o dicionário acima é que faz a tradução real.
  const alvo = ROTULOS_TRAD[rotulo];
  return alvo ? op(alvo) : rotulo;
}
