import { coord } from "./coordinates";
import type { AtlasCellFact, GalaxyCoordinate } from "./galaxyTypes";

export interface AuthoredAnchor {
  readonly id: string;
  readonly coordinate: Readonly<GalaxyCoordinate>;
  readonly kind: Extract<AtlasCellFact["kind"], "stellar_contact" | "signal">;
  readonly contactId: string | null;
}

export type AuthoredAnchorRegistryResult =
  | { ok: true; anchors: readonly AuthoredAnchor[] }
  | { ok: false; reason: "unsupported_registry_version" };

export const BLIND_FIXTURE_COORDINATE: Readonly<GalaxyCoordinate> = Object.freeze(
  coord(0, 0, 1792, 1792),
);

function frozenAnchor(
  id: string,
  coordinate: GalaxyCoordinate,
  kind: AuthoredAnchor["kind"],
  contactId: string | null,
): AuthoredAnchor {
  return Object.freeze({
    id,
    coordinate: Object.freeze({ ...coordinate }),
    kind,
    contactId,
  });
}

const AUTHORED_ANCHORS_V1: readonly AuthoredAnchor[] = Object.freeze([
  frozenAnchor(
    "contact:vanguard",
    coord(0, 0, 512, 512),
    "stellar_contact",
    "contact:vanguard",
  ),
  frozenAnchor(
    "contact:ashfall",
    coord(0, 0, 1024, 512),
    "stellar_contact",
    "contact:ashfall",
  ),
  frozenAnchor(
    "contact:hostile-picket",
    coord(0, 0, 1280, 1024),
    "stellar_contact",
    "contact:hostile-picket",
  ),
  frozenAnchor(
    "contact:kepler",
    coord(0, 0, 2048, 1024),
    "stellar_contact",
    "contact:kepler",
  ),
  frozenAnchor(
    "signal:unresolved-g0",
    coord(0, 0, 2816, 1792),
    "signal",
    null,
  ),
]);

function cloneRegistry(
  anchors: readonly AuthoredAnchor[],
): readonly AuthoredAnchor[] {
  return Object.freeze(
    anchors.map((anchor) =>
      frozenAnchor(
        anchor.id,
        { ...anchor.coordinate },
        anchor.kind,
        anchor.contactId,
      ),
    ),
  );
}

const REGISTRY_FACTORIES = Object.freeze({
  1: () => cloneRegistry(AUTHORED_ANCHORS_V1),
});

function registryFactoryFor(
  version: number,
): (() => readonly AuthoredAnchor[]) | undefined {
  if (!Object.prototype.hasOwnProperty.call(REGISTRY_FACTORIES, version)) {
    return undefined;
  }
  return REGISTRY_FACTORIES[version as keyof typeof REGISTRY_FACTORIES];
}

export function getAuthoredAnchorRegistry(
  version: number,
): AuthoredAnchorRegistryResult {
  const factory = registryFactoryFor(version);
  if (factory === undefined) {
    return { ok: false, reason: "unsupported_registry_version" };
  }
  return { ok: true, anchors: factory() };
}
