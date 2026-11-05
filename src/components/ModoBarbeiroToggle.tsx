"use client";

import { Scissors } from "lucide-react";
import { useFinanceiroLocal } from "@/hooks/useFinanceiroLocal";

export default function ModoBarbeiroToggle() {
  const { modoBarbeiro, setModoBarbeiro, t } = useFinanceiroLocal();
  return (
    <button
      type="button"
      onClick={() => setModoBarbeiro(!modoBarbeiro)}
      aria-pressed={modoBarbeiro}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold transition-colors whitespace-nowrap ${
        modoBarbeiro ? "border-accent bg-accent/15" : "border-card-border bg-background hover:border-accent/50"
      }`}
    >
      <Scissors size={15} className="text-accent" />
      <span className="hidden sm:inline">{t("modo_barbeiro")}</span>
      <span className={`relative w-8 h-[18px] rounded-full transition-colors ${modoBarbeiro ? "bg-accent" : "bg-card-border"}`}>
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
            modoBarbeiro ? "translate-x-[14px]" : ""
          }`}
        />
      </span>
    </button>
  );
}
