/** Page title block for admin sections, with the data-freshness timestamp. */
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const loadedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-foreground-muted max-w-3xl text-sm text-pretty">{description}</p>
        ) : null}
        <p className="text-foreground-subtle text-xs">Data loaded {loadedAt} UTC.</p>
      </div>
      {children}
    </header>
  );
}
