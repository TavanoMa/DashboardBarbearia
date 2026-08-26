"use client";

import { useState, useEffect, useCallback } from "react";
import type { FinanceiroResumo, FinanceiroTransacao, FinanceiroGraficoMes, ComandaDetalhe, FormaPagamentoResumo } from "@/lib/types";
import { useDateRange } from "./useDateRange";
import { useStore } from "./useStore";

interface DashboardGeral {
  totalBruto: number;
  totalBrutoReal: number;
}

interface FinanceiroData {
  resumo: FinanceiroResumo;
  transacoes: FinanceiroTransacao[];
  formasPagamento: FormaPagamentoResumo[];
  comandas: ComandaDetalhe[];
  dashboardGeral: DashboardGeral | null;
  grafico: FinanceiroGraficoMes[];
}

interface UseFinanceiroOptions {
  overrideStore?: string;
}

export function useFinanceiro(opts: UseFinanceiroOptions = {}) {
  const { dataIni, dataFim } = useDateRange();
  const { currentStore } = useStore();
  const store = opts.overrideStore || currentStore;

  const [data, setData] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/financeiro?dataIni=${dataIni}&dataFim=${dataFim}&store=${store}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sessão não configurada");
          return;
        }
        throw new Error("Falha na requisição");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [dataIni, dataFim, store]);

  useEffect(() => {
    fetchData();
  }, [dataIni, dataFim, store]);

  return { data, loading, error, refresh: () => fetchData() };
}
