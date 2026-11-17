"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Trash2, Wallet } from "lucide-react";
import Header from "@/components/Header";
import ModoBarbeiroToggle from "@/components/ModoBarbeiroToggle";
import MesSelect from "@/components/financeiro/MesSelect";
import { useFinanceiroLocal } from "@/hooks/useFinanceiroLocal";
import {
  CANAIS,
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SAIDA,
  FORMAS_PAGAMENTO,
  IMPACTOS,
  META_MENSAL,
  RESPONSAVEIS,
  TAXA_CARTAO,
  taxaCartao,
  brl,
  ddmm,
  diaSemana,
  isoDate,
  mesRelativo,
  somarPor,
  valorLiquido,
  valorPago,
  type Entrada,
  type Saida,
} from "@/lib/financeiro";

const ITENS = ["Corte", "Corte + barba", "Barba", "Corte degradê", "Sobrancelha", "Pomada modeladora", "Óleo para barba", "Plano mensal"];
const lerValor = (v: string) => {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
const LIMITE_LISTA = 15;

const inputCls = "w-full min-w-0 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const thCls = "px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
const tdCls = "px-3 py-2.5 whitespace-nowrap";

export default function LancamentosPage() {
  const { pronto, hoje, dados, adicionar, remover, t, op, cifra, cifraNum } = useFinanceiroLocal();
  const hojeIso = isoDate(hoje);
  const inicioMesAtual = isoDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const contasNomes = dados.contasBancarias.map((c) => c.nome);

  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [offset, setOffset] = useState(0);
  const periodo = mesRelativo(hoje, offset);

  const [ent, setEnt] = useState({
    data: hojeIso, categoria: "Serviço", item: "Corte + barba", cliente: "", descricao: "",
    valor: "", taxa: "0,00", forma: "Pix", canal: "Recorrência", conta: "",
  });
  const [sai, setSai] = useState({
    descricao: "", categoria: CATEGORIAS_SAIDA[0].nome, tipoSaida: CATEGORIAS_SAIDA[0].tipos[0],
    venc: hojeIso, pgto: hojeIso, valor: "", juros: "0,00", forma: "Pix", conta: "",
    responsavel: "Empresa", parcela: "", impacto: "Essencial", geraReceita: "Não", quantidade: "1",
  });

  // Atalho Pró-labore: pré-preenche a saída com o padrão de salário do dono.
  // O cliente ainda precisa digitar valor, nome e conta de origem.
  function atalhoProLabore() {
    setTipo("saida");
    setMsg(null);
    setVerTodos(false);
    setSai((s) => ({
      ...s,
      descricao: "Pró-labore — ",
      categoria: "Despesa Fixa",
      tipoSaida: "Pró-labore (Dono)",
      responsavel: "Pessoal",
      impacto: "Essencial",
      geraReceita: "Não",
      forma: "Pix",
      quantidade: "1",
    }));
    // dá um tempinho pro DOM atualizar e foca no valor
    setTimeout(() => {
      const el = document.getElementById("s-val") as HTMLInputElement | null;
      el?.focus();
    }, 50);
  }

  const formaTemTaxaAuto = TAXA_CARTAO[ent.forma] !== undefined;

  // Na entrada, cartão débito/crédito calcula a taxa sozinho a partir do valor cobrado.
  function fmtTaxa(forma: string, valor: string): string {
    const t = taxaCartao(forma, lerValor(valor));
    return t === null ? "0,00" : t.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function mudarValorEnt(valor: string) {
    setEnt((s) => ({ ...s, valor, taxa: TAXA_CARTAO[s.forma] !== undefined ? fmtTaxa(s.forma, valor) : s.taxa }));
  }
  function mudarFormaEnt(forma: string) {
    setEnt((s) => ({ ...s, forma, conta: "", taxa: TAXA_CARTAO[forma] !== undefined ? fmtTaxa(forma, s.valor) : "0,00" }));
  }

  const contaEnt = ent.conta || (ent.forma === "Cartões" ? "Maquininha" : ent.forma === "Dinheiro" ? "Dinheiro em espécie" : "Nubank PJ");
  const contaSai = sai.conta || (sai.forma === "Dinheiro" ? "Dinheiro em espécie" : "Nubank PJ");
  const tiposSaida = CATEGORIAS_SAIDA.find((c) => c.nome === sai.categoria)?.tipos ?? [];

  const mes = useMemo(() => {
    const noPeriodo = (data: string) => data >= periodo.inicio && data <= periodo.fim;
    const entradas = dados.lancamentos
      .filter((l): l is Entrada => l.tipo === "entrada" && noPeriodo(l.data))
      .sort((a, b) => desc(a.data, b.data));
    const saidas = dados.lancamentos
      .filter((l): l is Saida => l.tipo === "saida" && noPeriodo(l.dataPagamento))
      .sort((a, b) => desc(a.dataPagamento, b.dataPagamento));
    // Mesmos indicadores das abas ENTRADAS e SAÍDAS da planilha
    const fat = entradas.reduce((s, e) => s + e.valorCobranca, 0);
    const taxas = entradas.reduce((s, e) => s + e.taxa, 0);
    const contas = saidas.reduce((s, x) => s + x.valorConta, 0);
    const juros = saidas.reduce((s, x) => s + x.juros, 0);
    return {
      entradas,
      saidas,
      fat,
      taxas,
      contas,
      juros,
      porCatIn: somarPor(entradas, (e) => e.categoria, (e) => e.valorCobranca),
      porForma: somarPor(entradas, (e) => e.forma, (e) => e.valorCobranca),
      porCanal: somarPor(entradas, (e) => e.canal, (e) => e.valorCobranca),
      porCatOut: somarPor(saidas, (x) => x.categoria, valorPago),
      porImpacto: somarPor(saidas, (x) => x.impacto, valorPago),
      porGera: somarPor(saidas, (x) => (x.geraReceita ? "Sim" : "Não"), valorPago),
      porResp: RESPONSAVEIS.map((r) => ({ nome: r, total: saidas.filter((x) => x.responsavel === r).reduce((s, x) => s + valorPago(x), 0) })),
    };
  }, [dados.lancamentos, periodo.inicio, periodo.fim]);

  function trocarTipo(novo: "entrada" | "saida") {
    setTipo(novo);
    setMsg(null);
    setVerTodos(false);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const id = `u-${Date.now()}`;
    if (tipo === "entrada") {
      const valorCobranca = lerValor(ent.valor);
      if (valorCobranca <= 0) return setMsg({ ok: false, texto: t("f_erro_valor") });
      adicionar({
        id, tipo: "entrada", data: ent.data, categoria: ent.categoria, item: ent.item,
        cliente: ent.cliente.trim(), descricao: ent.descricao.trim(), valorCobranca,
        taxa: lerValor(ent.taxa), forma: ent.forma, canal: ent.canal, conta: contaEnt,
      });
      setEnt((s) => ({ ...s, cliente: "", descricao: "", valor: "", taxa: "0,00" }));
    } else {
      const valorConta = lerValor(sai.valor);
      if (valorConta <= 0) return setMsg({ ok: false, texto: t("f_erro_valor") });
      const qtd = Math.max(1, parseInt(sai.quantidade, 10) || 1);
      for (let i = 0; i < qtd; i++) {
        adicionar({
          id: `${id}-${i}`, tipo: "saida", dataVencimento: sai.venc, dataPagamento: sai.pgto, descricao: sai.descricao.trim() || sai.tipoSaida,
          categoria: sai.categoria, tipoSaida: sai.tipoSaida, valorConta, juros: lerValor(sai.juros),
          forma: sai.forma, conta: contaSai, responsavel: sai.responsavel, impacto: sai.impacto,
          geraReceita: sai.geraReceita === "Sim", parcela: sai.parcela.trim(),
        });
      }
      setSai((s) => ({ ...s, descricao: "", valor: "", juros: "0,00", parcela: "", quantidade: "1" }));
    }
    setOffset(0);
    setMsg({ ok: true, texto: t("f_salvo") });
  }

  const header = (
    <Header
      title={t("menu_lanc")}
      subtitle={periodo.nome}
      hideDateRange
      actions={
        <>
          <MesSelect value={offset} onChange={(o) => { setOffset(o); setVerTodos(false); }} />
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

  const ehEntrada = tipo === "entrada";
  const qtdSai = Math.max(1, parseInt(sai.quantidade, 10) || 1);
  const pagoUnitSai = lerValor(sai.valor) + lerValor(sai.juros);
  const faltaMeta = Math.max(0, META_MENSAL - mes.fat);
  const pctMeta = Math.round((mes.fat / META_MENSAL) * 100);
  const total = ehEntrada ? mes.entradas.length : mes.saidas.length;

  return (
    <>
      {header}
      <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-auto">
        <p className="text-xs text-muted">{t("exemplo_aviso")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 p-1 rounded-xl bg-card-bg border border-card-border w-full sm:w-fit" role="tablist">
            <button type="button" role="tab" aria-selected={ehEntrada} onClick={() => trocarTipo("entrada")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${ehEntrada ? "bg-success text-white" : "text-muted hover:text-foreground"}`}>
              <ArrowUp size={15} /> {t("tab_entradas")}
            </button>
            <button type="button" role="tab" aria-selected={!ehEntrada} onClick={() => trocarTipo("saida")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${!ehEntrada ? "bg-danger text-white" : "text-muted hover:text-foreground"}`}>
              <ArrowDown size={15} /> {t("tab_saidas")}
            </button>
          </div>
          <button type="button" onClick={atalhoProLabore}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/40 bg-accent/5 text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
            title="Lança um pró-labore do dono já com categoria, tipo, responsável e impacto pré-preenchidos.">
            <Wallet size={15} /> Pró-labore do dono
          </button>
        </div>

        {ehEntrada ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label={t("l_fat")} valor={cifra(mes.fat)} sub={t("l_fat_sub")} />
            <Card label={t("l_taxas")} valor={cifra(mes.taxas)} sub={t("l_taxas_sub")} tom="neg" />
            <Card label={t("l_liq")} valor={cifra(mes.fat - mes.taxas)} sub={t("l_liq_sub")} tom="pos" />
            <Card label={t("l_meta")} valor={cifra(META_MENSAL)} sub={`${t("l_faltam")} ${cifra(faltaMeta)} · ${pctMeta}% ${t("l_atingido")}`} />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label={t("ls_contas")} valor={cifra(mes.contas)} sub={t("ls_contas_sub")} />
            <Card label={t("ls_juros")} valor={cifra(mes.juros)} sub={t("ls_juros_sub")} tom="neg" />
            <Card label={t("ls_total")} valor={cifra(mes.contas + mes.juros)} sub={t("ls_total_sub")} tom="neg" />
            <div className="bg-card-bg border border-card-border rounded-xl p-4 min-w-0">
              <p className="text-xs text-muted">{t("ls_resp")}</p>
              <dl className="mt-1.5 space-y-1 text-sm">
                {mes.porResp.map((r) => (
                  <div key={r.nome} className="flex justify-between gap-2">
                    <dt className="text-muted truncate">{op(r.nome)}</dt>
                    <dd className="font-mono tabular-nums whitespace-nowrap">{cifra(r.total)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">
          <form onSubmit={salvar} className={`bg-card-bg border rounded-xl p-5 min-w-0 ${ehEntrada ? "border-success/40" : "border-danger/40"}`}>
            <h3 className="font-semibold mb-4">{t(ehEntrada ? "f_nova_entrada" : "f_nova_saida")}</h3>

            {ehEntrada ? (
              <div className="space-y-3">
                <Linha>
                  <Campo id="e-data" label={t("f_data")}>
                    <input id="e-data" type="date" min={inicioMesAtual} max={hojeIso} value={ent.data} onChange={(e) => setEnt({ ...ent, data: e.target.value })} className={inputCls} required />
                  </Campo>
                  <Campo id="e-cat" label={t("f_cat_in")}>
                    <Select id="e-cat" value={ent.categoria} onChange={(v) => setEnt({ ...ent, categoria: v })} opcoes={CATEGORIAS_ENTRADA} op={op} />
                  </Campo>
                </Linha>
                <Campo id="e-item" label={t("f_item")}>
                  <Select id="e-item" value={ent.item} onChange={(v) => setEnt({ ...ent, item: v })} opcoes={ITENS} op={(v) => v} />
                </Campo>
                <Campo id="e-cli" label={t("f_cliente")}>
                  <input id="e-cli" value={ent.cliente} onChange={(e) => setEnt({ ...ent, cliente: e.target.value })} className={inputCls} />
                </Campo>
                <Campo id="e-desc" label={t("f_desc")} opcional={t("f_opc")}>
                  <input id="e-desc" value={ent.descricao} onChange={(e) => setEnt({ ...ent, descricao: e.target.value })} className={inputCls} />
                </Campo>
                <Linha>
                  <Campo id="e-val" label={t("f_valor")}>
                    <input id="e-val" inputMode="decimal" placeholder="0,00" value={ent.valor} onChange={(e) => mudarValorEnt(e.target.value)} className={inputCls} />
                  </Campo>
                  <Campo id="e-taxa" label={formaTemTaxaAuto ? `${t("f_taxa")} (auto)` : t("f_taxa")}>
                    <input id="e-taxa" inputMode="decimal" value={ent.taxa} readOnly={formaTemTaxaAuto} onChange={(e) => setEnt({ ...ent, taxa: e.target.value })} className={`${inputCls} ${formaTemTaxaAuto ? "opacity-70 cursor-not-allowed" : ""}`} title={formaTemTaxaAuto ? "Taxa calculada automaticamente pela forma de pagamento" : undefined} />
                  </Campo>
                </Linha>
                <Calculo label={t("f_liquido")} formula={t("f_liq_formula")} valor={brl(lerValor(ent.valor) - lerValor(ent.taxa))} />
                <Linha>
                  <Campo id="e-forma" label={t("f_forma")}>
                    <Select id="e-forma" value={ent.forma} onChange={mudarFormaEnt} opcoes={FORMAS_PAGAMENTO} op={op} />
                  </Campo>
                  <Campo id="e-conta" label={t("f_conta")}>
                    <Select id="e-conta" value={contaEnt} onChange={(v) => setEnt({ ...ent, conta: v })} opcoes={contasNomes} op={(v) => v} />
                  </Campo>
                </Linha>
                <Campo id="e-canal" label={t("f_canal")}>
                  <Select id="e-canal" value={ent.canal} onChange={(v) => setEnt({ ...ent, canal: v })} opcoes={CANAIS} op={op} />
                </Campo>
              </div>
            ) : (
              <div className="space-y-3">
                <Campo id="s-desc" label={t("f_desc_out")}>
                  <input id="s-desc" value={sai.descricao} onChange={(e) => setSai({ ...sai, descricao: e.target.value })} className={inputCls} />
                </Campo>
                <Campo id="s-cat" label={t("f_cat_out")}>
                  <Select id="s-cat" value={sai.categoria} opcoes={CATEGORIAS_SAIDA.map((c) => c.nome)} op={op}
                    onChange={(v) => setSai({ ...sai, categoria: v, tipoSaida: CATEGORIAS_SAIDA.find((c) => c.nome === v)?.tipos[0] ?? "" })} />
                </Campo>
                <Campo id="s-tipo" label={t("f_tipo_out")}>
                  <Select id="s-tipo" value={sai.tipoSaida} onChange={(v) => setSai({ ...sai, tipoSaida: v })} opcoes={tiposSaida} op={(v) => v} />
                </Campo>
                <Linha>
                  <Campo id="s-venc" label={t("f_venc")}>
                    <input id="s-venc" type="date" value={sai.venc} onChange={(e) => setSai({ ...sai, venc: e.target.value })} className={inputCls} required />
                  </Campo>
                  <Campo id="s-pgto" label={t("f_pgto")}>
                    <input id="s-pgto" type="date" min={inicioMesAtual} max={hojeIso} value={sai.pgto} onChange={(e) => setSai({ ...sai, pgto: e.target.value })} className={inputCls} required />
                  </Campo>
                </Linha>
                <Linha>
                  <Campo id="s-val" label={t("f_valor_conta")}>
                    <input id="s-val" inputMode="decimal" placeholder="0,00" value={sai.valor} onChange={(e) => setSai({ ...sai, valor: e.target.value })} className={inputCls} />
                  </Campo>
                  <Campo id="s-juros" label={t("f_juros")}>
                    <input id="s-juros" inputMode="decimal" value={sai.juros} onChange={(e) => setSai({ ...sai, juros: e.target.value })} className={inputCls} />
                  </Campo>
                </Linha>
                <Linha>
                  <Campo id="s-qtd" label={t("f_qtd")}>
                    <input id="s-qtd" type="number" min={1} step={1} value={sai.quantidade} onChange={(e) => setSai({ ...sai, quantidade: e.target.value })} className={inputCls} />
                  </Campo>
                  <div className="flex items-end pb-2.5 text-xs text-muted leading-tight">{t("f_qtd_nota")}</div>
                </Linha>
                <Calculo label={t("f_pago")} formula={qtdSai > 1 ? `${brl(pagoUnitSai)} × ${qtdSai}` : t("f_pago_formula")} valor={brl(pagoUnitSai * qtdSai)} />
                <Linha>
                  <Campo id="s-forma" label={t("f_forma")}>
                    <Select id="s-forma" value={sai.forma} onChange={(v) => setSai({ ...sai, forma: v, conta: "" })} opcoes={FORMAS_PAGAMENTO} op={op} />
                  </Campo>
                  <Campo id="s-conta" label={t("f_conta_out")}>
                    <Select id="s-conta" value={contaSai} onChange={(v) => setSai({ ...sai, conta: v })} opcoes={contasNomes} op={(v) => v} />
                  </Campo>
                </Linha>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted pt-1">{t("f_analise")}</p>
                <Linha>
                  <Campo id="s-resp" label={t("f_resp")}>
                    <Select id="s-resp" value={sai.responsavel} onChange={(v) => setSai({ ...sai, responsavel: v })} opcoes={RESPONSAVEIS} op={op} />
                  </Campo>
                  <Campo id="s-parc" label={t("f_parcela")} opcional={t("f_opc")}>
                    <input id="s-parc" placeholder="1/3" value={sai.parcela} onChange={(e) => setSai({ ...sai, parcela: e.target.value })} className={inputCls} />
                  </Campo>
                </Linha>
                <Linha>
                  <Campo id="s-imp" label={t("f_impacto")}>
                    <Select id="s-imp" value={sai.impacto} onChange={(v) => setSai({ ...sai, impacto: v })} opcoes={IMPACTOS} op={op} />
                  </Campo>
                  <Campo id="s-gera" label={t("f_gera")}>
                    <Select id="s-gera" value={sai.geraReceita} onChange={(v) => setSai({ ...sai, geraReceita: v })} opcoes={["Sim", "Não"]} op={(v) => v} />
                  </Campo>
                </Linha>
              </div>
            )}

            <button type="submit" className="w-full mt-4 py-2.5 rounded-lg bg-accent text-sidebar-bg font-bold text-sm hover:bg-accent-dark transition-colors">
              {t("f_salvar")}
            </button>
            {msg && <p role="status" className={`text-xs text-center mt-2 ${msg.ok ? "text-success" : "text-danger"}`}>{msg.texto}</p>}
          </form>

          <div className="space-y-4 min-w-0">
            <div>
              <h3 className="font-semibold">{t(ehEntrada ? "lista_entradas" : "lista_saidas")} <span className="text-muted font-normal">({total})</span></h3>
              <p className="text-sm text-muted">{t("lista_sub")}</p>
            </div>
            <div className="overflow-x-auto bg-card-bg border border-card-border rounded-xl">
              {total === 0 ? (
                <p className="p-8 text-center text-sm text-muted">{t("lista_vazia")}</p>
              ) : ehEntrada ? (
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-card-border text-left">
                      <th className={thCls}>{t("th_data")}</th>
                      <th className={thCls}>{t("th_cat")}</th>
                      <th className={thCls}>{t("th_item")}</th>
                      <th className={thCls}>{t("th_cliente")}</th>
                      <th className={`${thCls} text-right`}>{t("th_cobranca")}</th>
                      <th className={`${thCls} text-right`}>{t("th_taxa")}</th>
                      <th className={`${thCls} text-right`}>{t("th_liquido")}</th>
                      <th className={thCls}>{t("th_forma")}</th>
                      <th className={thCls}>{t("th_canal")}</th>
                      <th className={thCls}>{t("th_conta")}</th>
                      <th className="px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(verTodos ? mes.entradas : mes.entradas.slice(0, LIMITE_LISTA)).map((l) => (
                      <tr key={l.id} className={`border-b border-card-border/60 last:border-0 ${l.exemplo ? "hover:bg-foreground/[0.03]" : "bg-accent/10"}`}>
                        <td className={`${tdCls} text-xs text-muted`}>{ddmm(l.data)} {diaSemana(l.data)}</td>
                        <td className={`${tdCls} text-muted`}>{op(l.categoria)}</td>
                        <td className={tdCls}>{l.item}</td>
                        <td className={`${tdCls} max-w-[160px] truncate`}>{l.cliente || "—"}</td>
                        <td className={`${tdCls} text-right font-mono`}>{cifraNum(l.valorCobranca)}</td>
                        <td className={`${tdCls} text-right font-mono ${l.taxa ? "text-danger" : "text-muted"}`}>{cifraNum(l.taxa)}</td>
                        <td className={`${tdCls} text-right font-mono text-success`}>{cifraNum(valorLiquido(l))}</td>
                        <td className={`${tdCls} text-muted`}>{l.forma}</td>
                        <td className={`${tdCls} text-muted`}>{op(l.canal)}</td>
                        <td className={`${tdCls} text-muted`}>{l.conta}</td>
                        <td className="px-2 py-2.5 text-right"><BotaoRemover visivel={!l.exemplo} onClick={() => remover(l.id)} label={t("remover")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-card-border text-left">
                      <th className={thCls}>{t("th_venc")}</th>
                      <th className={thCls}>{t("th_pgto")}</th>
                      <th className={thCls}>{t("th_desc")}</th>
                      <th className={thCls}>{t("th_cat")}</th>
                      <th className={thCls}>{t("th_tipo_saida")}</th>
                      <th className={`${thCls} text-right`}>{t("th_valor_conta")}</th>
                      <th className={`${thCls} text-right`}>{t("th_juros")}</th>
                      <th className={`${thCls} text-right`}>{t("th_pago")}</th>
                      <th className={thCls}>{t("th_forma")}</th>
                      <th className={thCls}>{t("th_resp")}</th>
                      <th className={thCls}>{t("th_impacto")}</th>
                      <th className="px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(verTodos ? mes.saidas : mes.saidas.slice(0, LIMITE_LISTA)).map((l) => (
                      <tr key={l.id} className={`border-b border-card-border/60 last:border-0 ${l.exemplo ? "hover:bg-foreground/[0.03]" : "bg-accent/10"}`}>
                        <td className={`${tdCls} text-xs text-muted`}>{ddmm(l.dataVencimento)}</td>
                        <td className={`${tdCls} text-xs ${l.dataPagamento > l.dataVencimento ? "text-danger" : "text-muted"}`}>{ddmm(l.dataPagamento)}</td>
                        <td className={`${tdCls} max-w-[200px] truncate`}>{l.descricao}</td>
                        <td className={`${tdCls} text-muted`}>{op(l.categoria)}</td>
                        <td className={`${tdCls} text-muted max-w-[180px] truncate`}>{l.tipoSaida}</td>
                        <td className={`${tdCls} text-right font-mono`}>{cifraNum(l.valorConta)}</td>
                        <td className={`${tdCls} text-right font-mono ${l.juros ? "text-danger" : "text-muted"}`}>{cifraNum(l.juros)}</td>
                        <td className={`${tdCls} text-right font-mono text-danger`}>{cifraNum(valorPago(l))}</td>
                        <td className={`${tdCls} text-muted`}>{l.forma}</td>
                        <td className={`${tdCls} text-muted`}>{op(l.responsavel)}</td>
                        <td className={`${tdCls} text-muted`}>{op(l.impacto)}</td>
                        <td className="px-2 py-2.5 text-right"><BotaoRemover visivel={!l.exemplo} onClick={() => remover(l.id)} label={t("remover")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {total > LIMITE_LISTA && (
                <button type="button" onClick={() => setVerTodos(!verTodos)} className="w-full py-2.5 text-sm font-medium text-accent border-t border-card-border hover:bg-accent/5">
                  {verTodos ? t("ver_menos") : `${t("ver_mais")} (${total})`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ehEntrada ? (
                <>
                  <Quebra titulo={t("b_cat_in")} itens={mes.porCatIn} op={op} cifra={cifra} />
                  <Quebra titulo={t("b_forma")} itens={mes.porForma} op={(v) => v} cifra={cifra} />
                  <Quebra titulo={t("b_canal")} itens={mes.porCanal} op={op} cifra={cifra} />
                </>
              ) : (
                <>
                  <Quebra titulo={t("b_categoria")} itens={mes.porCatOut} op={op} cifra={cifra} />
                  <Quebra titulo={t("b_impacto")} itens={mes.porImpacto} op={op} cifra={cifra} />
                  <Quebra titulo={t("b_gera")} itens={mes.porGera} op={(v) => v} cifra={cifra} />
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Card({ label, valor, sub, tom }: { label: string; valor: string; sub: string; tom?: "pos" | "neg" }) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 min-w-0 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-mono text-lg sm:text-xl tabular-nums mt-1 ${tom === "pos" ? "text-success" : tom === "neg" ? "text-danger" : ""}`}>{valor}</p>
      <p className="text-xs text-muted/80 mt-1">{sub}</p>
    </div>
  );
}

function BotaoRemover({ visivel, onClick, label }: { visivel: boolean; onClick: () => void; label: string }) {
  if (!visivel) return null;
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10">
      <Trash2 size={14} />
    </button>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

function Campo({ id, label, opcional, children }: { id: string; label: string; opcional?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label} {opcional && <span className="font-normal opacity-70">{opcional}</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ id, value, onChange, opcoes, op }: { id: string; value: string; onChange: (v: string) => void; opcoes: readonly string[]; op: (v: string) => string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {opcoes.map((o) => (
        <option key={o} value={o}>{op(o)}</option>
      ))}
    </select>
  );
}

function Calculo({ label, formula, valor }: { label: string; formula: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent/10 px-3 py-2.5">
      <span className="text-xs font-semibold">
        {label}
        <span className="block font-normal text-muted text-[11px]">{formula}</span>
      </span>
      <span className="font-mono tabular-nums whitespace-nowrap">{valor}</span>
    </div>
  );
}

function Quebra({ titulo, itens, op, cifra }: { titulo: string; itens: { nome: string; total: number }[]; op: (v: string) => string; cifra: (n: number) => string }) {
  const total = itens.reduce((s, i) => s + i.total, 0) || 1;
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 min-w-0">
      <h4 className="text-sm font-semibold mb-2.5">{titulo}</h4>
      <div className="space-y-2">
        {itens.slice(0, 6).map((i) => (
          <div key={i.nome} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate">{op(i.nome)}</span>
              <span className="font-mono tabular-nums whitespace-nowrap">
                {cifra(i.total)} <span className="text-xs text-muted">{Math.round((i.total / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-1 mt-1 rounded bg-foreground/5 overflow-hidden">
              <div className="h-full bg-accent rounded" style={{ width: `${(i.total / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
