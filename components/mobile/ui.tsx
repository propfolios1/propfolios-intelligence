export const MTitle = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <div className="mb-4">
    <h1 className="font-display text-[28px] leading-tight text-navy-900">{children}</h1>
    {note && <p className="mt-1 text-[13px] text-ink-500">{note}</p>}
  </div>
);

export const MCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-md border border-hairline bg-surface p-4 ${className}`}>{children}</div>;

export const MStat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <MCard>
    <div className="label-caps">{label}</div>
    <div className="num mt-2 text-[24px] leading-none text-navy-900">{value}</div>
    {note && <div className="mt-1.5 text-[12px] text-ink-500">{note}</div>}
  </MCard>
);

export const Pill = ({ children }: { children: React.ReactNode }) => <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-700">{children}</span>;
