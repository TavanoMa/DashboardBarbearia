"use client";

import { useState, useEffect, useCallback } from "react";

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

export function useResumo() {
  const [data, setData] = useState<ResumoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/resumo");
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
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refresh: () => fetchData() };
}
