const TONS = {
  pos: "bg-success/10 text-success",
  neg: "bg-danger/10 text-danger",
  warn: "bg-warning/15 text-warning",
  neu: "bg-foreground/5 text-muted",
} as const;

export default function Pill({ tom, children }: { tom: keyof typeof TONS; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${TONS[tom]}`}>
      {children}
    </span>
  );
}
