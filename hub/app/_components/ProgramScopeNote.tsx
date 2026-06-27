import { PROGRAM_SCOPE_LABELS, type ProgramScope } from "@/lib/program-scope";

// Inline, read-only indicator of the page's ACTIVE program lens. The selector itself
// lives in the sidebar (ProgramScopeControl); this is just the on-page echo so a viewer
// always knows which program(s) the data below is scoped to. Server component — no JS.
export function ProgramScopeNote({
  scope,
  detail,
  className = "",
}: {
  scope: ProgramScope;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-card border border-hairline bg-surface px-2 py-1 ${className}`}
      title={`Active program lens: ${PROGRAM_SCOPE_LABELS[scope]}. Change it in the sidebar Program selector.`}
    >
      <span className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
        Program
      </span>
      <span className="mono text-[10px] font-semibold text-ink">
        {PROGRAM_SCOPE_LABELS[scope]}
      </span>
      {detail ? <span className="text-[10px] text-muted">{detail}</span> : null}
    </div>
  );
}
