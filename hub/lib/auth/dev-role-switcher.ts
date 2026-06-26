import { AUTH_PROFILES, type UserProfile } from "@/lib/auth/profiles";
import type { Role } from "@/lib/phase2";

const ROLE_ORDER: Role[] = ["admin", "leader", "operator"];

export function devRoleSwitchUsers(users: UserProfile[] = AUTH_PROFILES): UserProfile[] {
  const firstByRole = new Map<Role, UserProfile>();

  for (const user of users) {
    if (!firstByRole.has(user.role)) firstByRole.set(user.role, user);
  }

  return ROLE_ORDER.flatMap((role) => {
    const user = firstByRole.get(role);
    return user ? [user] : [];
  });
}
