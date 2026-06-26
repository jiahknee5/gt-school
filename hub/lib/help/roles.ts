// Source of truth for the Help → "Roles & access" page (app/help/roles). Documents
// HOW the Hub is organized: the §5 weekly-meeting agenda → module mapping, the
// agenda-aware sidebar IA, the two orthogonal user layers (permission TIER vs
// FUNCTIONAL role), and the per-role module-ownership matrix.
//
// The agenda + tier copy below is static documentation (mirrors PRD §2 + §5). The
// ownership matrix, sidebar IA, and seed-user list are DERIVED from the live data
// in lib/modules.ts + lib/phase2.ts so this page can never drift from the app.

import {
  MODULES,
  MODULE_NAV_GROUPS,
  modulesInAgendaOrder,
  type ModuleDef,
  type ModuleNavGroup,
} from "@/lib/modules";
import {
  DEMO_USERS,
  type DemoUser,
  type FunctionalRole,
  type Role,
} from "@/lib/phase2";

// ───────────────────────────── §5 weekly meeting agenda ─────────────────────────────

export interface AgendaItem {
  slot: number;
  item: string;
  minutes: number;
  /** Functional role(s) who present / act on this item (PRD §5). */
  owner: string;
  /** Module slugs this item is driven from. */
  moduleSlugs: string[];
}

/** PRD §5 Meeting integration — the agenda the menu IA + roles are organized around. */
export const AGENDA: AgendaItem[] = [
  { slot: 1, item: "Exec-level recap (executive narrative)", minutes: 5, owner: "Budget Owner / Co-founder", moduleSlugs: ["home"] },
  { slot: 2, item: "Dashboard scan (Scorecard)", minutes: 10, owner: "Marketing Lead", moduleSlugs: ["dashboard"] },
  { slot: 3, item: "Grassroots Growth Engine", minutes: 15, owner: "Grassroots Owner", moduleSlugs: ["grassroots"] },
  { slot: 4, item: "Thought Leadership & Content", minutes: 15, owner: "Content Owner", moduleSlugs: ["content"] },
  { slot: 5, item: "Nurture / Ops / Reporting", minutes: 15, owner: "Marketing Lead", moduleSlugs: ["nurture", "crm-ops"] },
  { slot: 6, item: "Admissions / feedback loop", minutes: 10, owner: "Field & Events Owner / Admissions Owner", moduleSlugs: ["admissions"] },
  { slot: 7, item: "Website & digital review", minutes: 5, owner: "Marketing Lead", moduleSlugs: ["analytics"] },
  { slot: 8, item: "Decisions + next actions", minutes: 5, owner: "Budget Owner / Co-founder", moduleSlugs: ["decisions"] },
];

export const AGENDA_TOTAL_MINUTES = AGENDA.reduce((sum, a) => sum + a.minutes, 0);

/** Module defs that anchor each agenda slot, in agenda order (Nurture before CRM Ops at slot 5). */
export function agendaModules(): { slot: number; modules: ModuleDef[] }[] {
  return AGENDA.map((a) => ({
    slot: a.slot,
    modules: a.moduleSlugs
      .map((slug) => MODULES.find((m) => m.slug === slug))
      .filter((m): m is ModuleDef => Boolean(m)),
  }));
}

// ───────────────────────────── Permission tiers (RBAC) ─────────────────────────────

export interface PermissionTier {
  role: Role;
  label: string;
  who: string;
  /** What this tier CAN do — the security grant. */
  can: string[];
  /** What this tier explicitly CANNOT do — the gate. */
  cannot: string[];
}

/** PRD §2 user roles — the deny-by-default security tiers enforced by middleware + policy. */
export const PERMISSION_TIERS: PermissionTier[] = [
  {
    role: "admin",
    label: "Admin",
    who: "the Marketing Lead",
    can: [
      "Full access to every module and internal/dev surfaces",
      "Edit all workstreams and submit decisions",
      "Edit any Budget Tracker row",
    ],
    cannot: [
      "View or act on the full Decision Queue (decision-making is Leadership-only)",
    ],
  },
  {
    role: "leader",
    label: "Leader",
    who: "Growth Marketing Officer, Budget Owner (fractional CMO), Co-founder",
    can: [
      "Exclusive view + act on the Decision Queue (approve / reject / need-info)",
      "Full read access, customize Home, set goals/targets, comment on any workstream",
      "Edit planned budget amounts and approve reallocations",
    ],
    cannot: [
      "Write another owner's actual spend without being that workstream's owner",
    ],
  },
  {
    role: "operator",
    label: "Operator",
    who: "Content, Grassroots, Field & Events, and Admissions Owners",
    can: [
      "Full read/write on their own module(s); read access to all others",
      "Submit ideas/proposals to the Decision Queue from their modules",
      "Edit their workstream rows in the Budget Tracker / Workstream Health Grid",
    ],
    cannot: [
      "View the full Decision Queue or act on others' decisions",
      "Access internal/dev surfaces",
    ],
  },
];

// ───────────────────────── Functional-role ownership matrix ─────────────────────────

export interface RoleOwnershipRow {
  user: DemoUser;
  /** Module defs this user owns, in canonical lib/modules.ts order. */
  modules: ModuleDef[];
}

/** Per-user ownership matrix derived from the live seed (lib/phase2.ts). */
export function roleOwnershipMatrix(users: DemoUser[] = DEMO_USERS): RoleOwnershipRow[] {
  return users.map((user) => ({
    user,
    modules: MODULES.filter((m) => user.ownsModules.includes(m.slug)),
  }));
}

/** The functional roles in display order (mirrors FunctionalRole union + seed order). */
export function seededFunctionalRoles(users: DemoUser[] = DEMO_USERS): FunctionalRole[] {
  const seen = new Set<FunctionalRole>();
  const ordered: FunctionalRole[] = [];
  for (const u of users) {
    for (const fr of u.functionalRoles) {
      if (!seen.has(fr)) {
        seen.add(fr);
        ordered.push(fr);
      }
    }
  }
  return ordered;
}

// ───────────────────────────── Sidebar IA (for docs) ─────────────────────────────

/** The agenda-aware sidebar sections with their resolved module defs (for documentation). */
export function navSections(): { group: ModuleNavGroup; modules: ModuleDef[] }[] {
  return MODULE_NAV_GROUPS.map((group) => ({
    group,
    modules: group.slugs
      .map((slug) => MODULES.find((m) => m.slug === slug))
      .filter((m): m is ModuleDef => Boolean(m)),
  }));
}

export { modulesInAgendaOrder };
