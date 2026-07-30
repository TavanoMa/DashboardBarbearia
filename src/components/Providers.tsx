"use client";

import { DateRangeProvider } from "@/hooks/useDateRange";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <DateRangeProvider>{children}</DateRangeProvider>;
}
