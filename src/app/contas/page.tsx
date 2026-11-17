"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Trash2, Undo2 } from "lucide-react";
import Header from "@/components/Header";
import ModoBarbeiroToggle from "@/components/ModoBarbeiroToggle";
import Pill from "@/components/financeiro/Pill";
import { useFinanceiroLocal } from "@/hooks/useFinanceiroLocal";
import { ddmm, diaSemana, isoDate, statusConta, type ContaPrevista, type StatusConta } from "@/lib/financeiro";
import type { ChaveTexto } from "@/lib/linguagem";

const inputCls = "w-full min-w-0 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const lerValor = (v: string) => {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const tomStatus = (s: StatusConta) => (s === "Pago" ? "pos" : s === "Vencido" ? "neg" : s === "Vence hoje" ? "warn" : "info");
const chaveStatus = (s: StatusConta): ChaveTexto => (s === "Pago" ? "sc_pago" : s === "Vencido" ? "sc_vencido" : s === "Vence hoje" ? "sc_hoje" : "sc_vencer");

export default function ContasPage() {
  const { pronto, hoje, dados, adicionarConta, removerConta, marcarPago, t, cifra } = useFinanceiroLocal();
  const hojeIso = isoDate(hoje);
  const [tipo, setTipo] = useState<"pagar" | "receber">("pagar");
  const [form, setForm] = useState({ desc: "", valor: "", venc: hojeIso });
  const [msg, setMsg] = useState(false);

  const lista = useMemo(
    () =>
      dados.contasPrevistas
        .filter((c) => c.tipo === tipo)
        .map((c) => ({ ...c, status: statusConta(c, hojeIso) }))
        .sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0)),
    [dados.contasPrevistas, tipo, hojeIso]
  );

  const totais = useMemo(() => {
    let vencer = 0, vencido = 0, pago = 0;
    for (const c of lista) {
      if (c.status === "Pago") pago += c.valor;
      else if (c.status === "Vencido") vencido += c.valor;
      else vencer += c.valor;
    }
    return { vencer, vencido, pago };
  }, [lista]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const valor = lerValor(form.valor);
    if (valor <= 0 || !form.desc.trim()) return;
    const nova: ContaPrevista = {
      id: `c-${Date.now()}`,
      tipo,
      vencimento: form.venc,
      descricao: form.desc.trim(),
      valor,
      pago: false,
    };
    adicionarConta(nova);
    setForm({ desc: "", valor: "", venc: form.venc });
    setMsg(true);
    setTimeout(() => setMsg(false), 3000);
  }

  const ehPagar = tipo === "pagar";
  const header = <Header title={t("menu_contas")} subtitle={t("cc_sub")} hideDateRange actions={<ModoBarbeiroToggle />} />;

  if (!pronto) {
    return (
      <>
        {header}
        <main className="flex-1 p-6"><div className="h-40 rounded-xl bg-card-bg border border-card-border animate-pulse" /></main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-auto">
        <p className="text-xs text-muted">{t("exemplo_aviso")}</p>

        <div className="flex gap-1.5 p-1 rounded-xl bg-card-bg border border-card-border w-full sm:w-fit" role="tablist">
          <button type="button" role="tab" aria-selected={ehPagar} onClick={() => setTipo("pagar")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${ehPagar ? "bg-danger text-white" : "text-muted hover:text-foreground"}`}>
            <ArrowDown size={15} /> {t("cc_tab_pagar")}
          </button>
          <button type="button" role="tab" aria-selected={!ehPagar} onClick={() => setTipo("receber")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${!ehPagar ? "bg-success text-white" : "text-muted hover:text-foreground"}`}>
            <ArrowUp size={15} /> {t("cc_tab_receber")}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card label={t("cc_t_vencer")} valor={cifra(totais.vencer)} tom="info" />
          <Card label={t("cc_t_vencido")} valor={cifra(totais.vencido)} tom={totais.vencido > 0 ? "neg" : undefined} />
          <Card label={t("cc_t_pago")} valor={cifra(totais.pago)} tom="pos" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Form rápido */}
          <form onSubmit={salvar} className={`bg-card-bg border rounded-xl p-5 min-w-0 ${ehPagar ? "border-danger/40" : "border-success/40"}`}>
            <h3 className="font-semibold">{t("cc_nova")}</h3>
            <p className="text-xs text-muted mb-4">{t("cc_nova_sub")}</p>
            <div className="space-y-3">
              <Campo id="c-desc" label={t("cc_desc")}>
                <input id="c-desc" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className={inputCls} placeholder={ehPagar ? "Ex.: Conta de luz" : "Ex.: Plano mensal — João"} />
              </Campo>
              <div className="grid grid-cols-2 gap-2.5">
                <Campo id="c-valor" label={t("cc_valor")}>
                  <input id="c-valor" inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={inputCls} />
                </Campo>
                <Campo id="c-venc" label={t("cc_venc")}>
                  <input id="c-venc" type="date" value={form.venc} onChange={(e) => setForm({ ...form, venc: e.target.value })} className={inputCls} required />
                </Campo>
              </div>
            </div>
            <button type="submit" className="w-full mt-4 py-2.5 rounded-lg bg-accent text-sidebar-bg font-bold text-sm hover:bg-accent-dark transition-colors">
              {t("cc_add")}
            </button>
            {msg && <p role="status" className="text-xs text-center mt-2 text-success">{t("cc_add_ok")}</p>}
          </form>

          {/* Lista */}
          <div className="space-y-3 min-w-0">
            <div>
              <h3 className="font-semibold">{t("cc_lista")} <span className="text-muted font-normal">({lista.length})</span></h3>
              <p className="text-sm text-muted">{t("cc_lista_sub")}</p>
            </div>
            <div className="overflow-x-auto bg-card-bg border border-card-border rounded-xl">
              {lista.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">{t("cc_vazia")}</p>
              ) : (
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-card-border text-left">
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{t("cc_th_venc")}</th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{t("cc_th_desc")}</th>
                      <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">{t("cc_th_valor")}</th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{t("cc_th_status")}</th>
                      <th className="px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((c) => (
                      <tr key={c.id} className={`border-b border-card-border/60 last:border-0 ${c.usuario ? "bg-accent/10" : "hover:bg-foreground/[0.03]"} ${c.pago ? "opacity-60" : ""}`}>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted">{ddmm(c.vencimento)} {diaSemana(c.vencimento)}</td>
                        <td className="px-3 py-2.5 max-w-[240px] truncate">{c.descricao}</td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">{cifra(c.valor)}</td>
                        <td className="px-3 py-2.5"><Pill tom={tomStatus(c.status)}>{t(chaveStatus(c.status))}</Pill></td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap">
                          {c.usuario && (
                            <span className="inline-flex items-center gap-1">
                              <button type="button" onClick={() => marcarPago(c.id, !c.pago)} title={c.pago ? t("cc_desmarcar") : t("cc_marcar")} aria-label={c.pago ? t("cc_desmarcar") : t("cc_marcar")}
                                className={`p-1 rounded hover:bg-foreground/10 ${c.pago ? "text-muted" : "text-success"}`}>
                                {c.pago ? <Undo2 size={14} /> : <Check size={14} />}
                              </button>
                              <button type="button" onClick={() => removerConta(c.id)} title="Remover" aria-label="Remover"
                                className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10">
                                <Trash2 size={14} />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Card({ label, valor, tom }: { label: string; valor: string; tom?: "pos" | "neg" | "info" }) {
  const cor = tom === "pos" ? "text-success" : tom === "neg" ? "text-danger" : tom === "info" ? "text-foreground" : "";
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 min-w-0 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-mono text-lg sm:text-xl tabular-nums mt-1 ${cor}`}>{valor}</p>
    </div>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
