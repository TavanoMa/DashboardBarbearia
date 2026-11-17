"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Percent, Wallet, TrendingUp, Calendar, Scissors, Save, Check, Pencil } from "lucide-react";
import Header from "@/components/Header";
import { useStore } from "@/hooks/useStore";
import { useOcultarValores } from "@/lib/ocultar";
import {
  parseComissoes,
  agruparComissoesPorProfissional,
} from "@/lib/parser";
import type { ComissaoDetalhe, ComissaoProfissional, ComissaoDetalheRaw } from "@/lib/types";
import { formatBRL } from "@/components/charts/ChartColors";

// ---------------------------------------------------------------------------
// Constantes e helpers
// ---------------------------------------------------------------------------

const PERCENT_PADRAO = 40; // % padrão da barbearia Cacique's (exemplo)
const CHAVE_PCTS = "cacique_comissoes_pcts"; // { [profissional]: percentual }
const CHAVE_PAGOS = "cacique_comissoes_pagos"; // { [chave-semana-profissional]: true }

interface ComissaoAPI {
  detalhe: ComissaoDetalheRaw[] | ComissaoDetalhe[];
  porProfissional: ComissaoProfissional[];
}

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Segunda da semana corrente (ISO: a semana começa na segunda). */
function segundaIso(): string {
  const d = new Date();
  // 0=domingo, 1=segunda, ... — se for domingo, volta 6 dias; senão volta (dow-1)
  const dow = d.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type RangePreset = "semana" | "mes" | "personalizado";

function labelDoRange(ini: string, fim: string): string {
  const [yi, mi, di] = ini.split("-");
  const [yf, mf, df] = fim.split("-");
  if (ini === fim) return `${di}/${mi}/${yi}`;
  if (yi === yf && mi === mf) return `${di} a ${df}/${mi}/${yi}`;
  return `${di}/${mi}/${yi} — ${df}/${mf}/${yf}`;
}

function chaveSemana(ini: string, prof: string): string {
  return `${ini}::${prof}`;
}

// ---------------------------------------------------------------------------
// Data fetch isolado (não mexe no range global)
// ---------------------------------------------------------------------------

function useComissoesRange(ini: string, fim: string, store: string | undefined) {
  const [detalhe, setDetalhe] = useState<ComissaoDetalhe[]>([]);
  const [porProfissional, setPorProfissional] = useState<ComissaoProfissional[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/comissoes?dataIni=${ini}&dataFim=${fim}&store=${store}`);
      if (res.status === 401) {
        setSessionActive(false);
        setDetalhe([]);
        setPorProfissional([]);
        return;
      }
      if (!res.ok) throw new Error("Falha na requisição");
      const json = (await res.json()) as ComissaoAPI;
      // detalhe pode vir já parseado (/api/comissoes faz parse) ou em raw
      const det = Array.isArray(json.detalhe)
        ? ("valor" in (json.detalhe[0] || {})
            ? (json.detalhe as ComissaoDetalhe[])
            : parseComissoes(json.detalhe as ComissaoDetalheRaw[]))
        : [];
      setDetalhe(det);
      setPorProfissional(
        Array.isArray(json.porProfissional) && json.porProfissional.length > 0
          ? json.porProfissional
          : agruparComissoesPorProfissional(det)
      );
      setSessionActive(true);
      setLastUpdate(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [ini, fim, store]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { detalhe, porProfissional, loading, sessionActive, lastUpdate, erro, refresh: fetchData };
}

// ---------------------------------------------------------------------------
// Persistência leve (porcentagens + marcas de pago) — tolerante a SSR
// ---------------------------------------------------------------------------

function lerJson<T>(chave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function salvarJson(chave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function ComissoesPage() {
  const ocultarValores = useOcultarValores();
  const { currentStore } = useStore();

  const [preset, setPreset] = useState<RangePreset>("semana");
  const [iniCustom, setIniCustom] = useState<string>(segundaIso());
  const [fimCustom, setFimCustom] = useState<string>(hojeIso());

  const { ini, fim, destaque } = useMemo(() => {
    if (preset === "semana") return { ini: segundaIso(), fim: hojeIso(), destaque: true };
    if (preset === "mes") return { ini: firstOfMonthIso(), fim: hojeIso(), destaque: false };
    return { ini: iniCustom, fim: fimCustom, destaque: false };
  }, [preset, iniCustom, fimCustom]);

  const { detalhe, porProfissional, loading, sessionActive, lastUpdate, refresh } =
    useComissoesRange(ini, fim, currentStore);

  // Porcentagens personalizadas (persistidas)
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [pagos, setPagos] = useState<Record<string, boolean>>({});
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setPcts(lerJson<Record<string, number>>(CHAVE_PCTS, {}));
    setPagos(lerJson<Record<string, boolean>>(CHAVE_PAGOS, {}));
    setHidratado(true);
  }, []);

  const mudarPct = (prof: string, valor: string) => {
    const n = parseFloat(valor.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    const next = { ...pcts, [prof]: Math.min(100, n) };
    setPcts(next);
    salvarJson(CHAVE_PCTS, next);
  };

  const togglePago = (prof: string) => {
    const k = chaveSemana(ini, prof);
    const next = { ...pagos, [k]: !pagos[k] };
    setPagos(next);
    salvarJson(CHAVE_PAGOS, next);
  };

  // ---------------------------------------------------------------------
  // Agregação — cruza "porProfissional" com os atendimentos do detalhe
  // ---------------------------------------------------------------------

  const barbeiros = useMemo(() => {
    const atendPorProf = new Map<string, number>();
    for (const c of detalhe) {
      if (!c.profissional) continue;
      atendPorProf.set(c.profissional, (atendPorProf.get(c.profissional) || 0) + 1);
    }

    // Garante que todo profissional que aparece em algum lugar entre
    const nomes = new Set<string>([
      ...porProfissional.map((p) => p.nome),
      ...atendPorProf.keys(),
    ]);

    return Array.from(nomes).map((nome) => {
      const agg = porProfissional.find((p) => p.nome === nome);
      const bruto = agg?.totalBruto ?? 0;
      const atend = agg?.atendimentos ?? atendPorProf.get(nome) ?? 0;
      const pct = hidratado && pcts[nome] !== undefined ? pcts[nome] : PERCENT_PADRAO;
      const aPagar = (bruto * pct) / 100;
      const pago = hidratado ? !!pagos[chaveSemana(ini, nome)] : false;
      return { nome, atendimentos: atend, bruto, pct, aPagar, pago };
    }).sort((a, b) => b.aPagar - a.aPagar);
  }, [detalhe, porProfissional, pcts, pagos, hidratado, ini]);

  const totalFaturado = barbeiros.reduce((s, b) => s + b.bruto, 0);
  const totalAtendimentos = barbeiros.reduce((s, b) => s + b.atendimentos, 0);
  const totalAPagar = barbeiros.reduce((s, b) => s + b.aPagar, 0);
  const totalPago = barbeiros.filter((b) => b.pago).reduce((s, b) => s + b.aPagar, 0);
  const totalRestante = totalAPagar - totalPago;

  const cifra = (n: number) => (ocultarValores ? "R$ ••••" : formatBRL(n));

  const actions = (
    <div className="flex items-center gap-1.5 bg-background rounded-lg p-1 border border-card-border">
      {([
        ["semana", "Esta semana"],
        ["mes", "Este mês"],
        ["personalizado", "Personalizado"],
      ] as [RangePreset, string][]).map(([p, label]) => (
        <button
          key={p}
          type="button"
          onClick={() => setPreset(p)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            preset === p ? "bg-accent text-sidebar-bg" : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Header
        title="Comissões"
        subtitle={labelDoRange(ini, fim)}
        sessionActive={sessionActive}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={refresh}
        hideDateRange
        actions={actions}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-auto">
        {!sessionActive && !loading && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
            Sessão não configurada. Vá em{" "}
            <a href="/configuracoes" className="text-accent underline">
              Configurações
            </a>{" "}
            e cole o PHPSESSID.
          </div>
        )}

        {preset === "personalizado" && (
          <div className="flex items-center gap-2 bg-card-bg border border-card-border rounded-xl p-3 w-fit">
            <Calendar size={16} className="text-muted" />
            <input
              type="date"
              value={iniCustom}
              max={fimCustom}
              onChange={(e) => setIniCustom(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
            <span className="text-muted text-xs">até</span>
            <input
              type="date"
              value={fimCustom}
              min={iniCustom}
              max={hojeIso()}
              onChange={(e) => setFimCustom(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </div>
        )}

        {/* HERO: Total a pagar */}
        <div
          className={`rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
            destaque
              ? "bg-accent/10 border-2 border-accent"
              : "bg-card-bg border border-card-border"
          }`}
        >
          <div className={`p-3 rounded-xl ${destaque ? "bg-accent/20" : "bg-accent/10"}`}>
            <Wallet size={28} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-sm">
              {destaque ? "Pagar na segunda" : "Total a pagar no período"}
            </p>
            <p className="text-5xl font-bold mt-1 tracking-tight">{cifra(totalAPagar)}</p>
            <p className="text-muted text-sm mt-2">
              Faturamento: <span className="text-foreground font-semibold">{cifra(totalFaturado)}</span>
              <span className="mx-2">·</span>
              {totalAtendimentos} atendimento{totalAtendimentos !== 1 ? "s" : ""}
              {totalPago > 0 && (
                <>
                  <span className="mx-2">·</span>
                  Já pago: <span className="text-success font-semibold">{cifra(totalPago)}</span>
                  <span className="mx-2">·</span>
                  Falta: <span className="text-warning font-semibold">{cifra(totalRestante)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Nota explicativa */}
        <p className="text-xs text-muted flex items-start gap-1.5">
          <Pencil size={11} className="mt-0.5 shrink-0" />
          O percentual de cada barbeiro é apenas um exemplo (padrão {PERCENT_PADRAO}%). Clique no valor para
          editar — a configuração fica salva neste navegador.
        </p>

        {/* Tabela de barbeiros */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
          {barbeiros.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">
              {loading ? "Carregando comissões..." : "Sem atendimentos no período."}
            </p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Barbeiro
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Atendimentos
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Faturamento
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">
                    %
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">
                    A pagar
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Pago?
                  </th>
                </tr>
              </thead>
              <tbody>
                {barbeiros.map((b) => (
                  <tr
                    key={b.nome}
                    className={`border-b border-card-border/60 last:border-0 transition-colors ${
                      b.pago ? "opacity-60 bg-success/5" : "hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Scissors size={14} className="text-muted" />
                        {b.nome}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-muted">{b.atendimentos}</td>
                    <td className="px-3 py-3 text-right font-mono">{cifra(b.bruto)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1 bg-background border border-card-border rounded-md px-2 py-0.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={b.pct}
                          onChange={(e) => mudarPct(b.nome, e.target.value)}
                          className="w-14 bg-transparent text-right outline-none text-sm font-mono"
                        />
                        <Percent size={11} className="text-muted" />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-accent">
                      {cifra(b.aPagar)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => togglePago(b.nome)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          b.pago
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-foreground/5 text-muted hover:bg-accent/15 hover:text-accent"
                        }`}
                      >
                        {b.pago ? <Check size={12} /> : <Save size={12} />}
                        {b.pago ? "Pago" : "Marcar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-card-border bg-background/50 font-semibold">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp size={14} className="text-accent" />
                      Total
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-muted">{totalAtendimentos}</td>
                  <td className="px-3 py-3 text-right font-mono">{cifra(totalFaturado)}</td>
                  <td className="px-3 py-3 text-right text-muted text-xs">
                    {totalFaturado > 0
                      ? ((totalAPagar / totalFaturado) * 100).toFixed(1)
                      : "0,0"}
                    %
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-accent text-base">
                    {cifra(totalAPagar)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
