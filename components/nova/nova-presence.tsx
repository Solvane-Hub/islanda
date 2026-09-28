'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { resolvePresenceConfig, type PresenceConfig } from '@/lib/nova/presence';
import { novaStateLabel, type NovaState } from '@/components/ui/nova-mark';

/**
 * Nova's physical presence — Islanda's intelligence made physical.
 *
 * ## What it is
 *
 * A forged intelligence instrument: a molten champagne core inside a translucent
 * crystalline shell, suspended in a field of cyan energy particles that occupy
 * real depth. NOT an orb, a face, a waveform, or a decorative blob. Asymmetric
 * and dimensional, so a viewer reads "there is something here" before a word is
 * said. The lifecycle it performs is the product's thesis:
 *
 *     FRAGMENTATION → CONNECTION → CONVERGENCE → CLARITY
 *
 * ## How depth is created (no 3D engine)
 *
 * The whole illusion is 2D canvas, kept deliberately so (high visual ROI, no
 * Three.js). Depth comes from craft, not from a renderer:
 *
 *   • THREE PARALLAX PLANES — background, mid, foreground. A particle's `z`
 *     drives its size, opacity, softness (back particles are drawn as fuzzy
 *     blobs, front ones crisp with a highlight), speed, and how far it shifts
 *     with the pointer. Painter's order (back → core → front) makes foreground
 *     particles overlap the core, which is what sells occupied space.
 *   • LAYERED CORE — an additive halo, several overlapping crystalline facets at
 *     different rotations, a molten radial interior with a drifting off-centre
 *     hot spot, internal refraction highlights, a directional shadow side, and a
 *     champagne rim light. Overlap and light order create dimension, not
 *     brightness.
 *
 * ## The material
 *
 * Champagne/gold = intelligence and clarity (the molten centre, the rim).
 * Cyan/turquoise = information and connection (the particles, the energy).
 * Deep near-black atmosphere around it. Warmth is forged and luxurious, never
 * fiery — no orange. Bloom is restrained (additive layers at low alpha).
 *
 * ## Speaking
 *
 * The locked Web Audio pipeline writes amplitude into `levelRef`; this only
 * improves the visual response. The level is smoothed AGAIN here (a slow ease)
 * so nothing pulses per frame or bounces to a beat. It nudges several parameters
 * gently at once — core scale, hot-spot intensity, a small shell deformation,
 * particle push, glow — so Nova reads as physically alive while speaking rather
 * than as an audio visualizer.
 *
 * ## Honesty & accessibility
 *
 * Per-state behaviour comes from `lib/nova/presence.ts`; nothing here implies
 * reasoning. State reaches assistive tech as WORDS (the label / a status line),
 * never through motion — the canvas is decorative and marked accordingly.
 *
 * ## Performance & respect
 *
 *   • One rAF loop, cancelled on unmount and while the tab is hidden.
 *   • Fixed, modest particle count; DPR clamped to 2.
 *   • `prefers-reduced-motion` (via `shouldMove=false`) draws ONE resting frame
 *     and schedules nothing — a strobing core is the harm the preference exists
 *     to prevent.
 *   • `levelRef` and pointer are read per frame via refs, never through React
 *     state, so 60fps drives no re-render.
 */

const MAX_DPR = 2;
const CONFIG_EASE = 0.05;
/** Extra, slow smoothing of the audio level so nothing pulses per frame. */
const LEVEL_EASE = 0.12;
/** Max pointer parallax shift, as a fraction of the max radius (front plane). */
const PARALLAX = 0.06;

/** Particles per depth plane: back (fuzzy, slow) → front (crisp, fast). */
const PLANES = [
  { z: 0.22, count: 24 },
  { z: 0.55, count: 20 },
  { z: 0.9, count: 14 },
] as const;

