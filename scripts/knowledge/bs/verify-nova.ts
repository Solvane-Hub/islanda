import { createAdminClient } from '@/lib/supabase/admin';
import { answerNovaQuestion } from '@/services/nova/answer';
import { manifestForJurisdiction } from '@/services/knowledge/manifests/registry';
import type { NovaAnswerRequest } from '@/services/nova/answer';

/**
 * End-to-end Nova verification against the PUBLISHED Bahamas pack.
 *
 * Runs the real retrieval + extractive reasoning + citation grounding pipeline
 * for a Bahamas business and prints, per question: the outcome, the cited
 * instrument + provision for each claim, and any legal-status / not-in-force
 * notice. Read-only — it asks questions, it writes nothing.
 *
 * Usage:  BS_VERIFY=1 tsx --env-file=.env.local scripts/knowledge/bs/verify-nova.ts
 */

const BS_CONTEXT = {
  businessId: 'demo',
  retrieval: { countryCode: 'BS', industry: 'food_service' as string | null },
};

const QUESTIONS: { label: string; q: string; topK?: number }[] = [
  {
    label: '1. Current VAT (registration threshold)',
    q: 'What is the VAT registration threshold for my business?',
  },
  {
    label: '2. Amendment-dependent (exempt food supplies)',
    q: 'Are unprepared food items exempt from VAT?',
  },
  {
    label: '3. Legal status / commencement (data protection)',
    q: 'What are my data protection obligations as a data controller?',
  },
  {
    label: '4. Show supporting evidence (registration)',
    q: 'When must I register my business for VAT?',
  },
  {
    label: '5. Refusal path (outside published evidence)',
    q: 'What are the parking regulations for downtown Nassau?',
  },
];

async function main(): Promise<void> {
  if (process.env.BS_VERIFY !== '1') throw new Error('Set BS_VERIFY=1 to run.');
  const db = createAdminClient();
  if (!db) throw new Error('No admin client (service role key missing).');

  const manifest = manifestForJurisdiction('BS') ?? undefined;
  console.log(`\nBS manifest registered: ${manifest ? 'yes' : 'NO'}\n`);

  for (const { label, q, topK } of QUESTIONS) {
    const request: NovaAnswerRequest = {
      context: BS_CONTEXT,
      queryRepresentation: q,
      question: q,
      ...(topK ? { topK } : {}),
      ...(manifest ? { manifest } : {}),
    };
    const answer = await answerNovaQuestion(db, request);

    console.log('────────────────────────────────────────────────────────');
    console.log(label);
    console.log(`  Q: ${q}`);
    console.log(`  outcome: ${answer.outcome}  ·  pack: ${answer.knowledgeVersion ?? '—'}`);

    for (const claim of answer.citations) {
      for (const c of claim.citations) {
        console.log(
          `  cite: ${c.document ?? c.agency ?? '?'} — ${c.section ?? c.clause ?? 'n/a'} ` +
            `[chunk ${c.chunk_id.slice(0, 10)}…]`,
        );
      }
    }
    for (const n of answer.amendmentNotices) {
      console.log(
        `  amendment: ${n.provision} of ${n.baseInstrumentTitle} affected by ` +
          `${n.amendments.map((a) => a.actNumber ?? a.title).join(', ')} ` +
          `(current applicability established: ${n.currentApplicabilityEstablished})`,
      );
    }
    for (const m of answer.notInForceNotices) {
      console.log(`  not-in-force: ${m.title} (${m.legalStatus}) — excluded from current law`);
    }
    if (answer.outcome !== 'answered') {
      for (const u of answer.unresolved.slice(0, 2)) console.log(`  unresolved: ${u.question}`);
    }
  }
  console.log('────────────────────────────────────────────────────────\n');
}

main().catch((e: unknown) => {
  console.error('verify-nova failed:', e);
  process.exitCode = 1;
});
