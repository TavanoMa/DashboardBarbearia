"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import Header from "@/components/Header";
import ModoBarbeiroToggle from "@/components/ModoBarbeiroToggle";
import Pill from "@/components/financeiro/Pill";
import MesSelect from "@/components/financeiro/MesSelect";
import { useFinanceiroLocal } from "@/hooks/useFinanceiroLocal";
import {
  CAIXA_MINIMO,
  CAIXA_SEGURO,
  MARGEM_SEGURANCA,
  atrasados,
  brl,
  calcControle,
  calcProjecao,
  calcRealizado,
  ddmm,
  diaSemana,
  isoDate,
  mesRelativo,
  saldoAntesDe,
  saldoPorConta,
  type StatusCaixa,
  type StatusNecessidade,
} from "@/lib/financeiro";

type Aba = "realizado" | "projecao" | "controle";

const num = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace("-", "−");
const tomCaixa = (s: StatusCaixa) => (s === "Positivo" ? "pos" : s === "Negativo" ? "neg" : "neu");
const tomNecessidade = (s: StatusNecessidade) => (s === "Ideal" ? "pos" : s === "Saudável" ? "warn" : "neg");
const cor = (n: number) => (n > 0 ? "text-success" : n < 0 ? "text-danger" : "text-muted");