/** RGB triplets matching the design tokens (canvas needs concrete colours). */
const COLOR = {
  turquoise: '18, 200, 213', // --color-bahama-turquoise — connection
  cyan: '11, 165, 204', // --color-bahama-cyan — information
  champagne: '216, 201, 168', // --color-champagne — intelligence
  gold: '224, 200, 150', // warm forged highlight (not orange)
  hot: '240, 247, 245', // near-white molten centre
  shadow: '2, 6, 12', // --color-abyss — the shadow side
};

interface Particle {
  /** Depth 0 (back) .. 1 (front). Drives size, alpha, softness, speed, parallax. */
  z: number;
  angle: number;
  /** Current radius as a fraction of the max, eased toward its target. */
  radius: number;
  /** Per-particle ring offset within the state's spread, −1..1. */
  offset: number;
  speedFactor: number;
  /** Base dot size in device-independent px (before depth scaling). */
  size: number;
  phase: number;
  /** A small fraction of particles carry champagne warmth instead of cyan. */
  warm: boolean;
}

/** Deterministic RNG so the field is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeParticles(): Particle[] {
  const rand = mulberry32(0x9e3779b9);
  const particles: Particle[] = [];
  PLANES.forEach((plane) => {
    for (let i = 0; i < plane.count; i += 1) {
      particles.push({
        z: plane.z + (rand() - 0.5) * 0.12,
        angle: rand() * Math.PI * 2,
        radius: 0.5 + rand() * 0.5,
        offset: rand() * 2 - 1,
        speedFactor: 0.6 + rand() * 0.8,
        size: 0.8 + rand() * 1.7,
        phase: rand() * Math.PI * 2,
        warm: rand() < 0.18,
      });
    }
  });
  // Back-to-front so painter's order reads as depth.
  return particles.sort((a, b) => a.z - b.z);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easeConfig(current: PresenceConfig, target: PresenceConfig, t: number): PresenceConfig {
  return {
    orbit: lerp(current.orbit, target.orbit, t),
    spread: lerp(current.spread, target.spread, t),
    speed: lerp(current.speed, target.speed, t),
    coreScale: lerp(current.coreScale, target.coreScale, t),
    coreEnergy: lerp(current.coreEnergy, target.coreEnergy, t),
    particleAlpha: lerp(current.particleAlpha, target.particleAlpha, t),
    connections: lerp(current.connections, target.connections, t),
    inward: lerp(current.inward, target.inward, t),
    disperse: lerp(current.disperse, target.disperse, t),
    audioReactive: target.audioReactive,
  };
}

export function NovaPresence({
  state,
  levelRef,
  shouldMove,
  size,
  label,
  className,
}: {
  state: NovaState;
  /** Spoken-audio amplitude 0–1, read per frame while `state` is `speaking`. */
  levelRef?: React.RefObject<number>;
  /** Resolved once at the provider; false disables the animation entirely. */
  shouldMove: boolean;
  /** Fixed square size in px. Omit to fill the container (parent sets the box). */
  size?: number;
  /**
   * Accessible name. Defaults to the state label; pass `''` to hide it from
   * assistive tech when a status line beside it already carries the state.
   */
  label?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<NovaState>(state);
  const moveRef = useRef<boolean>(shouldMove);
  const configRef = useRef<PresenceConfig>({ ...resolvePresenceConfig(state) });
  const particlesRef = useRef<Particle[]>(makeParticles());
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const smoothLevelRef = useRef<number>(0);
  /** Pointer offset from centre, −1..1, and its eased value. */
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerEasedRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    stateRef.current = state;
    moveRef.current = shouldMove;
  }, [state, shouldMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            resize();
            if (!moveRef.current) drawFrame(0);
          })
        : null;
    observer?.observe(canvas);

    // ── Drawing helpers ─────────────────────────────────────────────────────

    function drawParticle(
      p: Particle,
      cx: number,
      cy: number,
      maxR: number,
      config: PresenceConfig,
      timeSec: number,
      lvl: number,
      pointer: { x: number; y: number },
    ) {
      if (!ctx) return;
      const depth = p.z;
      const parX = pointer.x * PARALLAX * maxR * depth;
      const parY = pointer.y * PARALLAX * maxR * depth;

      const pushed = Math.min(1.08, p.radius + lvl * 0.05);
      const x = cx + Math.cos(p.angle) * pushed * maxR + parX;
      const y = cy + Math.sin(p.angle) * pushed * maxR + parY;

      const twinkle = 0.72 + 0.28 * Math.sin(timeSec * 1.4 + p.phase);
      const alpha =
        config.particleAlpha * twinkle * (0.35 + depth * 0.65) * (1 - config.disperse * 0.4);
      const rgb = p.warm ? COLOR.gold : COLOR.turquoise;
      const r = p.size * (0.5 + depth) * (1 + lvl * 0.25);

      // While gathering, a short streak toward the core reads as travel.
      if (config.inward > 0.2 && depth > 0.4) {
        const tailR = Math.min(1, pushed + 0.16);
        const tx = cx + Math.cos(p.angle) * tailR * maxR + parX;
        const ty = cy + Math.sin(p.angle) * tailR * maxR + parY;
        ctx.strokeStyle = `rgba(${COLOR.cyan}, ${alpha * 0.35 * config.inward})`;
        ctx.lineWidth = r * 0.7;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      if (depth < 0.45) {
        // Back plane: soft, out-of-focus blobs → depth of field.
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
        g.addColorStop(0, `rgba(${rgb}, ${alpha * 0.8})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Front/mid: crisp core with a small glow.
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (depth > 0.7) {
          ctx.fillStyle = `rgba(${COLOR.hot}, ${alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function facetPath(
      cx: number,
      cy: number,
      radius: number,
      verts: number,
      rotation: number,
      seed: number,
      deform: number,
    ) {
      if (!ctx) return;
      const rand = mulberry32(seed);
      ctx.beginPath();
      for (let i = 0; i <= verts; i += 1) {
        const t = (i / verts) * Math.PI * 2 + rotation;
        const rr = radius * (0.78 + rand() * 0.36 + Math.sin(t * 3 + rotation) * deform);
        const px = cx + Math.cos(t) * rr;
        const py = cy + Math.sin(t) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function drawCore(
      cx: number,
      cy: number,
      maxR: number,
      config: PresenceConfig,
      timeSec: number,
      lvl: number,
      pointer: { x: number; y: number },
    ) {
      if (!ctx) return;
      const e = config.coreEnergy;
      const breathe = moveRef.current ? Math.sin(timeSec * 0.9) * 0.02 : 0;
      const coreR = maxR * 0.28 * config.coreScale * (1 + breathe + lvl * 0.14);
      const rot = timeSec * 0.1;

      // Hot spot drifts, and leans toward the pointer — the body noticing you.
      const hotX = cx + (Math.cos(timeSec * 0.4) * 0.24 + pointer.x * 0.12) * coreR;
      const hotY = cy + (Math.sin(timeSec * 0.4) * 0.24 + pointer.y * 0.12) * coreR;

      // 1. Additive halo — restrained bloom.
      ctx.globalCompositeOperation = 'lighter';
      const haloR = coreR * (2.4 + lvl * 0.5);
      const halo = ctx.createRadialGradient(cx, cy, coreR * 0.3, cx, cy, haloR);
      const haloA = 0.1 * e + lvl * 0.08;
      halo.addColorStop(0, `rgba(${COLOR.champagne}, ${haloA})`);
      halo.addColorStop(0.45, `rgba(${COLOR.turquoise}, ${haloA * 0.5})`);
      halo.addColorStop(1, `rgba(${COLOR.cyan}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Translucent crystalline shell — overlapping facets, different spins.
      ctx.globalCompositeOperation = 'source-over';
      const deform = 0.03 + lvl * 0.04;
      const shells = [
        { r: coreR * 1.34, v: 9, rot: rot * 0.7, seed: 0x51ed270b, a: 0.06 * e },
        { r: coreR * 1.16, v: 8, rot: -rot * 1.1 + 1.2, seed: 0x1b873593, a: 0.09 * e },
      ];
      for (const s of shells) {
        facetPath(cx, cy, s.r, s.v, s.rot, s.seed, deform);
        const sg = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, s.r);
        sg.addColorStop(0, `rgba(${COLOR.turquoise}, ${s.a * 1.4})`);
        sg.addColorStop(1, `rgba(${COLOR.cyan}, ${s.a * 0.2})`);
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.strokeStyle = `rgba(${COLOR.champagne}, ${0.16 * e})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Molten interior — the forged champagne/gold body.
      facetPath(cx, cy, coreR, 7, rot, 0x9e3779b9, deform);
      const body = ctx.createRadialGradient(hotX, hotY, 0, cx, cy, coreR * 1.15);
      body.addColorStop(0, `rgba(${COLOR.hot}, ${0.92 * e + lvl * 0.08})`);
      body.addColorStop(0.32, `rgba(${COLOR.gold}, ${0.62 * e})`);
      body.addColorStop(0.62, `rgba(${COLOR.champagne}, ${0.4 * e})`);
      body.addColorStop(1, `rgba(${COLOR.turquoise}, ${0.55 * e})`);
      ctx.fillStyle = body;
      ctx.fill();

      // 4. Directional shadow side — dimensionality, not a flat disc.
      const shade = ctx.createRadialGradient(
        cx + coreR * 0.5,
        cy + coreR * 0.55,
        coreR * 0.2,
        cx,
        cy,
        coreR * 1.1,
      );
      shade.addColorStop(0, `rgba(${COLOR.shadow}, ${0.4 * e})`);
      shade.addColorStop(1, `rgba(${COLOR.shadow}, 0)`);
      ctx.fillStyle = shade;
      ctx.fill();

      // 5. Internal refraction highlights — light emerging from within.
      ctx.globalCompositeOperation = 'lighter';
      for (const h of [
        { x: hotX, y: hotY, r: coreR * 0.5, a: 0.5 * e + lvl * 0.15 },
        { x: cx - coreR * 0.35, y: cy - coreR * 0.4, r: coreR * 0.3, a: 0.28 * e },
      ]) {
        const hg = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        hg.addColorStop(0, `rgba(${COLOR.hot}, ${h.a})`);
        hg.addColorStop(1, `rgba(${COLOR.hot}, 0)`);
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Champagne rim light on the lit (upper-left) edge.
      ctx.globalCompositeOperation = 'source-over';
      facetPath(cx, cy, coreR * 1.02, 7, rot, 0x9e3779b9, deform);
      ctx.strokeStyle = `rgba(${COLOR.gold}, ${0.4 * e})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    function draw(config: PresenceConfig, timeSec: number) {
      if (!ctx || width === 0 || height === 0) return;
      const cx = width / 2;
      const cy = height / 2;
      const maxR = (Math.min(width, height) / 2) * 0.92;

      // Smooth the audio level again for organic, non-per-frame response.
      const rawLevel = config.audioReactive ? Math.min(1, Math.max(0, levelRef?.current ?? 0)) : 0;
      smoothLevelRef.current += (rawLevel - smoothLevelRef.current) * LEVEL_EASE;
      const lvl = smoothLevelRef.current;

      // Ease pointer toward its target for smooth parallax.
      const pe = pointerEasedRef.current;
      pe.x += (pointerRef.current.x - pe.x) * 0.08;
      pe.y += (pointerRef.current.y - pe.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // Atmosphere: a single very soft ambient glow. The page provides the black.
      ctx.globalCompositeOperation = 'lighter';
      const amb = ctx.createRadialGradient(cx, cy, maxR * 0.1, cx, cy, maxR * 1.5);
      amb.addColorStop(0, `rgba(${COLOR.cyan}, ${0.05 + lvl * 0.03})`);
      amb.addColorStop(1, `rgba(${COLOR.cyan}, 0)`);
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, width, height);

      const particles = particlesRef.current;

      // Back particles (behind the core).
      for (const p of particles) {
        if (p.z >= 0.45) continue;
        drawParticle(p, cx, cy, maxR, config, timeSec, lvl, pe);
      }

      // Connections between mid particles.
      if (config.connections > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 0.75;
        const mid = particles.filter((p) => p.z >= 0.45);
        for (let i = 0; i < mid.length; i += 3) {
          const a = mid[i]!;
          const b = mid[(i + 3) % mid.length]!;
          const ax = cx + Math.cos(a.angle) * a.radius * maxR + pe.x * PARALLAX * maxR * a.z;
          const ay = cy + Math.sin(a.angle) * a.radius * maxR + pe.y * PARALLAX * maxR * a.z;
          const bx = cx + Math.cos(b.angle) * b.radius * maxR + pe.x * PARALLAX * maxR * b.z;
          const by = cy + Math.sin(b.angle) * b.radius * maxR + pe.y * PARALLAX * maxR * b.z;
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          ctx.strokeStyle = `rgba(${COLOR.turquoise}, ${0.4 * config.connections})`;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(cx + (mx - cx) * 0.82, cy + (my - cy) * 0.82, bx, by);
          ctx.stroke();
        }
      }

      // The core.
      drawCore(cx, cy, maxR, config, timeSec, lvl, pe);

      // Foreground particles (in front of the core → occupied space).
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        if (p.z < 0.45) continue;
        drawParticle(p, cx, cy, maxR, config, timeSec, lvl, pe);
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    function step(config: PresenceConfig, dtSec: number, timeSec: number) {
      const particles = particlesRef.current;
      for (const p of particles) {
        p.angle += dtSec * 0.55 * config.speed * p.speedFactor * (0.6 + p.z * 0.8);
        const target = Math.min(
          1.05,
          Math.max(0.06, config.orbit + config.spread * p.offset + config.disperse * 0.3),
        );
        p.radius = lerp(p.radius, target, 0.06);
      }
      draw(config, timeSec);
    }

    function drawFrame(timeSec: number) {
      const target = resolvePresenceConfig(stateRef.current);
      configRef.current = { ...target };
      for (const p of particlesRef.current) {
        p.radius = Math.min(1.05, Math.max(0.06, target.orbit + target.spread * p.offset));
      }
      draw(configRef.current, timeSec);
    }

    function frame(now: number) {
      const last = lastRef.current || now;
      const dtSec = Math.min(0.05, (now - last) / 1000);
      lastRef.current = now;
      const timeSec = now / 1000;

      const target = resolvePresenceConfig(stateRef.current);
      configRef.current = easeConfig(configRef.current, target, CONFIG_EASE);
      step(configRef.current, dtSec, timeSec);

      rafRef.current = requestAnimationFrame(frame);
    }

    const start = () => {
      if (rafRef.current !== null) return;
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(frame);
    };
    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else if (moveRef.current) start();
    };

    if (shouldMove) {
      document.addEventListener('visibilitychange', onVisibility);
      if (!document.hidden) start();
    } else {
      drawFrame(0);
    }

    return () => {
      stopLoop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [shouldMove, levelRef]);

  // Pointer parallax (a micro-interaction, not a control). Updates a ref only;
  // the loop reads it. No effect under reduced motion, where the loop is off.
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!shouldMove) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
    };
  };
  const onPointerLeave = () => {
    pointerRef.current = { x: 0, y: 0 };
  };

  const accessibleName = label === undefined ? novaStateLabel(state) : label;

  return (
    <div
      className={cn('relative', className)}
      style={size ? { width: size, height: size } : undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      {...(accessibleName
        ? { role: 'img', 'aria-label': accessibleName }
        : { 'aria-hidden': true })}
      data-nova-state={state}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
