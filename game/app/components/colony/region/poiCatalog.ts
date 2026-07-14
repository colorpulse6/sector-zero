import type { RegionNode } from "../shared/colonyTypes";

export const POI_TEMPLATE_IDS = [
  "fp-ruin-cinder-relay",
  "boarding-wreck-oathbreaker",
  "ground-canyon-glassknife",
] as const;

export type PoiTemplateId = typeof POI_TEMPLATE_IDS[number];

export function isSupportedPoiNode(node: RegionNode): node is RegionNode & { templateId: PoiTemplateId } {
  return (node.type === "ruins" && node.templateId === "fp-ruin-cinder-relay")
    || (node.type === "wreck" && node.templateId === "boarding-wreck-oathbreaker")
    || (node.type === "cave" && node.templateId === "ground-canyon-glassknife");
}
