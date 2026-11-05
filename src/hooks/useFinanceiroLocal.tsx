"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "@/hooks/useStore";
import { gerarExemplo, type DadosFinanceiros } from "@/lib/financeiro-exemplo";
import type { Lancamento } from "@/lib/financeiro";
import { OPCOES_BARBEIRO, TEXTOS, type ChaveTexto } from "@/lib/linguagem";

interface FinanceiroContextValue {
  pronto: boolean;
  hoje: Date;
  dados: DadosFinanceiros;
  adicionar: (l: Lancamento) => void;
  remover: (id: string) => void;
  modoBarbeiro: boolean;
  setModoBarbeiro: (v: boolean) => void;
  t: (k: ChaveTexto) => string;
  op: (valor: string) => string;
}

const VAZIO: DadosFinanceiros = { contasBancarias: [], lancamentos: [], contasPrevistas: [] };
const CHAVE_MODO = "cacique_modo_barbeiro";
const FinanceiroContext = createContext<FinanceiroContextValue | null>(null);

// localStorage com fallback em memória (aba anônima / armazenamento bloqueado)
const memoria = new Map<string, string>();
const ouvintes = new Set<() => void>();

function assinar(cb: () => void) {
  ouvintes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    ouvintes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function ler(chave: string): string | null {
  try {
    const v = localStorage.getItem(chave);
    if (v !== null) return v;
  } catch {}
  return memoria.get(chave) ?? null;
}

function gravar(chave: string, valor: unknown) {
  const texto = JSON.stringify(valor);
  memoria.set(chave, texto);
  try {
    localStorage.setItem(chave, texto);
  } catch {}
  ouvintes.forEach((f) => f());
}

function lerLancamentos(chave: string): Lancamento[] {
  try {
    const v = ler(chave);
    return v ? (JSON.parse(v) as Lancamento[]) : [];
  } catch {
    return [];
  }
}

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const { currentStore, loading: lojaCarregando } = useStore();
  const [hoje] = useState(() => new Date());
  const chaveLoja = `cacique_fin_lancamentos_${currentStore || "padrao"}`;

  const rawModo = useSyncExternalStore(assinar, () => ler(CHAVE_MODO), () => null);
  const rawMeus = useSyncExternalStore(assinar, () => ler(chaveLoja), () => null);
  const modoBarbeiro = rawModo === "true";

  const base = useMemo(
    () => (lojaCarregando ? VAZIO : gerarExemplo(hoje, currentStore)),
    [lojaCarregando, hoje, currentStore]
  );

  const dados = useMemo(() => {
    let meus: Lancamento[] = [];
    try {
      meus = rawMeus ? (JSON.parse(rawMeus) as Lancamento[]) : [];
    } catch {}
    return { ...base, lancamentos: [...meus, ...base.lancamentos] };
  }, [base, rawMeus]);

  const adicionar = useCallback((l: Lancamento) => gravar(chaveLoja, [l, ...lerLancamentos(chaveLoja)]), [chaveLoja]);
  const remover = useCallback(
    (id: string) => gravar(chaveLoja, lerLancamentos(chaveLoja).filter((l) => l.id !== id)),
    [chaveLoja]
  );
  const setModoBarbeiro = useCallback((v: boolean) => gravar(CHAVE_MODO, v), []);

  const t = useCallback((k: ChaveTexto) => TEXTOS[k][modoBarbeiro ? 1 : 0], [modoBarbeiro]);
  const op = useCallback((v: string) => (modoBarbeiro ? OPCOES_BARBEIRO[v] ?? v : v), [modoBarbeiro]);

  return (
    <FinanceiroContext.Provider
      value={{ pronto: !lojaCarregando, hoje, dados, adicionar, remover, modoBarbeiro, setModoBarbeiro, t, op }}
    >
      {children}
    </FinanceiroContext.Provider>
  );
}

export function useFinanceiroLocal() {
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error("useFinanceiroLocal precisa estar dentro de FinanceiroProvider");
  return ctx;
}
