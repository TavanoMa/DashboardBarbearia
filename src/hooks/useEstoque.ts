"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProdutoEstoque } from "@/app/api/estoque/route";
import { useStore } from "./useStore";

interface EstoqueData {
  produtos: ProdutoEstoque[];
}

interface UseEstoqueOptions {
  overrideStore?: string;
}

export function useEstoque(opts: UseEstoqueOptions = {}) {
  const { currentStore } = useStore();
  const store = opts.overrideStore || currentStore;

  const [data, setData] = useState<EstoqueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/estoque?store=${store}`);
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
  }, [store]);

  useEffect(() => {
    fetchData();
  }, [store]);

  return { data, loading, error, refresh: () => fetchData() };
}
