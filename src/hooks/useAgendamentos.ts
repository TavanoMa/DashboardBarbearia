"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Agendamento } from "@/lib/types";
import { useDateRange } from "./useDateRange";

interface UseAgendamentosOptions {
  autoRefreshMs?: number;
}

export function useAgendamentos(opts: UseAgendamentosOptions = {}) {
  const { autoRefreshMs = 60000 } = opts;
  const { dataIni, dataFim } = useDateRange();
  const [todos, setTodos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/agendamentos?dataIni=${dataIni}&dataFim=${dataFim}`
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
  }, [dataIni, dataFim, sessionActive]);

  useEffect(() => {
    fetchData();
  }, [dataIni, dataFim]);

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
