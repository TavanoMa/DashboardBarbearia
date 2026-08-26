"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import React from "react";

export interface StoreInfo {
  id: string;
  name: string;
}

interface StoreContextValue {
  stores: StoreInfo[];
  currentStore: string; // store id
  currentStoreName: string;
  setCurrentStore: (id: string) => void;
  storeParam: string; // query param string like "&store=shopping"
  loading: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [currentStore, setCurrentStoreRaw] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("cacique_current_store");

    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        const storeList: StoreInfo[] = data.stores || [];
        setStores(storeList);

        if (storeList.length > 0) {
          const savedStore = storeList.find((s) => s.id === saved);
          setCurrentStoreRaw(savedStore ? savedStore.id : storeList[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setCurrentStore = useCallback((id: string) => {
    setCurrentStoreRaw(id);
    localStorage.setItem("cacique_current_store", id);
  }, []);

  const currentStoreName = stores.find((s) => s.id === currentStore)?.name || "";
  const storeParam = currentStore ? `&store=${currentStore}` : "";

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        stores,
        currentStore,
        currentStoreName,
        setCurrentStore,
        storeParam,
        loading,
      },
    },
    children
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    return {
      stores: [],
      currentStore: "",
      currentStoreName: "",
      setCurrentStore: () => {},
      storeParam: "",
      loading: true,
    };
  }
  return ctx;
}
