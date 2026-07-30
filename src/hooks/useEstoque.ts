"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProdutoEstoque } from "@/app/api/estoque/route";

interface EstoqueData {
  produtos: ProdutoEstoque[];
}

export function useEstoque() {
  const [data, setData] = useState<EstoqueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/estoque");
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
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refresh: () => fetchData() };
}
