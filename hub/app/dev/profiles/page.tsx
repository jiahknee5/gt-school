import { DevTabs } from "../_components/DevTabs";
import { ProfileAdminPanel } from "./ProfileAdminPanel";
import { loadAllProfiles } from "@/lib/auth/profile-store";

export const dynamic = "force-dynamic";

export default async function DevProfilesPage() {
  const profiles = await loadAllProfiles();

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5">
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
        Developer · Profiles
      </p>
      <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
        User profiles &amp; role assignment
      </h1>
      <p className="mt-1.5 max-w-[680px] text-[12px] leading-snug text-muted">
        Admin-only. Assign each user a permission tier (admin / leader / operator) and one
        or more functional org roles (Grassroots Owner, Marketing Lead, etc.). Functional
        roles drive the soft &ldquo;My modules&rdquo; sidebar view; RBAC gates are unchanged.
      </p>

      <DevTabs />

      <ProfileAdminPanel
        profiles={profiles.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          email: p.email,
          role: p.role,
          title: p.title,
          functionalRoles: p.functionalRoles,
          ownsModules: p.ownsModules,
        }))}
      />
    </div>
  );
}
