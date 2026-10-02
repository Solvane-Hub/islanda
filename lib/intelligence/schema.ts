import { z } from 'zod';
import {
  EPISTEMIC_TYPES,
  INTELLIGENCE_CATEGORIES,
  type EpistemicType,
  type IntelligenceCategory,
} from '@/lib/intelligence/types';

/**
 * The structured-response contract. Every LLM response is parsed against this
 * BEFORE it can reach the UI — the LLM returns structured intelligence, never
 * markup. Recommendations may only be RECOMMENDATION/INFERENCE (never a fact
 * type), and evidence references are shape-checked here and id-checked by the
 * validator against the evidence actually supplied.
 */

const categoryEnum = z.enum(
  INTELLIGENCE_CATEGORIES as unknown as [IntelligenceCategory, ...IntelligenceCategory[]],
);
const epistemicEnum = z.enum(EPISTEMIC_TYPES as unknown as [EpistemicType, ...EpistemicType[]]);

export const evidenceRefSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(60),
  source: z.string().min(1).max(200),
  provenance: epistemicEnum,
});

export const intelligenceResponseSchema = z.object({
  answer: z.string().min(1).max(8000),
  category: categoryEnum,
  confidence: z.enum(['low', 'medium', 'high']),
  recommendations: z
    .array(
      z.object({
        text: z.string().min(1).max(1000),
        // A recommendation is never a fact.
        basis: z.enum(['RECOMMENDATION', 'INFERENCE']),
      }),
    )
    .max(10)
    .default([]),
  evidence: z.array(evidenceRefSchema).max(50).default([]),
  followUps: z.array(z.string().min(1).max(300)).max(6).default([]),
  unknowns: z.array(z.string().min(1).max(500)).max(20).default([]),
});
