"use client";

// Fonte única da preferência "ocultar valores" (botão de olho).
// Usada pelo Header, pelos formatadores de dinheiro e pelo módulo financeiro.
import { useEffect, useSyncExternalStore } from "react";

const CHAVE = "cacique_ocultar_valores";
export const MASCARA = "••••";

const memoria = new Map<string, string>();
const ouvintes = new Set<() => void>();

// Só mascara depois que a página montou no cliente. No servidor (e no primeiro
// render do cliente, durante a hidratação) retorna false, evitando divergência
// entre o HTML do servidor e o do cliente.
let hidratado = false;

function lerBruto(): boolean {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v !== null) return v === "true";
  } catch {}
  return memoria.get(CHAVE) === "true";
}

export function isOcultar(): boolean {
  return hidratado && lerBruto();
}

function marcarHidratado() {
  if (hidratado) return;
  hidratado = true;
  ouvintes.forEach((f) => f());
}

export function setOcultar(v: boolean) {
  hidratado = true;
  memoria.set(CHAVE, String(v));
  try {
    localStorage.setItem(CHAVE, String(v));
  } catch {}
  ouvintes.forEach((f) => f());
}

function assinar(cb: () => void) {
  ouvintes.add(cb);
  if (typeof window !== "undefined") window.addEventListener("storage", cb);
  return () => {
    ouvintes.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", cb);
  };
}

// Hook: retorna o estado e re-renderiza quem usa quando ele muda.
export function useOcultarValores(): boolean {
  const v = useSyncExternalStore(assinar, isOcultar, () => false);
  useEffect(() => {
    marcarHidratado();
  }, []);
  return v;
}
