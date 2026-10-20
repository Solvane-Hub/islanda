/**
 * Several answers to one multi-select question, as small chips, with the
 * respondent's own "Other" wording underneath. Answers saved before the
 * questionnaire became multi-select arrive as a one-item list and look the same.
 */
export function SelectionList({
  values,
  label,
  other,
  empty = 'Not answered',
}: {
  values: readonly string[];
  label: (value: never) => string;
  other?: string | null | undefined;
  empty?: string;
}) {
  if (values.length === 0) return <span className="text-foreground-subtle">{empty}</span>;
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-wrap gap-1.5" aria-label={`${values.length} selected`}>
        {values.map((value) => (
          <li
            key={value}
            className="text-foreground rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-xs"
          >
            {label(value as never)}
          </li>
        ))}
      </ul>
      {other ? (
        <span className="text-foreground-muted text-xs text-pretty">&ldquo;{other}&rdquo;</span>
      ) : null}
    </div>
  );
}
