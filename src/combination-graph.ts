import type { ActionLogEntry } from "./types";

interface GraphNode {
  name: string;
  tier: number;
  x: number;
  y: number;
  isSeed: boolean;
}

interface GraphEdge {
  fromA: string;
  fromB: string;
  to: string;
}

const TIER_COLORS = ["", "#a8d8ea", "#6bc5a0", "#f4e285", "#fca", "#ff6b6b"];

export function renderCombinationGraph(
  canvas: HTMLCanvasElement,
  actions: ActionLogEntry[],
  seeds: string[],
): void {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;

  // Build graph data
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // Add seed nodes
  for (const seed of seeds) {
    nodes.set(seed, { name: seed, tier: 1, x: 0, y: 0, isSeed: true });
  }

  // Add action nodes and edges
  for (const a of actions) {
    if (!nodes.has(a.parentA)) {
      nodes.set(a.parentA, { name: a.parentA, tier: 1, x: 0, y: 0, isSeed: false });
    }
    if (!nodes.has(a.parentB)) {
      nodes.set(a.parentB, { name: a.parentB, tier: 1, x: 0, y: 0, isSeed: false });
    }
    if (!nodes.has(a.result)) {
      nodes.set(a.result, { name: a.result, tier: a.resultTier, x: 0, y: 0, isSeed: false });
    } else {
      nodes.get(a.result)!.tier = a.resultTier;
    }
    edges.push({ fromA: a.parentA, fromB: a.parentB, to: a.result });
  }

  if (nodes.size === 0) return;

  // Layout: group by tier, spread horizontally
  const tierGroups = new Map<number, GraphNode[]>();
  for (const node of nodes.values()) {
    const tier = node.tier;
    if (!tierGroups.has(tier)) tierGroups.set(tier, []);
    tierGroups.get(tier)!.push(node);
  }

  const tiers = Array.from(tierGroups.keys()).sort((a, b) => a - b);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const tierSpacing = height / (tiers.length + 1);

  for (let ti = 0; ti < tiers.length; ti++) {
    const group = tierGroups.get(tiers[ti])!;
    const y = tierSpacing * (ti + 1);
    const xSpacing = width / (group.length + 1);
    for (let ni = 0; ni < group.length; ni++) {
      group[ni].x = xSpacing * (ni + 1);
      group[ni].y = y;
    }
  }

  // Set canvas resolution
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  // Clear
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, width, height);

  // Draw edges
  for (const edge of edges) {
    const a = nodes.get(edge.fromA);
    const b = nodes.get(edge.fromB);
    const to = nodes.get(edge.to);
    if (!a || !b || !to) continue;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Draw nodes
  for (const node of nodes.values()) {
    const color = TIER_COLORS[node.tier] || "#fff";
    const radius = node.isSeed ? 6 : 5;

    // Glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = color.replace(")", ", 0.2)").replace("rgb", "rgba").replace("#", "");
    // Use a simple transparent version
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    ctx.fillStyle = "#eee";
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(node.name, node.x, node.y - radius - 4);
  }

  // Legend
  ctx.textAlign = "left";
  ctx.font = "10px system-ui";
  let lx = 8;
  for (let t = 1; t <= 5; t++) {
    ctx.fillStyle = TIER_COLORS[t];
    ctx.beginPath();
    ctx.arc(lx + 5, height - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#888";
    ctx.fillText(`T${t}`, lx + 13, height - 8);
    lx += 38;
  }
}
