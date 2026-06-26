// The persistent "Supabase app_form is the source of truth" reminder (PRD §7d).
// Always visible on the Sync parity sub-view (invariant #7).

export function SotReminder() {
  return (
    <section className="rounded-card border border-blue-soft bg-blue-soft p-3">
      <p className="text-[13px] leading-relaxed text-ink">
        <span className="font-semibold">Source of truth:</span> Supabase{" "}
        <span className="mono">app_form</span> is authoritative for funnel, TEFA, income, and grade.
        HubSpot mirrors those fields; where they disagree, the local app value wins and the HubSpot
        copy is the unreliable one.
      </p>
    </section>
  );
}
