import type { BusinessIdentifier, BusinessObject } from '@/types/business';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import { cn } from '@/lib/utils/cn';
import { ProvenanceBadge, type ProvenanceKind } from '@/components/ui/provenance-badge';

/**
 * The business command centre — "Here's what I know about your business".
 *
 * The Business Object made legible: identity, definition and records, each fact
 * carrying its provenance so the founder always sees where a value came from and
 * whether it is verified. Absent facts are shown as "Not yet established" rather
 * than hidden — the honest version of an incomplete profile.
 *
 * Sensitive identifiers are masked to their last characters: enough to confirm
 * FoundryAI holds the right record without splashing a tax id across the page.
 */

const IDENTIFIER_LABELS: Record<BusinessIdentifier['identifier_type'], string> = {
  company_registration_number: 'Company registration number',
  business_licence_number: 'Business licence number',
  tax_identification_number: 'Tax identification number',
  vat_registration_number: 'VAT registration number',
  nib_employer_number: 'NIB employer number',
  other: 'Other identifier',
};

function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '••••';
  return `•••• ${trimmed.slice(-4)}`;
}

/** A founder-entered identifier can only be unverified or verification-unavailable. */
function identifierProvenance(id: BusinessIdentifier): ProvenanceKind {
  if (id.verification_state === 'verified') return 'evidence_verified';
  if (id.verification_state === 'verification_unavailable') return 'verification_unavailable';
  return id.provenance === 'founder_provided' ? 'founder_unverified' : 'founder_provided';
}

interface Fact {
  label: string;
  value: string | null | undefined;
  /** Provenance when the value IS present. Absent values always read as not-established. */
  provenance: ProvenanceKind;
}

function FactList({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
      {facts.map((fact) => {
        const has = typeof fact.value === 'string' && fact.value.trim().length > 0;
        return (
          <div key={fact.label} className="flex min-w-0 flex-col gap-1.5">
            <dt className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
              {fact.label}
            </dt>
            <dd className="flex min-w-0 flex-col items-start gap-2">
              <span
                className={cn(
                  'min-w-0 text-base font-medium tracking-[-0.01em] text-pretty',
                  has ? 'text-on-ink' : 'text-on-glass-subtle italic',
                )}
              >
                {has ? fact.value : 'Not recorded yet'}
              </span>
              <ProvenanceBadge kind={has ? fact.provenance : 'not_established'} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-2xs text-champagne font-medium tracking-[0.16em] uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function BusinessCommandCenter({
  object,
  countryName,
  className,
}: {
  object: BusinessObject;
  countryName: string;
  className?: string;
}) {
  const { business, profile, identifiers } = object;

  const stageLabel = profile?.business_stage
    ? (BUSINESS_STAGE_LABELS[profile.business_stage as BusinessStage] ?? profile.business_stage)
    : null;

  const identity: Fact[] = [
    { label: 'Legal name', value: business.legal_name, provenance: 'founder_provided' },
    { label: 'Trading name', value: business.trading_name, provenance: 'founder_provided' },
    { label: 'Business type', value: business.business_type, provenance: 'founder_provided' },
    // Jurisdiction is set explicitly at creation and is the one fact the platform
    // treats as authoritative for retrieval — but it is still founder-declared.
    { label: 'Jurisdiction', value: countryName, provenance: 'founder_provided' },
  ];

  const definition: Fact[] = [
    { label: 'Industry', value: business.industry, provenance: 'founder_provided' },
    {
      label: 'Business activities',
      value: profile?.business_activities,
      provenance: 'founder_provided',
    },
    {
      label: 'Products & services',
      value: profile?.products_services,
      provenance: 'founder_provided',
    },
    { label: 'Target customers', value: profile?.target_customers, provenance: 'founder_provided' },
    { label: 'Location', value: profile?.location, provenance: 'founder_provided' },
    { label: 'Stage', value: stageLabel, provenance: 'founder_provided' },
    { label: 'Operating status', value: profile?.operating_status, provenance: 'founder_provided' },
  ];

  return (
    <div className={cn('flex flex-col gap-9', className)}>
      <Section title="Identity">
        <FactList facts={identity} />
      </Section>

      <Section title="What the business does">
        <FactList facts={definition} />
      </Section>

      <Section title="Records">
        {identifiers.length === 0 ? (
          <p className="text-on-ink-muted text-sm">
            No registration or tax identifiers on file yet. You can add them at any time — FoundryAI
            keeps them private to your business and does not treat anything as verified until an
            official check is possible.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {identifiers.map((id) => (
              <li
                key={id.id}
                className="border-border-control bg-surface flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-on-ink text-sm font-medium">
                    {IDENTIFIER_LABELS[id.identifier_type]}
                  </span>
                  <span className="text-on-ink-muted font-mono text-sm tracking-wider">
                    {maskIdentifier(id.value)}
                  </span>
                </div>
                <ProvenanceBadge kind={identifierProvenance(id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
