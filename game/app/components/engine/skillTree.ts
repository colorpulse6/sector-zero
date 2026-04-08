import type { SkillNodeId, SkillTreeId } from "./types";

export interface SkillNode {
  id: SkillNodeId;
  tree: SkillTreeId;
  name: string;
  description: string;
  cost: number;
  isCapstone: boolean;
  prerequisites: SkillNodeId[];
  icon: string;
  color: string;
  effectValue: number;
}

export const COMBAT_TREE: SkillNode[] = [
  {
    id: "sharpshooter",
    tree: "combat",
    name: "Sharpshooter",
    description: "+20% damage to enemies at Effective affinity",
    cost: 1,
    isCapstone: false,
    prerequisites: [],
    icon: "\u2316",
    color: "#ff4444",
    effectValue: 0.2,
  },
  {
    id: "overcharge",
    tree: "combat",
    name: "Overcharge",
    description: "Weapon power-ups last 50% longer",
    cost: 1,
    isCapstone: false,
    prerequisites: [],
    icon: "\u26A1",
    color: "#ffaa44",
    effectValue: 0.5,
  },
  {
    id: "berserker",
    tree: "combat",
    name: "Berserker",
    description: "+5% damage per missing HP",
    cost: 1,
    isCapstone: false,
    prerequisites: ["sharpshooter"],
    icon: "\u2694",
    color: "#ff2222",
    effectValue: 0.05,
  },
  {
    id: "glass-cannon",
    tree: "combat",
    name: "Glass Cannon",
    description: "+30% damage, -1 max HP",
    cost: 1,
    isCapstone: false,
    prerequisites: ["berserker"],
    icon: "\u2622",
    color: "#ff6600",
    effectValue: 0.3,
  },
  {
    id: "adrenaline",
    tree: "combat",
    name: "Adrenaline Rush",
    description: "+10% fire rate (permanent)",
    cost: 1,
    isCapstone: false,
    prerequisites: ["overcharge"],
    icon: "\u2764",
    color: "#ff4488",
    effectValue: 0.1,
  },
  {
    id: "signature-weapon",
    tree: "combat",
    name: "Signature Weapon",
    description: "Equip a second primary weapon type",
    cost: 2,
    isCapstone: true,
    prerequisites: ["sharpshooter", "overcharge", "berserker", "glass-cannon", "adrenaline"],
    icon: "\u2726",
    color: "#ffdd00",
    effectValue: 1,
  },
];

export const ALL_SKILL_NODES: SkillNode[] = [...COMBAT_TREE];

export function getNode(id: SkillNodeId): SkillNode | undefined {
  return ALL_SKILL_NODES.find((n) => n.id === id);
}

export function getTreeNodes(tree: SkillTreeId): SkillNode[] {
  return ALL_SKILL_NODES.filter((n) => n.tree === tree);
}

export function canAllocate(
  nodeId: SkillNodeId,
  allocated: SkillNodeId[],
  availablePoints: number
): boolean {
  if (allocated.includes(nodeId)) return false;
  const node = getNode(nodeId);
  if (!node) return false;
  if (node.cost > availablePoints) return false;
  return node.prerequisites.every((pre) => allocated.includes(pre));
}

export function allocateNode(
  nodeId: SkillNodeId,
  allocated: SkillNodeId[],
  availablePoints: number
): { allocated: SkillNodeId[]; pointsRemaining: number } | null {
  if (!canAllocate(nodeId, allocated, availablePoints)) return null;
  const node = getNode(nodeId)!;
  return {
    allocated: [...allocated, nodeId],
    pointsRemaining: availablePoints - node.cost,
  };
}

export function respecAll(
  allocated: SkillNodeId[]
): { allocated: SkillNodeId[]; pointsReturned: number } {
  let returned = 0;
  for (const id of allocated) {
    const node = getNode(id);
    if (node) returned += node.cost;
  }
  return { allocated: [], pointsReturned: returned };
}

export function hasSkill(allocated: SkillNodeId[], id: SkillNodeId): boolean {
  return allocated.includes(id);
}

export function getSkillEffect(allocated: SkillNodeId[], id: SkillNodeId): number {
  if (!allocated.includes(id)) return 0;
  const node = getNode(id);
  return node?.effectValue ?? 0;
}

export function __runSkillTreeSelfTests(): void {
  console.assert(COMBAT_TREE.length === 6, `Combat tree has ${COMBAT_TREE.length} nodes, expected 6`);
  const capstone = COMBAT_TREE.find((n) => n.isCapstone);
  console.assert(capstone !== undefined, "Combat tree missing capstone");
  console.assert(capstone!.cost === 2, "Capstone should cost 2 points");
  console.assert(capstone!.prerequisites.length === 5, "Capstone should require all 5 regular nodes");
  const totalCost = COMBAT_TREE.reduce((sum, n) => sum + n.cost, 0);
  console.assert(totalCost === 7, `Full combat tree costs ${totalCost}, expected 7`);
  console.assert(canAllocate("sharpshooter", [], 1), "Should allocate sharpshooter with 1 point");
  console.assert(!canAllocate("sharpshooter", [], 0), "Can't allocate with 0 points");
  console.assert(!canAllocate("berserker", [], 1), "Berserker requires sharpshooter first");
  console.assert(canAllocate("berserker", ["sharpshooter"], 1), "Berserker allowed after sharpshooter");
  console.assert(!canAllocate("sharpshooter", ["sharpshooter"], 1), "Can't double-allocate");
  const result = allocateNode("sharpshooter", [], 3);
  console.assert(result !== null, "Should succeed");
  console.assert(result!.allocated.includes("sharpshooter"), "Should include sharpshooter");
  console.assert(result!.pointsRemaining === 2, "Should have 2 points remaining");
  const respec = respecAll(["sharpshooter", "overcharge", "berserker"]);
  console.assert(respec.allocated.length === 0, "Respec clears all");
  console.assert(respec.pointsReturned === 3, "Respec returns 3 points");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runSkillTreeSelfTests();
}
