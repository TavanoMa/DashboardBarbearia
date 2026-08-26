"use client";

import { DateRangeProvider } from "@/hooks/useDateRange";
import { StoreProvider } from "@/hooks/useStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <DateRangeProvider>{children}</DateRangeProvider>
    </StoreProvider>
  );
}
