import { Logo } from '@/components/brand/logo-mark';

/** The narrow card used by the admin sign-in, MFA and password pages. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <span className="text-on-ink inline-flex w-fit">
          <Logo height={24} />
        </span>
        <h1 className="text-on-ink text-[1.75rem] font-semibold tracking-[-0.02em]">{title}</h1>
        {description ? (
          <div className="text-foreground-muted text-sm text-pretty">{description}</div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
