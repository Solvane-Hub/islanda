'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import {
  getWaitlistSurveyAction,
  submitWaitlistSurveyAction,
  type SubmitWaitlistSurveyResult,
} from '@/app/waitlist-actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard } from '@/components/ui/choice';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Result } from '@/lib/errors';
import { track } from '@/lib/analytics/client';
import { COUNTRY_SUGGESTIONS } from '@/lib/waitlist/countries';
import {
  BUSINESS_JOURNEY_OPTIONS,
  BUSINESS_STAGE_OPTIONS,
  CHALLENGE_OPTIONS,
  EARLY_ACCESS_QUESTION_OPTIONS,
  FEEDBACK_INTEREST_OPTIONS,
  INDUSTRY_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  SURVEY_LIMITS,
} from '@/lib/waitlist/options';

/**
 * The optional questionnaire shown after a successful waitlist signup.
 *
 * Four short sections. "Continue" saves the section just answered, so partial
 * answers are kept even if the visitor leaves halfway; "Back" changes nothing;
 * "Skip for Now" leaves whatever was already saved and writes nothing more.
 * Every question may be left blank. The signup already succeeded and stays
 * that way whatever happens here.
 *
 * Answers are written to the visitor's existing signup through the token
 * issued at signup — this form has no way to create a second signup, and the
 * token reaches only this one signup's questionnaire answers.
 *
 * All sections stay mounted (inactive ones are `hidden`) so moving back and
 * forth never loses an answer; each save sends only its own section's fields.
 */

type Answers = Awaited<ReturnType<typeof getWaitlistSurveyAction>>;

const SECTIONS = [
  {
    title: 'About your business',
    fields: [
      'country',
      'cityIsland',
      'businessName',
      'businessJourney',
      'industry',
      'industryOther',
    ],
  },
  {
    title: 'What do you want Islanda to help you do?',
    fields: ['primaryGoal', 'goalOther', 'biggestChallenge', 'challengeOther', 'businessStage'],
  },
  { title: 'Early testing', fields: ['testingInterest', 'feedbackInterest'] },
  { title: 'Anything else?', fields: ['additionalInfo'] },
] as const;

export function WaitlistSurvey({
  token,
  resuming,
  onFinished,
}: {
  token: string;
  /** True when returning to update earlier answers: they are loaded and pre-filled. */
  resuming: boolean;
  onFinished: (outcome: 'answered' | 'skipped') => void;
}) {
  const [loaded, setLoaded] = useState<Answers | undefined>(resuming ? undefined : null);

  useEffect(() => {
    if (!resuming) return;
    let cancelled = false;
    getWaitlistSurveyAction(token).then(
      (answers) => !cancelled && setLoaded(answers),
      () => !cancelled && setLoaded(null),
    );
    return () => {
      cancelled = true;
    };
  }, [resuming, token]);

  if (loaded === undefined) {
    return (
      <p role="status" className="text-on-ink-muted text-sm">
        Loading your answers…
      </p>
    );
  }

  return <SurveyForm token={token} initial={loaded} onFinished={onFinished} />;
}

