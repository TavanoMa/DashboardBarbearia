"use client";

import { DateRangeProvider } from "@/hooks/useDateRange";
import { StoreProvider } from "@/hooks/useStore";
import { useKeepAlive } from "@/hooks/useKeepAlive";

export default function Providers({ children }: { children: React.ReactNode }) {
  useKeepAlive();
  return (
    <StoreProvider>
      <DateRangeProvider>{children}</DateRangeProvider>
    </StoreProvider>
  );
}
