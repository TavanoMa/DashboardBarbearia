"use client";

import { RefreshCw, Wifi, WifiOff, MapPin } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";
import { useStore } from "@/hooks/useStore";

interface HeaderProps {
  title?: string;
  onRefresh?: () => void;
  sessionActive?: boolean;
  lastUpdate?: Date | null;
  loading?: boolean;
  /** Hide store badge (e.g. on comparison page) */
  hideStore?: boolean;
}

export default function Header({
  title = "Dashboard",
  onRefresh,
  sessionActive,
  lastUpdate,
  loading,
  hideStore,
}: HeaderProps) {
  const { dataIni, dataFim, changePeriod, label } = useDateRange();
  const { currentStoreName, stores } = useStore();

  return (
    <header className="border-b border-card-border bg-card-bg shrink-0 px-4 py-3 sm:px-6 sm:h-16 sm:flex sm:items-center sm:justify-between">
      <div className="flex items-center justify-between sm:block">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{title}</h1>
          {!hideStore && stores.length > 1 && currentStoreName && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
              <MapPin size={10} />
              {currentStoreName}
            </span>
          )}
        </div>
        <p className="text-xs text-muted hidden sm:block">
          {lastUpdate
            ? `Atualizado ${lastUpdate.toLocaleTimeString("pt-BR")}`
            : label ||
              new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </p>
        <div className="flex items-center gap-2 sm:hidden">
          {sessionActive !== undefined && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                sessionActive
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
              }`}
            >
              {sessionActive ? <Wifi size={12} /> : <WifiOff size={12} />}
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={`text-muted ${loading ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 sm:mt-0">
        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 border border-card-border flex-1 sm:flex-none">
          <input
            type="date"
            value={dataIni}
            onChange={(e) => changePeriod(e.target.value, dataFim)}
            className="bg-transparent text-sm outline-none w-full sm:w-[130px]"
          />
          <span className="text-muted text-xs">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => changePeriod(dataIni, e.target.value)}
            className="bg-transparent text-sm outline-none w-full sm:w-[130px]"
          />
        </div>

        <div className="hidden sm:flex items-center gap-2">
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
