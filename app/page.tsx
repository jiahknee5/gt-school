const SWATCHES: [string, string][] = [
  ['#FAF7F2', 'Off-white'],
  ['#F5DDCD', 'Gold 20%'],
  ['#E48B53', 'Brand Gold'],
  ['#003B5C', 'Navy Mid'],
  ['#002A3A', 'Navy Deep'],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">GT Anywhere · Marketing</p>
      <h1 className="mt-3 font-serif text-5xl text-navy-deep">GT Marketing Hub</h1>
      <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
        One trustworthy place where every marketing function — grassroots, content, nurture, admissions,
        summer camp — reconciles to the same numbers.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <span className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-navy-deep">Phase 1 backbone · live</span>
        <span className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--muted)]">Phase 2 · in build</span>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SWATCHES.map(([hex, name]) => (
          <div key={hex} className="rounded-lg border border-[var(--border)] p-2">
            <div className="h-12 rounded" style={{ background: hex }} />
            <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">{hex}</p>
            <p className="text-xs">{name}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
