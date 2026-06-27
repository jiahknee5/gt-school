"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/auth/profiles";
import {
  allAssignableModuleSlugs,
  allFunctionalRoles,
} from "@/lib/auth/profiles";
import type { Role } from "@/lib/phase2";
import { MODULES } from "@/lib/modules";

type EditableProfile = Pick<
  UserProfile,
  "id" | "displayName" | "email" | "role" | "title" | "functionalRoles" | "ownsModules"
>;

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function ProfileEditor({
  profile,
  onSaved,
}: {
  profile: EditableProfile;
  onSaved: () => void;
}) {
  const [tier, setTier] = useState<Role>(profile.role);
  const [functionalRoles, setFunctionalRoles] = useState<string[]>([
    ...profile.functionalRoles,
  ]);
  const [ownedModuleSlugs, setOwnedModuleSlugs] = useState<string[]>([
    ...profile.ownsModules,
  ]);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profile.id}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: tier,
          functionalRoles,
          ownedModuleSlugs,
          reason: reason || undefined,
        }),
      });
      const body = (await res.json()) as { error?: string; changed?: boolean };
      if (!res.ok) {
        setStatus(body.error ?? "Save failed.");
        return;
      }
      setStatus(body.changed ? "Saved." : "No changes.");
      onSaved();
    } catch {
      setStatus("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-ink">{profile.displayName}</p>
          <p className="mono text-[11px] text-label">{profile.email}</p>
          <p className="mt-0.5 text-[12px] text-muted">{profile.title}</p>
        </div>
        <label className="text-[11px] text-muted">
          Permission tier
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Role)}
            className="mt-1 block rounded-card border border-hairline bg-canvas px-2 py-1 text-[12px] text-ink"
          >
            <option value="admin">admin</option>
            <option value="leader">leader</option>
            <option value="operator">operator</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
          Functional roles (multi-select)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {allFunctionalRoles().map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-center gap-1.5 rounded-card border border-hairline px-2 py-1 text-[11px] text-slate"
            >
              <input
                type="checkbox"
                checked={functionalRoles.includes(role)}
                onChange={() => setFunctionalRoles(toggle(functionalRoles, role))}
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
          Owned modules
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {allAssignableModuleSlugs().map((slug) => {
            const mod = MODULES.find((m) => m.slug === slug);
            return (
              <label
                key={slug}
                className="flex cursor-pointer items-center gap-1.5 rounded-card border border-hairline px-2 py-1 text-[11px] text-slate"
              >
                <input
                  type="checkbox"
                  checked={ownedModuleSlugs.includes(slug)}
                  onChange={() =>
                    setOwnedModuleSlugs(toggle(ownedModuleSlugs, slug))
                  }
                />
                {mod?.short ?? slug}
              </label>
            );
          })}
        </div>
      </div>

      <label className="mt-4 block text-[11px] text-muted">
        Reason (audit trail)
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional note for audit log"
          className="mt-1 w-full rounded-card border border-hairline bg-canvas px-2 py-1 text-[12px] text-ink"
        />
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-card bg-ink-cta px-3 py-1.5 text-[12px] font-semibold text-on-cta hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {status ? <p className="text-[11px] text-muted">{status}</p> : null}
      </div>
    </div>
  );
}

export function ProfileAdminPanel({ profiles }: { profiles: EditableProfile[] }) {
  const [version, setVersion] = useState(0);

  return (
    <div key={version} className="mt-4 flex flex-col gap-4">
      {profiles.map((profile) => (
        <ProfileEditor
          key={profile.id}
          profile={profile}
          onSaved={() => setVersion((v) => v + 1)}
        />
      ))}
    </div>
  );
}
