import type { SocialVisibility } from "./socialTypes";

/**
 * Grant logic with no database and no I/O, so it can be reasoned about and
 * tested on its own. `socialGrants.ts` owns the persistence and re-exports
 * these.
 */

export type GrantShape = {
  ownerA: string;
  ownerB: string;
  visibility: SocialVisibility;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

/** Sorted so the pair is order-independent and the UNIQUE constraint bites. */
export function sortPair(a: string, b: string): { ownerA: string; ownerB: string } {
  return a < b ? { ownerA: a, ownerB: b } : { ownerA: b, ownerB: a };
}

export function isParticipant(grant: GrantShape, ownerKey: string): boolean {
  return grant.ownerA === ownerKey || grant.ownerB === ownerKey;
}

export function otherParticipant(grant: GrantShape, ownerKey: string): string {
  return grant.ownerA === ownerKey ? grant.ownerB : grant.ownerA;
}

export function isActive(grant: GrantShape, now = Date.now()): boolean {
  if (grant.revokedAt) return false;
  if (!grant.expiresAt) return true;
  return new Date(grant.expiresAt).getTime() > now;
}

/**
 * The effective visibility for a reader looking at `targetKey`.
 *
 * Because a grant is one row there is no per-direction setting, so the MORE
 * PERMISSIVE value wins if several grants ever exist for a pair. Neither partner
 * can unilaterally hide from the other, which is what keeps a mutual pairing
 * coherent.
 */
export function effectiveVisibility(
  grants: GrantShape[],
  readerKey: string,
  targetKey: string
): SocialVisibility | null {
  const relevant = grants.filter(
    (g) => isParticipant(g, readerKey) && isParticipant(g, targetKey) && isActive(g)
  );
  if (!relevant.length) return null;
  return relevant.some((g) => g.visibility === "full") ? "full" : "coarse";
}
