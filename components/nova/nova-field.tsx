'use client';

import { cn } from '@/lib/utils/cn';
import type { NovaState } from '@/components/ui/nova-mark';
import { useIsRelated, useNovaFocus } from '@/components/nova/nova-focus';

/**
 * The constellation.
 *
 * ## What this is, and why it is not decoration
 *
 * `NovaMark` is an icon: nine invented points, fixed geometry, a logo that can
 * animate. This is the same idea at product scale, and the difference is that
 * **its nodes are real.** Once an answer exists, each node corresponds to one
 * `chunk_id` the retrieval run actually returned, and the count on screen is
 * the count in the result. Nothing is padded to fill the field and nothing is
 * dropped to tidy it.
 *
 * That is what makes it honest enough to be the centrepiece. A field of
 * decorative particles behind a regulatory answer would be exactly the
 * "generic AI aesthetic" we have been avoiding; a field where every point is a
 * source you can hover and trace is the product's thesis rendered directly:
 *
 *     FRAGMENTATION  →  INVESTIGATION  →  EVIDENCE  →  CLARITY
 *
 * ## Why there are lines between the points
 *
 * Convergence alone says the sources were gathered. It does not say they are
 * RELATED — and relation is the actual product thesis, because the founder's
 * problem is that one obligation is spread across an Act, a regulation made
 * under it, and a notice amending that. So the field draws an arc between two
 * points whenever their passages come from the SAME DOCUMENT.
 *
 * ⚠ That edge is a fact from the citation data, not a guess. It says "these two
 *   passages were cut from one instrument" — nothing more. It is emphatically
 *   NOT a legal relationship: Nova cannot know that section 3 qualifies section
 *   9, and an edge that implied it would be exactly the fabricated reasoning
 *   the extractive architecture exists to make impossible.
 *
 * ## Before a question exists
 *
 * With no chunks, the field renders a fixed scatter — the "before". It is
 * explicitly labelled as illustrative in the accessible description, because a
 * scatter that looks like data but is not would undo the whole argument.
 *
 * ## Geometry
 *
 * Positions are derived deterministically from the chunk id, not random. Two
 * renders of the same answer produce the same constellation, which matters for
 * the same reason `chunk_id` is stable: an interface that reshuffles itself on
 * every render is one a founder cannot point at.
 *
 * Pure SVG and CSS. No canvas, no WebGL, no animation library, and the whole
 * thing is inert under `prefers-reduced-motion` via the base layer.
 */

/** Field box in user units. Wide and shallow — a horizon, not a sphere. */
const W = 320;
const H = 96;

/**
 * A small deterministic hash → two coordinates.
 *
 * FNV-1a, 32-bit. Chosen because it is four lines, has no dependency, and
 * distributes short ASCII strings like `zz-chunk-food-s3` well enough that
 * nodes do not visibly cluster. It is not a security primitive and nothing
 * here depends on it being one.
 */
function scatterFor(id: string, index: number): { x: number; y: number } {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const a = (hash >>> 0) % 1000;
  const b = ((hash >>> 10) >>> 0) % 1000;

  // Bias x by index so nodes spread across the field rather than bunching
  // wherever the hash happens to land.
  const lane = (index + 0.5) / Math.max(index + 1, 1);
  const x = 18 + ((a / 1000) * 0.55 + lane * 0.4) * (W - 36);

  return { x: Math.min(x, W - 18), y: 14 + (b / 1000) * (H - 28) };
}

/** The resting scatter, used before any question has been asked. */
const IDLE_SCATTER: readonly { x: number; y: number }[] = [
  { x: 26, y: 22 },
  { x: 68, y: 62 },
  { x: 104, y: 30 },
  { x: 138, y: 71 },
  { x: 171, y: 18 },
  { x: 205, y: 55 },
  { x: 238, y: 26 },
  { x: 272, y: 66 },
  { x: 298, y: 38 },
];

/** Where node `index` comes to rest on the axis. */
function convergedX(index: number): number {
  return Math.min(26 + index * 30, W - 18);
}

export interface NovaFieldNode {
  chunkId: string;
  /** The claim this chunk supports, so focusing one lights the other. */
  claimId: string;
  /** Sibling chunks under the same claim. */
  siblings: readonly string[];
  /**
   * The instrument this passage was cut from.
   *
   * The ONLY basis on which an edge is drawn. Two nodes are connected when this
   * matches exactly — a fact recorded in the citation, requiring no inference.
   */
  document: string;
  /** Short label, shown only to assistive technology. */
  label: string;
}

