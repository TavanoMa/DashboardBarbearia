"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComissaoDetalhe, ComissaoSintetico, ComissaoProfissional } from "@/lib/types";
import { useDateRange } from "./useDateRange";

interface ComissaoData {
  detalhe: ComissaoDetalhe[];
  sintetico: ComissaoSintetico[];
  porProfissional: ComissaoProfissional[];
}

export function useComissoes() {
  const { dataIni, dataFim } = useDateRange();
  const [data, setData] = useState<ComissaoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/comissoes?dataIni=${dataIni}&dataFim=${dataFim}`);
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
  }, [dataIni, dataFim]);

  useEffect(() => {
    fetchData();
  }, [dataIni, dataFim]);

  return { data, loading, error, refresh: () => fetchData() };
}
