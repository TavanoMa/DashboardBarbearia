"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComissaoDetalhe, ComissaoSintetico, ComissaoProfissional } from "@/lib/types";
import { useDateRange } from "./useDateRange";
import { useStore } from "./useStore";

interface ComissaoData {
  detalhe: ComissaoDetalhe[];
  sintetico: ComissaoSintetico[];
  porProfissional: ComissaoProfissional[];
}

interface UseComissoesOptions {
  overrideStore?: string;
}

export function useComissoes(opts: UseComissoesOptions = {}) {
  const { dataIni, dataFim } = useDateRange();
  const { currentStore } = useStore();
  const store = opts.overrideStore || currentStore;

  const [data, setData] = useState<ComissaoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/comissoes?dataIni=${dataIni}&dataFim=${dataFim}&store=${store}`);
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
