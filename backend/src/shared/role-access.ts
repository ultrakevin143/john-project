// Preserve domain permissions while separating integration, stewardship and
// analysis pages. Database grants still determine all other access.
const restricted: Record<string, readonly string[]> = {
  operator: [
    "governance:read",
    "governance:write",
    "audit:read",
    "reports:read",
    "reports:nrw",
  ],
  steward: [
    "integrations:read",
    "integrations:write",
    "reports:read",
    "reports:nrw",
  ],
  analyst: [
    "integrations:read",
    "integrations:write",
    "dq:read",
    "dq:write",
    "governance:read",
    "governance:write",
    "audit:read",
  ],
};

export function effectivePermissions(
  roleCode: string,
  granted: string[],
): string[] {
  const blocked = restricted[roleCode] ?? [];
  return granted.filter((permission) => !blocked.includes(permission));
}
