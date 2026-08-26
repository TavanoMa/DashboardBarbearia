"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Agendamento } from "@/lib/types";
import { useDateRange } from "./useDateRange";
import { useStore } from "./useStore";

interface UseAgendamentosOptions {
  autoRefreshMs?: number;
  /** Override the store from context (for comparison pages) */
  overrideStore?: string;
}

export function useAgendamentos(opts: UseAgendamentosOptions = {}) {
  const { autoRefreshMs = 60000, overrideStore } = opts;
  const { dataIni, dataFim } = useDateRange();
  const { currentStore } = useStore();
  const store = overrideStore || currentStore;

  const [todos, setTodos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/agendamentos?dataIni=${dataIni}&dataFim=${dataFim}&store=${store}`
      );
      if (!res.ok) throw new Error("Falha na requisição");
      const data: Agendamento[] = await res.json();

      if (data.length > 0 || sessionActive) {
        setTodos(data);
        setSessionActive(true);
        setLastUpdate(new Date());
      } else {
        const configRes = await fetch("/api/config");
        const config = await configRes.json();
        setSessionActive(config.configured);
        if (config.configured) {
          setTodos(data);
          setLastUpdate(new Date());
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setSessionActive(false);
    } finally {
      setLoading(false);
    }
  }, [dataIni, dataFim, store, sessionActive]);

  useEffect(() => {
    fetchData();
  }, [dataIni, dataFim, store]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefreshMs > 0 && sessionActive) {
      intervalRef.current = setInterval(() => fetchData(), autoRefreshMs);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefreshMs, sessionActive, fetchData]);

  const agendamentos = useMemo(
    () => todos.filter((a) => a.servico !== "Bloqueado"),
    [todos]
  );

  const bloqueados = useMemo(
    () => todos.filter((a) => a.servico === "Bloqueado"),
    [todos]
  );

  return {
    agendamentos,
    bloqueados,
    loading,
    error,
    sessionActive,
    lastUpdate,
    dataIni,
    dataFim,
    refresh: () => fetchData(),
  };
}