export default function FluxoCaixaPage() {
  const { pronto, hoje, dados, t, op } = useFinanceiroLocal();
  const [aba, setAba] = useState<Aba>("realizado");
  const [offset, setOffset] = useState(0);

  const calc = useMemo(() => {
    const periodo = mesRelativo(hoje, offset);
    const hojeIso = isoDate(hoje);
    const saldoIni = saldoAntesDe(dados.contasBancarias, dados.lancamentos, periodo.inicio);
    const realizado = calcRealizado(dados.lancamentos, saldoIni, periodo.ano, periodo.mes, periodo.ateDia);
    const saldoFim = realizado.length ? realizado[realizado.length - 1].saldoFinal : saldoIni;
    const projecao = periodo.fechado ? [] : calcProjecao(dados.contasPrevistas, saldoFim, hojeIso, periodo.ano, periodo.mes);
    const controle = calcControle(projecao);
    const menor = controle.length
      ? controle.reduce((m, c) => (c.saldoProjetado < m.saldoProjetado ? c : m), controle[0])
      : null;
    return {
      periodo,
      hojeIso,
      realizado,
      saldoFim,
      projecao,
      controle,
      menor,
      atrasados: atrasados(dados.contasPrevistas, hojeIso),
      contas: saldoPorConta(dados.contasBancarias, dados.lancamentos, periodo.fim),
      totalEntradas: realizado.reduce((s, r) => s + r.entradas, 0),
      totalSaidas: realizado.reduce((s, r) => s + r.saidas, 0),
    };
  }, [dados, hoje, offset]);

  const header = (
    <Header
      title={t("menu_fluxo")}
      subtitle={mesRelativo(hoje, offset).nome}
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
        <main className="flex-1 p-6"><div className="h-40 rounded-xl bg-card-bg border border-card-border animate-pulse" /></main>
      </>
    );
  }

  const { menor, periodo } = calc;
  const menorSub = !menor
    ? t("c_sem_proj")
    : menor.status === "Abaixo"
      ? t("c_menor_baixo")
      : menor.status === "Saudável"
        ? t("c_menor_limite")
        : t("c_menor_ok");
  const maiorConta = Math.max(1, ...calc.contas.map((c) => c.saldo));
  const resultadoMes = calc.totalEntradas - calc.totalSaidas;
  const textoSemProj = periodo.fechado ? t("sem_proj_fechado") : t("sem_proj");

  return (
    <>
      {header}
      <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-auto">
        <p className="text-xs text-muted">{t("exemplo_aviso")}</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card
            label={periodo.fechado ? t("c_saldo_fim") : t("c_saldo")}
            valor={brl(calc.saldoFim)}
            sub={periodo.fechado ? `${t("c_fechado")} · ${ddmm(periodo.fim)}` : t("c_saldo_sub")}
            tom={calc.saldoFim >= 0 ? "pos" : "neg"}
          />
          <Card label={t("c_entradas")} valor={brl(calc.totalEntradas)} sub={t("c_entradas_sub")} />
          <Card label={t("c_saidas")} valor={brl(calc.totalSaidas)} sub={t("c_saidas_sub")} tom="neg" />
          {periodo.fechado ? (
            <Card label={t("c_resultado")} valor={brl(resultadoMes)} sub={t("c_fechado")} tom={resultadoMes >= 0 ? "pos" : "neg"} />
          ) : (
            <Card
              label={t("c_menor")}
              valor={menor ? brl(menor.saldoProjetado) : "—"}
              sub={menor ? `${diaSemana(menor.data)}, ${ddmm(menor.data)} · ${menorSub}` : menorSub}
              tom={menor && menor.status !== "Ideal" ? "neg" : "pos"}
            />
          )}
        </div>

        {menor && menor.status === "Abaixo" && (
          <div role="status" className="flex gap-3 items-start rounded-xl border border-warning/60 bg-warning/10 px-4 py-3">
            <TriangleAlert size={20} className="text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">
                {t("al_titulo")} {diaSemana(menor.data).toLowerCase()}, {ddmm(menor.data)}
              </p>
              <p className="text-muted">
                {t("al_texto1")} <strong className="text-foreground font-mono">{brl(menor.saldoProjetado)}</strong>.{" "}
                {t("al_texto2")} <strong className="text-foreground font-mono">{brl(menor.necessidade)}</strong>{" "}
                {t("al_texto3")} ({brl(CAIXA_SEGURO)}).
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3">
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{t("p_onde")}</h3>
            <div className="space-y-3">
              {calc.contas.map((c) => (
                <div key={c.nome} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span>
                      {c.nome} <span className="text-xs text-muted">· {op(c.tipo)}</span>
                    </span>
                    <span className="font-mono tabular-nums">{brl(c.saldo)}</span>
                  </div>
                  <div className="h-1.5 mt-1.5 rounded bg-foreground/5 overflow-hidden">
                    <div className="h-full bg-accent rounded" style={{ width: `${Math.max(0, (c.saldo / maiorConta) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-card-border pt-2">
                <span>{t("p_total")}</span>
                <span className="font-mono tabular-nums">{brl(calc.contas.reduce((s, c) => s + c.saldo, 0))}</span>
              </div>
            </div>
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{t("p_regras")}</h3>
            <dl className="space-y-2 text-sm">
              <Regra label={t("r_min")} valor={brl(CAIXA_MINIMO)} />
              <Regra label={t("r_margem")} valor={`${MARGEM_SEGURANCA * 100}%`} />
              <Regra label={t("r_seguro")} valor={brl(CAIXA_SEGURO)} />
              <Regra label={t("r_recatr")} valor={brl(calc.atrasados.receber)} alerta={calc.atrasados.receber > 0} />
              <Regra label={t("r_pagatr")} valor={brl(calc.atrasados.pagar)} alerta={calc.atrasados.pagar > 0} />
            </dl>
          </div>
        </div>

        <div className="flex gap-1 border-b border-card-border flex-wrap" role="tablist">
          {(["realizado", "projecao", "controle"] as Aba[]).map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                aba === a ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t(a === "realizado" ? "tab_real" : a === "projecao" ? "tab_proj" : "tab_ctrl")}
            </button>
          ))}
        </div>

        {aba === "realizado" && (
          <Tabela nota={t("nota_real")}>
            <thead>
              <tr>
                <Th>{t("th_data")}</Th><Th>{t("th_dia")}</Th>
                <Th num>{t("th_ini")}</Th><Th num>{t("th_ent")}</Th><Th num>{t("th_sai")}</Th>
                <Th num>{t("th_mov")}</Th><Th num>{t("th_fim")}</Th><Th>{t("th_status")}</Th>
              </tr>
            </thead>
            <tbody>
              {calc.realizado.map((r) => (
                <tr key={r.data} className={`border-b border-card-border/60 last:border-0 ${r.data === calc.hojeIso ? "bg-accent/10" : "hover:bg-foreground/[0.03]"}`}>
                  <Td>{ddmm(r.data)}</Td>
                  <Td muted>{r.data === calc.hojeIso ? t("hoje") : diaSemana(r.data)}</Td>
                  <Td num>{num(r.saldoInicial)}</Td>
                  <Td num className={cor(r.entradas)}>{num(r.entradas)}</Td>
                  <Td num className={r.saidas ? "text-danger" : "text-muted"}>{r.saidas ? `−${num(r.saidas)}` : num(0)}</Td>
                  <Td num className={cor(r.movimento)}>{num(r.movimento)}</Td>
                  <Td num>{num(r.saldoFinal)}</Td>
                  <Td><Pill tom={tomCaixa(r.status)}>{t(`s_${r.status}`)}</Pill></Td>
                </tr>
              ))}
              <tr className="bg-foreground/[0.03] font-semibold border-t-2 border-card-border">
                <Td colSpan={2}>{t(periodo.fechado ? "total_mes" : "total_real")}</Td>
                <Td num>{num(calc.realizado[0]?.saldoInicial ?? 0)}</Td>
                <Td num className="text-success">{num(calc.totalEntradas)}</Td>
                <Td num className="text-danger">−{num(calc.totalSaidas)}</Td>
                <Td num className={cor(calc.totalEntradas - calc.totalSaidas)}>{num(calc.totalEntradas - calc.totalSaidas)}</Td>
                <Td num>{num(calc.saldoFim)}</Td>
                <Td />
              </tr>
            </tbody>
          </Tabela>
        )}

        {aba === "projecao" && (
          calc.projecao.length === 0 ? <Vazio texto={textoSemProj} /> : (
            <Tabela nota={t("nota_proj")}>
              <thead>
                <tr>
                  <Th>{t("th_data")}</Th><Th>{t("th_dia")}</Th>
                  <Th num>{t("th_rec")}</Th><Th num>{t("th_pag")}</Th><Th num>{t("th_res")}</Th>
                  <Th num>{t("th_sproj")}</Th><Th>{t("th_sprojst")}</Th>
                </tr>
              </thead>
              <tbody>
                {calc.projecao.map((p) => (
                  <tr key={p.data} className={`border-b border-card-border/60 last:border-0 ${p.data === calc.hojeIso ? "bg-accent/10" : "hover:bg-foreground/[0.03]"}`}>
                    <Td>{ddmm(p.data)}</Td>
                    <Td muted>{p.data === calc.hojeIso ? t("hoje") : diaSemana(p.data)}</Td>
                    <Td num className={cor(p.entradasPrevistas)}>{num(p.entradasPrevistas)}</Td>
                    <Td num className={p.saidasPrevistas ? "text-danger" : "text-muted"}>{p.saidasPrevistas ? `−${num(p.saidasPrevistas)}` : num(0)}</Td>
                    <Td num className={cor(p.resultado)}>{num(p.resultado)}</Td>
                    <Td num>{num(p.saldoProjetado)}</Td>
                    <Td><Pill tom={tomCaixa(p.status)}>{t(`s_${p.status}`)}</Pill></Td>
                  </tr>
                ))}
                <tr className="bg-foreground/[0.03] font-semibold border-t-2 border-card-border">
                  <Td colSpan={2}>{t("total_proj")}</Td>
                  <Td num className="text-success">{num(calc.projecao.reduce((s, p) => s + p.entradasPrevistas, 0))}</Td>
                  <Td num className="text-danger">−{num(calc.projecao.reduce((s, p) => s + p.saidasPrevistas, 0))}</Td>
                  <Td num>{num(calc.projecao.reduce((s, p) => s + p.resultado, 0))}</Td>
                  <Td num>{num(calc.projecao[calc.projecao.length - 1].saldoProjetado)}</Td>
                  <Td />
                </tr>
              </tbody>
            </Tabela>
          )
        )}

        {aba === "controle" && (
          calc.controle.length === 0 ? <Vazio texto={textoSemProj} /> : (
            <Tabela nota={t("nota_ctrl")}>
              <thead>
                <tr>
                  <Th>{t("th_data")}</Th><Th num>{t("th_sproj")}</Th><Th num>{t("th_def")}</Th>
                  <Th>{t("th_sdef")}</Th><Th num>{t("th_nec")}</Th><Th>{t("th_snec")}</Th>
                </tr>
              </thead>
              <tbody>
                {calc.controle.map((c) => (
                  <tr key={c.data} className={`border-b border-card-border/60 last:border-0 ${c.data === calc.hojeIso ? "bg-accent/10" : "hover:bg-foreground/[0.03]"}`}>
                    <Td>{ddmm(c.data)} <span className="text-xs text-muted">{c.data === calc.hojeIso ? t("hoje") : diaSemana(c.data)}</span></Td>
                    <Td num>{num(c.saldoProjetado)}</Td>
                    <Td num className={c.emDeficit ? "text-danger" : "text-muted"}>{num(c.deficit)}</Td>
                    <Td><Pill tom={c.emDeficit ? "neg" : "neu"}>{t(c.emDeficit ? "s_deficit" : "s_ok")}</Pill></Td>
                    <Td num className={c.necessidade > 0 ? "text-danger" : "text-muted"}>{num(c.necessidade)}</Td>
                    <Td><Pill tom={tomNecessidade(c.status)}>{t(`s_${c.status}`)}</Pill></Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )
        )}
      </main>
    </>
  );
}

function Card({ label, valor, sub, tom }: { label: string; valor: string; sub: string; tom?: "pos" | "neg" }) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-mono text-lg sm:text-xl tabular-nums mt-1 ${tom === "pos" ? "text-success" : tom === "neg" ? "text-danger" : ""}`}>{valor}</p>
      <p className="text-xs text-muted/80 mt-1">{sub}</p>
    </div>
  );
}

function Regra({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-mono tabular-nums ${alerta ? "text-danger" : ""}`}>{valor}</dd>
    </div>
  );
}

function Tabela({ nota, children }: { nota: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{nota}</p>
      <div className="overflow-x-auto bg-card-bg border border-card-border rounded-xl">
        <table className="w-full text-sm tabular-nums">{children}</table>
      </div>
    </div>
  );
}

function Th({ children, num: n }: { children: React.ReactNode; num?: boolean }) {
  return (
    <th className={`px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted border-b border-card-border whitespace-nowrap ${n ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, num: n, muted, className = "", colSpan }: { children?: React.ReactNode; num?: boolean; muted?: boolean; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-3.5 py-2.5 whitespace-nowrap ${n ? "text-right font-mono" : ""} ${muted ? "text-xs text-muted" : ""} ${className}`}>
      {children}
    </td>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="bg-card-bg border border-card-border rounded-xl p-10 text-center text-sm text-muted">{texto}</div>;
}