function SurveyForm({
  token,
  initial,
  onFinished,
}: {
  token: string;
  initial: Answers;
  onFinished: (outcome: 'answered' | 'skipped') => void;
}) {
  const [section, setSection] = useState(0);
  const [savedAny, setSavedAny] = useState(Boolean(initial));
  const [industry, setIndustry] = useState<string>(initial?.industry ?? '');
  const [goal, setGoal] = useState<string>(initial?.primaryGoal ?? '');
  const [challenge, setChallenge] = useState<string>(initial?.biggestChallenge ?? '');
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const last = section === SECTIONS.length - 1;

  const [state, action, pending] = useActionState<
    Result<SubmitWaitlistSurveyResult> | null,
    FormData
  >(async (previous, formData) => {
    const result = await submitWaitlistSurveyAction(previous, formData);
    if (result.ok) {
      const saved = result.data.status === 'saved';
      // Updates after an await join the action’s transition only when wrapped,
      // so the next section appears in the same commit that ends "pending" —
      // never with its buttons still busy.
      startTransition(() => {
        if (saved) setSavedAny(true);
        if (formData.get('final') === 'true') {
          onFinished(saved || savedAny ? 'answered' : 'skipped');
        } else {
          setSection((current) => Math.min(current + 1, SECTIONS.length - 1));
        }
      });
    }
    return result;
  }, null);

  useEffect(() => {
    track('waitlist_survey_section_viewed', { section: section + 1 });
    if (section > 0) headingRef.current?.focus();
  }, [section]);

  const failure = state && !state.ok ? state : null;
  const fieldError = (name: string) => failure?.fieldErrors?.[name]?.[0];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('fields', SECTIONS[section]!.fields.join(','));
    formData.set('final', last ? 'true' : 'false');
    formData.set('section', String(section + 1));
    startTransition(() => action(formData));
  }

  function noteStarted() {
    if (started.current) return;
    started.current = true;
    track('waitlist_survey_started');
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="workspace-env flex w-full flex-col gap-6 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-6 text-left sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <p className="text-on-ink-muted text-xs font-medium tracking-wide uppercase">
          Optional · Section {section + 1} of {SECTIONS.length}
        </p>
        <h3
          id={`${id}-heading`}
          ref={headingRef}
          tabIndex={-1}
          className="text-on-ink text-lg font-semibold text-balance outline-none"
        >
          {SECTIONS[section]!.title}
        </h3>
        {section === 0 ? (
          <p className="text-on-ink-muted text-sm text-pretty">
            A few questions to help us understand what you need. Every question is optional, and you
            can skip at any time — you&apos;re already on the waitlist.
          </p>
        ) : null}
        <div
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuemin={1}
          aria-valuemax={SECTIONS.length}
          aria-valuenow={section + 1}
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="bg-bahama-turquoise h-full rounded-full transition-[width] duration-300"
            style={{ width: `${((section + 1) / SECTIONS.length) * 100}%` }}
          />
        </div>
      </header>

      <form onSubmit={submit} onChange={noteStarted} className="flex flex-col gap-7" noValidate>
        <input type="hidden" name="token" value={token} />

        {/* ── A — About your business ── */}
        <div hidden={section !== 0} className="flex flex-col gap-7">
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="text-on-ink mb-3 text-base font-medium">Where are you based?</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id={`${id}-country`} label="Country" error={fieldError('country')}>
                {(aria) => (
                  <>
                    <Input
                      {...aria}
                      name="country"
                      list={`${id}-countries`}
                      autoComplete="country-name"
                      placeholder="Start typing, e.g. The Bahamas"
                      maxLength={SURVEY_LIMITS.country}
                      defaultValue={initial?.country ?? ''}
                      className="h-11"
                    />
                    <datalist id={`${id}-countries`}>
                      {COUNTRY_SUGGESTIONS.map((country) => (
                        <option key={country} value={country} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field
                id={`${id}-city`}
                label="City, island, or community"
                error={fieldError('cityIsland')}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    name="cityIsland"
                    autoComplete="address-level2"
                    placeholder="e.g. Nassau, Exuma, Bridgetown"
                    maxLength={SURVEY_LIMITS.cityIsland}
                    defaultValue={initial?.cityIsland ?? ''}
                    className="h-11"
                  />
                )}
              </Field>
            </div>
          </fieldset>

          <Field
            id={`${id}-business-name`}
            label="What is your business called?"
            optional
            error={fieldError('businessName')}
          >
            {(aria) => (
              <Input
                {...aria}
                name="businessName"
                autoComplete="organization"
                maxLength={SURVEY_LIMITS.businessName}
                defaultValue={initial?.businessName ?? ''}
                className="h-11"
              />
            )}
          </Field>

          <Question
            legend="Where are you in your business journey?"
            error={fieldError('businessJourney')}
          >
            {BUSINESS_JOURNEY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="businessJourney"
                value={option.value}
                label={option.label}
                defaultChecked={initial?.businessJourney === option.value}
              />
            ))}
          </Question>

          <div className="flex flex-col gap-3">
            <Field
              id={`${id}-industry`}
              label="What industry is your business in?"
              error={fieldError('industry')}
            >
              {(aria) => (
                <Select
                  {...aria}
                  name="industry"
                  defaultValue={initial?.industry ?? ''}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="h-11"
                >
                  <option value="">Choose an industry (optional)</option>
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {industry === 'other' ? (
              <Field
                id={`${id}-industry-other`}
                label="Your industry"
                optional
                error={fieldError('industryOther')}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    name="industryOther"
                    maxLength={SURVEY_LIMITS.industryOther}
                    defaultValue={initial?.industryOther ?? ''}
                    className="h-11"
                  />
                )}
              </Field>
            ) : null}
          </div>
        </div>

        {/* ── B — What do you want Islanda to help you do? ── */}
        <div hidden={section !== 1} className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <Question
              legend="What would you most like Islanda to help you with?"
              error={fieldError('primaryGoal')}
              onChange={setGoal}
            >
              {PRIMARY_GOAL_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  name="primaryGoal"
                  value={option.value}
                  label={option.label}
                  defaultChecked={initial?.primaryGoal === option.value}
                />
              ))}
            </Question>
            {goal === 'other' ? (
              <Field
                id={`${id}-goal-other`}
                label="What would you like help with?"
                optional
                error={fieldError('goalOther')}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    name="goalOther"
                    maxLength={SURVEY_LIMITS.goalOther}
                    defaultValue={initial?.goalOther ?? ''}
                    className="h-11"
                  />
                )}
              </Field>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <Question
              legend="What is the biggest challenge you're facing with your business right now?"
              error={fieldError('biggestChallenge')}
              onChange={setChallenge}
            >
              {CHALLENGE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  name="biggestChallenge"
                  value={option.value}
                  label={option.label}
                  defaultChecked={initial?.biggestChallenge === option.value}
                />
              ))}
            </Question>
            {challenge === 'other' ? (
              <Field
                id={`${id}-challenge-other`}
                label="Tell us about your challenge"
                optional
                error={fieldError('challengeOther')}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    name="challengeOther"
                    maxLength={SURVEY_LIMITS.challengeOther}
                    defaultValue={initial?.challengeOther ?? ''}
                    className="h-11"
                  />
                )}
              </Field>
            ) : null}
          </div>

          <Question
            legend="Which stage best describes your business?"
            error={fieldError('businessStage')}
          >
            {BUSINESS_STAGE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="businessStage"
                value={option.value}
                label={option.label}
                defaultChecked={initial?.businessStage === option.value}
              />
            ))}
          </Question>
        </div>

        {/* ── C — Early testing ── */}
        <div hidden={section !== 2} className="flex flex-col gap-7">
          <Question
            legend="Would you be interested in trying Islanda before its public launch?"
            columns={3}
            error={fieldError('testingInterest')}
          >
            {EARLY_ACCESS_QUESTION_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="testingInterest"
                value={option.value}
                label={option.label}
                defaultChecked={initial?.testingInterest === option.value}
              />
            ))}
          </Question>
          <Question
            legend="Would you be willing to share feedback to help improve Islanda?"
            columns={3}
            error={fieldError('feedbackInterest')}
          >
            {FEEDBACK_INTEREST_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="feedbackInterest"
                value={option.value}
                label={option.label}
                defaultChecked={initial?.feedbackInterest === option.value}
              />
            ))}
          </Question>
          <p className="text-on-ink-muted text-xs text-pretty">
            These answers only tell us you might be interested. We will ask before involving you in
            any testing, and we never use them for marketing or public testimonials.
          </p>
        </div>

        {/* ── D — Anything else? ── */}
        <div hidden={section !== 3} className="flex flex-col gap-3">
          <Field
            id={`${id}-additional`}
            label="Is there anything else you'd like us to know about your business or what you need help with?"
            optional
            description="Please don't include passwords, payment details, or other sensitive personal information."
            error={fieldError('additionalInfo')}
          >
            {(aria) => (
              <Textarea
                {...aria}
                name="additionalInfo"
                rows={5}
                maxLength={SURVEY_LIMITS.additionalInfo}
                defaultValue={initial?.additionalInfo ?? ''}
              />
            )}
          </Field>
        </div>

        {failure && !failure.fieldErrors ? (
          <Alert tone="error">
            <p>{failure.message}</p>
            {failure.code === 'NOT_FOUND' ? null : (
              <p className="mt-1">Your answers are still here, so you can try again.</p>
            )}
          </Alert>
        ) : null}
        {failure?.fieldErrors ? (
          <Alert tone="error">
            <p>{failure.message}</p>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" size="lg" loading={pending} className="sm:flex-1">
            {last ? 'Submit Answers' : 'Continue'}
          </Button>
          {section > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={pending}
              onClick={() => setSection((s) => Math.max(0, s - 1))}
              className="sm:flex-1"
            >
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={pending}
            onClick={() => {
              track('waitlist_survey_skipped', { section: section + 1 });
              onFinished(savedAny ? 'answered' : 'skipped');
            }}
            className="sm:flex-1"
          >
            Skip for Now
          </Button>
        </div>
      </form>
    </section>
  );
}

function Question({
  legend,
  columns = 2,
  error,
  onChange,
  children,
}: {
  legend: string;
  columns?: 2 | 3;
  error?: string | undefined;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  const errorId = useId();
  return (
    <fieldset
      className="flex min-w-0 flex-col"
      aria-describedby={error ? errorId : undefined}
      onChange={
        onChange
          ? (event) => onChange((event.target as unknown as HTMLInputElement).value)
          : undefined
      }
    >
      <legend className="text-on-ink mb-3 text-base font-medium text-pretty">{legend}</legend>
      <div
        className={
          columns === 3
            ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-3'
            : 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
        }
      >
        {children}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-danger mt-2 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
