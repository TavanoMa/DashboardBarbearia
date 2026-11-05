"use client";

import { useFinanceiroLocal } from "@/hooks/useFinanceiroLocal";
import { mesRelativo } from "@/lib/financeiro";

export default function MesSelect({ value, onChange }: { value: number; onChange: (offset: number) => void }) {
  const { hoje, t } = useFinanceiroLocal();
  return (
    <select
      aria-label={t("mes")}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-card-border bg-background px-3 py-1.5 text-sm capitalize outline-none focus:border-accent"
    >
      {[0, -1].map((o) => (
        <option key={o} value={o}>
          {mesRelativo(hoje, o).nome}
        </option>
      ))}
    </select>
  );
}
