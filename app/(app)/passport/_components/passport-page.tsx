import { LogoMark } from '@/components/brand/logo-mark';
import { cn } from '@/lib/utils/cn';

/**
 * The construction every interior page is printed onto.
 *
 * A passport page is not a container with content in it — it is a fixed
 * frame (masthead, rules, margins, footer, page number) that the content is
 * set INTO. Centralising that frame here is what makes Identity, Business,
 * State and Records read as pages of one document instead of four screens
 * that happen to share a colour: identical margins, identical masthead,
 * identical footer, identical rules, every time.
 *
 * The watermark and gutter layers are `aria-hidden` and `pointer-events-none`
 * overlays rather than backgrounds on the page element itself, so the page's
 * own scrolling content never slides the security printing with it.
 */
export function PassportPage({
  title,
  subtitle,
  pageNumber,
  totalPages,
  reference,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  pageNumber: number;
  totalPages: number;
  reference: string;
  children: React.ReactNode;
  className?: string;
}) {
  const folio = String(pageNumber).padStart(2, '0');

  return (
    <div className={cn('passport-paper-material relative flex h-full flex-col', className)}>
      <div aria-hidden="true" className="passport-watermark pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="passport-gutter-inner-left pointer-events-none absolute inset-y-0 left-0 w-24"
      />

      {/* Masthead — the same three marks on every page: issuer, document,
          folio. This is what a reader uses to know they are still inside the
          same record. */}
      <header className="relative flex items-start justify-between gap-4 px-6 pt-5 sm:px-8">
        <span className="flex items-center gap-1.5">
          <LogoMark height={11} />
          <span className="text-passport-ink text-3xs font-semibold tracking-[0.24em] uppercase">
            Islanda
          </span>
        </span>
        <span className="text-right">
          <span className="text-passport-ink text-3xs block font-semibold tracking-[0.2em] uppercase">
            Business Passport
          </span>
          <span className="text-passport-ink-muted text-3xs mt-0.5 block font-mono tracking-[0.14em]">
            PAGE {folio} / {String(totalPages).padStart(2, '0')}
          </span>
        </span>
      </header>

      {/* Double rule — a thick/thin pair, the oldest trick in document
          printing for separating masthead from body. */}
      <div aria-hidden="true" className="relative mt-3 px-6 sm:px-8">
        <div className="bg-passport-ink/45 h-px w-full" />
        <div className="bg-passport-line/70 mt-[2px] h-px w-full" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pt-5 sm:px-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-passport-ink text-lg leading-none font-semibold tracking-[0.02em] uppercase sm:text-xl">
              {title}
            </h2>
            <p className="text-passport-accent text-3xs mt-1.5 font-medium tracking-[0.18em] uppercase">
              {subtitle}
            </p>
          </div>
          <span className="text-passport-ink-muted text-3xs shrink-0 font-mono tracking-[0.1em]">
            {reference}
          </span>
        </div>

        <div className="passport-leaf-scroll mt-5 min-h-0 flex-1 overflow-y-auto pb-5">
          {children}
        </div>
      </div>

      {/* Footer — microtext band, issuer line, folio. The microtext is set at
          8px: at reading distance it resolves as a printed texture, which is
          exactly what it is for. */}
      <footer className="relative px-6 pb-4 sm:px-8">
        <div className="bg-passport-line/70 mb-2 h-px w-full" />
        <p
          aria-hidden="true"
          className="text-passport-ink-muted/45 text-4xs mb-1.5 overflow-hidden font-mono text-nowrap select-none"
        >
          {'ISLANDA·BUSINESSPASSPORT·DIGITALBUSINESSRECORD·'.repeat(8)}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-passport-ink-muted text-3xs font-medium tracking-[0.18em] uppercase">
            Islanda · Digital Business Record
          </span>
          <span className="text-passport-ink text-3xs font-mono tracking-[0.12em] tabular-nums">
            {folio} / {String(totalPages).padStart(2, '0')}
          </span>
        </div>
      </footer>
    </div>
  );
}
