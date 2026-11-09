"use client";

import { Eye, EyeOff } from "lucide-react";
import { setOcultar, useOcultarValores } from "@/lib/ocultar";

export default function OcultarValoresToggle() {
  const ocultar = useOcultarValores();
  return (
    <button
      type="button"
      onClick={() => setOcultar(!ocultar)}
      aria-pressed={ocultar}
      title={ocultar ? "Mostrar valores" : "Ocultar valores"}
      aria-label={ocultar ? "Mostrar valores" : "Ocultar valores"}
      className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors shrink-0 ${
        ocultar ? "border-accent bg-accent/15 text-accent" : "border-card-border bg-background text-muted hover:text-foreground hover:border-accent/50"
      }`}
    >
      {ocultar ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}
