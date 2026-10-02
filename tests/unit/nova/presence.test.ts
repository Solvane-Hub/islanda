import { describe, expect, it } from 'vitest';
import { PRESENCE_CONFIG, resolvePresenceConfig } from '@/lib/nova/presence';
import type { NovaState } from '@/components/ui/nova-mark';

/**
 * Nova's physical behaviour, per state.
 *
 * The canvas is untestable in jsdom, but the DECISIONS it renders are just data.
 * These assertions pin the meaningful contract of the state machine — that each
 * state behaves distinctly and in the direction the concept demands:
 *
 *     FRAGMENTATION → CONNECTION → CONVERGENCE → CLARITY
 */

const ALL_STATES: NovaState[] = [
  'idle',
  'listening',
  'searching',
  'evaluating',
  'connecting',
  'composing',
  'speaking',
  'ready',
  'limited',
  'refused',
];

describe('presence configuration — every state is covered', () => {
  it('has an entry for every Nova state', () => {
    for (const state of ALL_STATES) {
      expect(resolvePresenceConfig(state), state).toBeDefined();
    }
  });

  it('normalises every fraction into 0–1', () => {
    for (const state of ALL_STATES) {
      const c = PRESENCE_CONFIG[state];
      for (const key of [
        'orbit',
        'coreEnergy',
        'particleAlpha',
        'connections',
        'disperse',
      ] as const) {
        expect(c[key], `${state}.${key}`).toBeGreaterThanOrEqual(0);
        expect(c[key], `${state}.${key}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('presence configuration — the states behave as the concept demands', () => {
  it('gathers inward while searching', () => {
    // Particles stream toward the core, tighter than at rest.
    expect(PRESENCE_CONFIG.searching.inward).toBeGreaterThan(0.6);
    expect(PRESENCE_CONFIG.searching.orbit).toBeLessThan(PRESENCE_CONFIG.idle.orbit);
  });

  it('draws connections strongest in the connecting state', () => {
    expect(PRESENCE_CONFIG.connecting.connections).toBeGreaterThan(
      PRESENCE_CONFIG.searching.connections,
    );
    expect(PRESENCE_CONFIG.connecting.connections).toBeGreaterThan(0.7);
  });

  it('reacts to audio only while speaking', () => {
    expect(PRESENCE_CONFIG.speaking.audioReactive).toBe(true);
    for (const state of ALL_STATES.filter((s) => s !== 'speaking')) {
      expect(PRESENCE_CONFIG[state].audioReactive, state).toBe(false);
    }
  });

  it('is calm and converged when ready', () => {
    // Slow, resolved, not dispersed.
    expect(PRESENCE_CONFIG.ready.speed).toBeLessThan(PRESENCE_CONFIG.searching.speed);
    expect(PRESENCE_CONFIG.ready.disperse).toBe(0);
    expect(PRESENCE_CONFIG.ready.coreEnergy).toBeGreaterThan(0.5);
  });

  it('disperses and dims for no-evidence — uncertainty, not failure', () => {
    const refused = PRESENCE_CONFIG.refused;
    expect(refused.disperse).toBeGreaterThan(0.6);
    expect(refused.particleAlpha).toBeLessThan(PRESENCE_CONFIG.ready.particleAlpha);
    expect(refused.coreEnergy).toBeLessThan(PRESENCE_CONFIG.ready.coreEnergy);
    // Still present — never zero. Quieter, not gone.
    expect(refused.coreEnergy).toBeGreaterThan(0);
    expect(refused.connections).toBe(0);
  });
});
