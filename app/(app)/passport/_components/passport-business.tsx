import type { BusinessPassport } from '@/services/passport';
import { PassportSectionHead } from './passport-field';
import { PassportPage } from './passport-page';

/**
 * Page 03 — what the business does, set as numbered document sections
 * rather than as fields, because these are prose entries of varying length
 * and a two-column field grid would break their reading.
 *
 * `passport.definition`, verbatim, in the contract's own grouping.
 */
export function PassportBusiness({
  passport,
  totalPages,
  reference,
}: {
  passport: BusinessPassport;
  totalPages: number;
  reference: string;
}) {
  const { definition } = passport;

  const sections: { label: string; value: string | null }[] = [
    { label: 'Activities', value: definition.activities },
    { label: 'Products & services', value: definition.productsServices },
    { label: 'Target customers', value: definition.targetCustomers },
    { label: 'Location', value: definition.location },
    {
      label: 'Employees',
      value:
        definition.employeeCount === null
          ? null
          : definition.employeeCount === 1
            ? 'Just you'
            : `${definition.employeeCount} people`,
    },
    { label: 'Founder goals', value: definition.founderGoals },
  ];

  return (
    <PassportPage
      title="Business"
      subtitle="What the business does"
      pageNumber={3}
      totalPages={totalPages}
      reference={reference}
    >
      <div className="flex flex-col gap-4">
        {sections.map((section, i) => {
          const has = typeof section.value === 'string' && section.value.trim().length > 0;
          return (
            <section key={section.label}>
              <PassportSectionHead index={i + 1} label={section.label} />
              <p
                className={
                  has
                    ? 'text-passport-ink mt-2 text-[0.8125rem] leading-relaxed text-pretty'
                    : 'text-passport-ink-muted/80 mt-2 text-[0.8125rem] leading-relaxed italic'
                }
              >
                {has ? section.value : '— not recorded'}
              </p>
            </section>
          );
        })}
      </div>
    </PassportPage>
  );
}
