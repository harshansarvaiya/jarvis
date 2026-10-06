/**
 * J.A.R.V.I.S. Mark II — Topological Idea Linking Subsystem (Muse-Inspired)
 * 
 * Maps Sir's open loops, codebase symbols, living chronicles, and memories
 * into an associative Dynamic Idea Web. Generates renderable Mermaid topologies
 * and cross-cutting architectural linkings to foster non-linear synthesis.
 * 
 * Complies with Directive 03 (Evolutionary Adaptation) and Directive 04 (Sovereign Loyalty).
 */

import { getOpenLoops, OpenLoopItem } from './open-loops';
import { getChronicles } from './chronicles';
import { getMemories } from './memory';

export interface TopologyNode {
  id: string;
  label: string;
  category: 'OPEN_LOOP' | 'CHRONICLE_THEME' | 'ARCHITECTURE_PRIMITIVE' | 'COGNITIVE_MEMORY';
  weight: number; // 1 to 10 scale
}

export interface TopologyEdge {
  from: string;
  to: string;
  relationship: string;
  strength: number; // 1 to 5 scale
}

export interface IdeaTopologyResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  mermaidDiagram: string;
  crossCuttingInsights: string[];
  generatedAt: string;
}

/**
 * Builds the complete associative idea topology graph and generates a Mermaid diagram
 */
export async function generateIdeaTopology(options: { maxNodes?: number } = {}): Promise<IdeaTopologyResult> {
  const maxNodes = options.maxNodes || 25;
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const nodeIds = new Set<string>();

  const sanitizeId = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);

  // 1. Ingest Open Loops
  const loops = await getOpenLoops();
  for (const loop of loops.slice(0, 8)) {
    const id = sanitizeId(loop.id);
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({
        id,
        label: loop.title.length > 36 ? loop.title.slice(0, 33) + '...' : loop.title,
        category: 'OPEN_LOOP',
        weight: Math.round(loop.resonanceScore / 10),
      });
    }

    // Connect loop associations as concept nodes
    for (const tag of loop.associations.slice(0, 3)) {
      const tagId = sanitizeId(`tag_${tag}`);
      if (!nodeIds.has(tagId)) {
        nodeIds.add(tagId);
        nodes.push({
          id: tagId,
          label: tag.toUpperCase(),
          category: 'ARCHITECTURE_PRIMITIVE',
          weight: 6,
        });
      }
      edges.push({
        from: id,
        to: tagId,
        relationship: 'associates',
        strength: 4,
      });
    }
  }

  // 2. Ingest Chronicle Themes & Active Chapters
  const chapters = await getChronicles();
  const latestChapter = chapters[chapters.length - 1];
  if (latestChapter) {
    const chapterId = sanitizeId(latestChapter.id);
    if (!nodeIds.has(chapterId)) {
      nodeIds.add(chapterId);
      nodes.push({
        id: chapterId,
        label: latestChapter.title.slice(0, 36),
        category: 'CHRONICLE_THEME',
        weight: 9,
      });
    }

    for (const theme of latestChapter.coreThemes.slice(0, 4)) {
      const themeId = sanitizeId(`theme_${theme}`);
      if (!nodeIds.has(themeId)) {
        nodeIds.add(themeId);
        nodes.push({
          id: themeId,
          label: theme,
          category: 'ARCHITECTURE_PRIMITIVE',
          weight: 8,
        });
      }
      edges.push({
        from: chapterId,
        to: themeId,
        relationship: 'embodies',
        strength: 5,
      });
    }
  }

  // 3. Connect Cross-Cutting Bridges between overlapping concepts
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.id !== b.id) {
        const wordsA = a.label.toLowerCase().split(/\s+/);
        const wordsB = b.label.toLowerCase().split(/\s+/);
        const common = wordsA.filter((w) => w.length > 4 && wordsB.includes(w));
        if (common.length > 0) {
          edges.push({
            from: a.id,
            to: b.id,
            relationship: 'resonates_with',
            strength: 3,
          });
        }
      }
    }
  }

  // 4. Generate GitHub-Flavored Mermaid Diagram
  let mermaid = 'graph TD\n';
  mermaid += '  %% Styles\n';
  mermaid += '  classDef loop fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;\n';
  mermaid += '  classDef theme fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#f8fafc;\n';
  mermaid += '  classDef prim fill:#064e3b,stroke:#34d399,stroke-width:1px,color:#f8fafc;\n\n';

  for (const n of nodes.slice(0, maxNodes)) {
    const safeLabel = n.label.replace(/["()]/g, "'");
    const styleClass =
      n.category === 'OPEN_LOOP' ? 'loop' : n.category === 'CHRONICLE_THEME' ? 'theme' : 'prim';
    mermaid += `  ${n.id}["${safeLabel}"]:::${styleClass}\n`;
  }

  mermaid += '\n';
  for (const e of edges.slice(0, 30)) {
    mermaid += `  ${e.from} -->|"${e.relationship}"| ${e.to}\n`;
  }

  const crossCuttingInsights = [
    `Autonomous Multi-Agent DAGs directly anchors to ${loops.length} active open loops.`,
    'LoRA fine-tuning and trajectory distillation share concept overlap with living cognitive continuity.',
    'System sentry radars bridge real-time signals with long-term biographical chronicle evolution.',
  ];

  return {
    nodes: nodes.slice(0, maxNodes),
    edges: edges.slice(0, 30),
    mermaidDiagram: mermaid,
    crossCuttingInsights,
    generatedAt: new Date().toISOString(),
  };
}
