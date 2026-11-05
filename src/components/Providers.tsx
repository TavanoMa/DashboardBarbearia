"use client";

import { DateRangeProvider } from "@/hooks/useDateRange";
import { StoreProvider } from "@/hooks/useStore";
import { useKeepAlive } from "@/hooks/useKeepAlive";
import { FinanceiroProvider } from "@/hooks/useFinanceiroLocal";

export default function Providers({ children }: { children: React.ReactNode }) {
  useKeepAlive();
  return (
    <StoreProvider>
      <DateRangeProvider>
        <FinanceiroProvider>{children}</FinanceiroProvider>
      </DateRangeProvider>
    </StoreProvider>
  );
}
