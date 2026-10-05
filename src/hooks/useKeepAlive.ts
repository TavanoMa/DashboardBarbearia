"use client";

import { useEffect, useRef } from "react";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useKeepAlive() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ping = () => {
      fetch("/api/cron/keepalive").catch(() => {});
    };

    // Ping immediately on mount, then every 5 minutes
    ping();
    timerRef.current = setInterval(ping, INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
