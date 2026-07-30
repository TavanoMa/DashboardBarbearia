"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";

interface HeaderProps {
  title?: string;
  onRefresh?: () => void;
  sessionActive?: boolean;
  lastUpdate?: Date | null;
  loading?: boolean;
}

export default function Header({
  title = "Dashboard",
  onRefresh,
  sessionActive,
  lastUpdate,
  loading,
}: HeaderProps) {
  const { dataIni, dataFim, changePeriod, label } = useDateRange();

  return (
    <header className="h-16 border-b border-card-border bg-card-bg flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted">
          {lastUpdate
            ? `Atualizado ${lastUpdate.toLocaleTimeString("pt-BR")}`
            : label ||
              new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 border border-card-border">
          <input
            type="date"
            value={dataIni}
            onChange={(e) => changePeriod(e.target.value, dataFim)}
            className="bg-transparent text-sm outline-none w-[130px]"
          />
          <span className="text-muted text-xs">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => changePeriod(dataIni, e.target.value)}
            className="bg-transparent text-sm outline-none w-[130px]"
          />
        </div>

        <div className="flex items-center gap-2">
          {sessionActive !== undefined && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                sessionActive
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
              }`}
            >
              {sessionActive ? <Wifi size={12} /> : <WifiOff size={12} />}
              {sessionActive ? "Online" : "Offline"}
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw
                size={18}
                className={`text-muted ${loading ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