interface FieldEdge {
  id: string;
  from: string;
  to: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Connect consecutive passages that share a document.
 *
 * Consecutive rather than every pair: three passages from one Act produce two
 * arcs, not three, so the picture stays legible as the corpus grows. The
 * relationship shown is identical either way — these came from one instrument.
 */
function edgesFor(nodes: readonly NovaFieldNode[]): FieldEdge[] {
  const lastSeen = new Map<string, number>();
  const edges: FieldEdge[] = [];

  nodes.forEach((node, index) => {
    const previous = lastSeen.get(node.document);
    if (previous !== undefined) {
      const from = nodes[previous];
      if (from) {
        edges.push({
          id: `${from.chunkId}-${node.chunkId}`,
          from: from.chunkId,
          to: node.chunkId,
          fromIndex: previous,
          toIndex: index,
        });
      }
    }
    lastSeen.set(node.document, index);
  });

  return edges;
}

export function NovaField({
  state,
  nodes,
  className,
}: {
  state: NovaState;
  /**
   * One entry per retrieved chunk that supports a claim.
   *
   * ⚠ Empty before an answer exists. The field then renders an illustrative
   *   scatter, and says so — it must never look like a measurement of
   *   something that has not been measured.
   */
  nodes: readonly NovaFieldNode[];
  className?: string;
}) {
  const hasData = nodes.length > 0;

  /**
   * Edges only once the points have settled.
   *
   * Mid-search the nodes are still scattered, and a line drawn to where a point
   * is GOING rather than where it is would be a picture of something that has
   * not happened yet.
   */
  const settled = state === 'ready' || state === 'limited';
  const edges = hasData && settled ? edgesFor(nodes) : [];

  return (
    <div data-nova-state={state} className={cn('nova-field relative w-full', className)}>
      {/*
        Described rather than drawn for assistive technology. The relationship
        this shows is already stated in text by every finding and its source
        list; repeating it as a described picture would be noise.
      */}
      {hasData ? (
        <p className="sr-only">
          {nodes.length} {nodes.length === 1 ? 'source' : 'sources'} support this answer.
          {edges.length > 0
            ? ` ${edges.length} ${edges.length === 1 ? 'pair' : 'pairs'} of them come from the same document.`
            : null}{' '}
          Each is listed with its finding below.
        </p>
      ) : null}

      {/*
        ⚠ `aria-hidden` ONLY when the field is illustrative.

        With data, the nodes are focusable controls, and a focusable element
        inside an `aria-hidden` subtree is an ARIA violation with a real
        consequence: a keyboard user could tab to a node that a screen reader
        announces as nothing. Empty, the field is pure decoration and hiding it
        is correct — an illustrative scatter must never be described as if it
        were a measurement.
      */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full overflow-visible sm:h-24"
        {...(hasData
          ? { role: 'group', 'aria-label': 'Sources supporting this answer' }
          : { 'aria-hidden': true as const, focusable: false })}
      >
        {/* The axis the field resolves onto — the same one the mark uses. */}
        <rect
          className="nova-axis fill-bahama-turquoise"
          x="14"
          y={H / 2 - 0.5}
          width={W - 28}
          height="1"
          rx="0.5"
        />

        {/*
          Edges first, so a node always sits on top of the lines that reach it.
        */}
        {edges.length > 0 ? <FieldEdges edges={edges} /> : null}

        {hasData
          ? nodes.map((node, i) => <FieldNode key={node.chunkId} node={node} index={i} />)
          : IDLE_SCATTER.map((point, i) => (
              <circle
                key={`${point.x}-${point.y}`}
                className="nova-point fill-on-ink"
                cx="0"
                cy="0"
                r="2.4"
                style={
                  {
                    '--sx': point.x,
                    '--sy': point.y,
                    '--cx': 26 + i * ((W - 52) / (IDLE_SCATTER.length - 1)),
                    '--cy': H / 2,
                    '--i': i,
                  } as React.CSSProperties
                }
              />
            ))}
      </svg>
    </div>
  );
}

/**
 * The arcs.
 *
 * Rendered as one component with a SINGLE context read, rather than a hook per
 * edge — calling `useIsRelated` inside a `.map` would be a rules-of-hooks
 * violation the moment the edge count changed between renders.
 *
 * An arc rather than a straight line because every node rests on the axis, so a
 * straight line between two of them would lie exactly along it and be invisible.
 * The bulge scales with distance, which also keeps two arcs over the same span
 * from overlapping.
 */
function FieldEdges({ edges }: { edges: readonly FieldEdge[] }) {
  const { focusedChunk, relatedChunks } = useNovaFocus();

  const lit = (chunkId: string) =>
    focusedChunk !== null && (chunkId === focusedChunk || relatedChunks.includes(chunkId));

  return (
    <g className="nova-edges" aria-hidden="true">
      {edges.map((edge) => {
        const x1 = convergedX(edge.fromIndex);
        const x2 = convergedX(edge.toIndex);
        const y = H / 2;
        const bulge = Math.min(34, 12 + (x2 - x1) * 0.34);

        return (
          <path
            key={edge.id}
            className="nova-edge"
            data-related={lit(edge.from) || lit(edge.to) ? 'true' : undefined}
            d={`M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - bulge} ${x2} ${y}`}
            fill="none"
          />
        );
      })}
    </g>
  );
}

/**
 * One source, as a node.
 *
 * Interactive: hovering or focusing it publishes its chunk id, which lights
 * both this node and the finding it supports. A `<circle>` cannot take focus,
 * so the hit target is a transparent `<rect>` with `tabIndex` — larger than the
 * dot, which is also the correct target size for a pointer.
 */
function FieldNode({ node, index }: { node: NovaFieldNode; index: number }) {
  const { focus } = useNovaFocus();
  const related = useIsRelated(node.chunkId);

  const scatter = scatterFor(node.chunkId, index);
  const converged = { x: convergedX(index), y: H / 2 };

  const highlight = () => focus(node.chunkId, node.siblings);
  const release = () => focus(null);

  return (
    <g
      className="nova-node"
      data-chunk={node.chunkId}
      data-related={related ? 'true' : undefined}
      onMouseEnter={highlight}
      onMouseLeave={release}
      onFocus={highlight}
      onBlur={release}
    >
      <circle
        className="nova-point fill-on-ink pointer-events-none"
        cx="0"
        cy="0"
        r={related ? 3.6 : 2.4}
        style={
          {
            '--sx': scatter.x,
            '--sy': scatter.y,
            '--cx': converged.x,
            '--cy': converged.y,
            '--i': index,
          } as React.CSSProperties
        }
      />

      <rect
        x={converged.x - 11}
        y={converged.y - 11}
        width="22"
        height="22"
        fill="transparent"
        tabIndex={0}
        role="button"
        aria-label={`Source: ${node.label}`}
        className="cursor-pointer focus:outline-none"
      />
    </g>
  );
}
