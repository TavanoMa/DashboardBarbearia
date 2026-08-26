"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "./useStore";

export interface ResumoData {
  totalComandaPendentes: number;
  totalClienteDebito: number;
  totalClienteCredito: number;
  totalCaixaPendente: number;
  totalClientesSemUsuario: number;
  totalRetorno: number;
  totalContasReceber: number;
  totalContasPagar: number;
  totalClientesSemVir: number;
  totalUsuariosConectaramApp: number;
  totalClienteNovo: number;
  totalProdVencer: number;
  totalAtrasada: number;
  totalAssinatura: number;
}

interface UseResumoOptions {
  overrideStore?: string;
}

export function useResumo(opts: UseResumoOptions = {}) {
  const { currentStore } = useStore();
  const store = opts.overrideStore || currentStore;

  const [data, setData] = useState<ResumoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/resumo?store=${store}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sessao nao configurada");
          return;
        }
        throw new Error("Falha na requisicao");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    fetchData();
  }, [store]);

  return { data, loading, error, refresh: () => fetchData() };
}
