"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import React from "react";

interface DateRangeContextValue {
  dataIni: string;
  dataFim: string;
  changePeriod: (ini: string, fim: string) => void;
  label: string;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dataIni, setDataIni] = useState(() => firstOfMonth());
  const [dataFim, setDataFim] = useState(() => today());

  const changePeriod = useCallback((ini: string, fim: string) => {
    setDataIni(ini);
    setDataFim(fim);
  }, []);

  const label = buildLabel(dataIni, dataFim);

  return React.createElement(
    DateRangeContext.Provider,
    { value: { dataIni, dataFim, changePeriod, label } },
    children
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    return {
      dataIni: firstOfMonth(),
      dataFim: today(),
      changePeriod: () => {},
      label: "",
    };
  }
  return ctx;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildLabel(ini: string, fim: string): string {
  const t = today();
  const fom = firstOfMonth();
  if (ini === fim && ini === t) return "Hoje";
  if (ini === fom && fim === t) return "Este mês";
  const [yi, mi, di] = ini.split("-");
  const [yf, mf, df] = fim.split("-");
  return `${di}/${mi}/${yi} - ${df}/${mf}/${yf}`;
}
