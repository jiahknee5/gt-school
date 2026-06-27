# Role scoping advisory — Security + Cohesion panels

**Feature:** Admin-assigned multi functional roles per profile + soft nav scope (My / All / Meeting agenda).

## Security panel (S1–S6) — decisions

| Decision | Ruling |
|----------|--------|
| Nav filter is soft only | **Approved.** RBAC (`middleware`, `policy`, `leaderOnly`) remains the only hard gate. Menu hiding must never be the sole access control. |
| Functional roles admin-only | **Required.** Same path as permission tier: `requireRole('admin')`, audited writes, no self-escalation of tier. |
| Multi-role escalation | **Allowed** for functional roles only — they describe org scope, not security grants. Tier changes still require explicit admin PATCH + audit. |
| navScope user preference | **Approved** as user-owned (`nav_preference` table), separate from admin profile fields. |
| `/dev/profiles` | **Admin-only** — inherits existing `/dev/*` middleware gate. |

## Cohesion panel (C2, C5, C6) — decisions

| Decision | Ruling |
|----------|--------|
| View control placement | **Sidebar header**, compact segmented control: *My modules · All · Agenda*. Not TopBar (PRD: name + title only). |
| Default scope | **`my`** — declutter for operators; leaders/admins can switch to All. |
| Empty groups | **Collapse** — unchanged behavior when a section has no visible modules. |
| Always-on in My scope | **Home, Dashboard, Library** + Help links; leader-only modules when tier allows. |

## PRD compliance

- Operators retain read access to all modules (soft filter only; routes unchanged).
- Decision Queue stays `leaderOnly` (hard gate).
- Permission tier stays admin-assigned + audited.
- TopBar: no production tier picker.

## Panel sign-off (implementation review)

| Panel | Verdict |
|-------|---------|
| Security (S1/S6) | **Pass** — nav scope is user preference only; tier + functional edits are admin-only + audited; no RBAC weakening. |
| Cohesion (C2/C5/C6) | **Pass** — View control in sidebar; My/All/Agenda modes; mobile TopBar strip respects same scope. |
| PRD §2 + §5 | **Pass** — operators read broadly; Decision Queue leader-only; admin assigns profiles at `/dev/profiles`. |
