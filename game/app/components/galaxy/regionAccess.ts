import type { GalaxyRunState } from "../engine/galaxy/galaxyTypes";

/** The only contact with a region projection today (`openGalaxyRegion` supports it alone). */
export const REGION_CONTACT_ID = "contact:ashfall";

export type AtlasRegionAccess =
  | { status: "full"; contactId: string }
  | { status: "view"; contactId: string }
  | { status: "unavailable"; reason: string };

function visited(run: GalaxyRunState, contactId: string): boolean {
  return Object.keys(run.atlas.knowledge)
    .filter(key => Object.prototype.hasOwnProperty.call(run.atlas.knowledge, key))
    .some(key => {
      const record = run.atlas.knowledge[key];
      return record.subjectId === contactId && record.state === "visited";
    });
}

/**
 * Whether the atlas may open a contact's region chart, and how. Full access (survey, travel,
 * found) needs the vessel parked at the visited contact with no travel record open (an arrival
 * or retreat must be acknowledged first); a visited contact is otherwise view-only. Callers
 * that open the region must re-derive this rather than trust a caller's copy.
 */
export function atlasRegionAccess(run: GalaxyRunState | null, contactId: string | null): AtlasRegionAccess {
  if (run === null || contactId === null) return { status: "unavailable", reason: "SELECT A COLONY STAR" };
  if (contactId !== REGION_CONTACT_ID) return { status: "unavailable", reason: "NO REGION CHART HERE" };
  if (!visited(run, contactId)) return { status: "unavailable", reason: "ARRIVE AT ASHFALL FIRST" };
  const parked = run.activeTravel === null
    && run.vessel.status === "stationary"
    && run.vessel.contactId === contactId;
  return { status: parked ? "full" : "view", contactId };
}
