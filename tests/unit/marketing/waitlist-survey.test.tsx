import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, fail, ok } from '@/lib/errors';

// The questionnaire renders ~35 controlled checkboxes; under a full parallel run the
// first commit after an action can exceed Testing Library's 1s default wait.
configure({ asyncUtilTimeout: 5000 });

const actions = vi.hoisted(() => ({
  join: vi.fn(),
  survey: vi.fn(),
  read: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/app/waitlist-actions', () => ({
  joinWaitlistAction: actions.join,
  submitWaitlistSurveyAction: actions.survey,
  getWaitlistSurveyAction: actions.read,
}));
vi.mock('@/lib/analytics/client', () => ({ track: actions.track }));

import { WaitlistForm } from '@/components/marketing/waitlist-form';

const TOKEN = 't'.repeat(43);
const STORAGE_KEY = 'islanda.waitlist.survey';

function join() {
  render(<WaitlistForm />);
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.submit(screen.getByRole('button', { name: /join the waitlist/i }).closest('form')!);
}

async function joinAndOpenSurvey() {
  actions.join.mockResolvedValue(ok({ status: 'joined', surveyToken: TOKEN }));
  join();
  return screen.findByRole('heading', { name: 'About your business' });
}

function lastSave(): Record<string, FormDataEntryValue> {
  return Object.fromEntries((actions.survey.mock.calls.at(-1)![1] as FormData).entries());
}

function lastSaveAll(field: string): FormDataEntryValue[] {
  return (actions.survey.mock.calls.at(-1)![1] as FormData).getAll(field);
}

const GOALS = 'What would you most like Islanda to help you with?';
const CHALLENGES = 'What challenges are you facing with your business right now?';

/** Continue, then wait for the next section — with its buttons ready again. */
async function continueTo(heading: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: heading });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Skip for Now' })).not.toBeDisabled(),
  );
}

function storedSurvey() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as {
    token: string;
    finished: boolean;
  } | null;
}

beforeEach(() => {
  actions.join.mockReset();
  actions.survey.mockReset();
  actions.read.mockReset();
  actions.track.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => window.localStorage.clear());

describe('waitlist signup form', () => {
  it('keeps signup short: name and email required, phone optional', () => {
    render(<WaitlistForm />);
    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.getByLabelText('Phone number')).not.toBeRequired();
    expect(screen.getByRole('button', { name: 'Join the Waitlist' })).toBeTruthy();
    expect(screen.queryByText('About your business')).toBeNull();
  });

  it('records a form start once, on first focus — without any field content', () => {
    render(<WaitlistForm />);
    fireEvent.focus(screen.getByLabelText('First name'));
    fireEvent.focus(screen.getByLabelText('Email address'));
    expect(actions.track).toHaveBeenCalledTimes(1);
    expect(actions.track).toHaveBeenCalledWith('waitlist_form_started');
  });

  it('shows a phone validation error next to the phone field', async () => {
    actions.join.mockResolvedValue(
      fail(
        new AppError({ code: 'VALIDATION_FAILED', humanMessage: 'Fix it', correlationId: 'c' }),
        {
          phone: ['Enter a valid phone number, or leave it blank.'],
        },
      ),
    );
    join();
    expect(await screen.findByText('Enter a valid phone number, or leave it blank.')).toBeTruthy();
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('optional questionnaire', () => {
  it('appears only after a successful signup, beneath the confirmation', async () => {
    await joinAndOpenSurvey();
    expect(screen.getByText("You're on the list!")).toBeTruthy();
    expect(screen.getByText(/Optional · Section 1 of 4/)).toBeTruthy();
    expect(screen.getByText(/you're already on the waitlist/)).toBeTruthy();
  });

  it('does not appear when the signup failed', async () => {
    actions.join.mockResolvedValue(
      fail(new AppError({ code: 'UNEXPECTED', humanMessage: 'Try again.', correlationId: 'c' })),
    );
    join();
    await screen.findByText('Try again.');
    expect(screen.queryByText('About your business')).toBeNull();
  });

  it('does not appear for someone already on the list (no token is issued)', async () => {
    actions.join.mockResolvedValue(ok({ status: 'already_on_list' }));
    join();
    await screen.findByText("You're on the list.");
    expect(screen.queryByText('About your business')).toBeNull();
  });

  it('section A: location, business name, journey and a searchable industry list — none required', async () => {
    await joinAndOpenSurvey();
    expect(screen.getByLabelText('Country')).not.toBeRequired();
    expect(screen.getByLabelText('Country')).toHaveAttribute('list');
    expect(screen.getByLabelText('City, island, or community')).not.toBeRequired();
    expect(screen.getByLabelText(/What is your business called\?/)).not.toBeRequired();

    const journey = screen.getByRole('group', { name: 'Where are you in your business journey?' });
    expect(within(journey).getAllByRole('radio')).toHaveLength(8);

    const industry = screen.getByLabelText('What industry is your business in?');
    expect(within(industry).getAllByRole('option')).toHaveLength(23); // 22 + the blank prompt
    expect(screen.queryByLabelText(/Your industry/)).toBeNull();
    fireEvent.change(industry, { target: { value: 'other' } });
    expect(await screen.findByLabelText(/Your industry/)).not.toBeRequired();
  });

  it('Continue saves only section A, then shows section B with goals and challenges', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Barbados' } });
    fireEvent.click(screen.getByRole('radio', { name: "I'm preparing to register my business" }));

    await continueTo('What do you want Islanda to help you do?');
    expect(lastSave()).toMatchObject({
      token: TOKEN,
      final: 'false',
      section: '1',
      fields: 'country,cityIsland,businessName,businessJourney,industry,industryOther',
      country: 'Barbados',
      businessJourney: 'preparing_to_register',
    });

    const goals = screen.getByRole('group', { name: GOALS });
    expect(within(goals).getAllByRole('checkbox')).toHaveLength(20);
    expect(within(goals).queryAllByRole('radio')).toHaveLength(0);
    expect(goals).toHaveAccessibleDescription('Select all that apply.');
    const challenges = screen.getByRole('group', { name: CHALLENGES });
    expect(within(challenges).getAllByRole('checkbox')).toHaveLength(15);
    expect(challenges).toHaveAccessibleDescription('Select all that apply.');
    expect(
      screen.getByRole('group', { name: 'Which stage best describes your business?' }),
    ).toBeTruthy();
  });

  it('reveals optional "Other" fields only for "Other"', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    await continueTo('What do you want Islanda to help you do?');

    const challenges = screen.getByRole('group', { name: CHALLENGES });
    const explain = screen.getByLabelText(/Tell us about your challenge/);
    expect(explain).not.toBeVisible();
    fireEvent.click(within(challenges).getByRole('checkbox', { name: 'Other' }));
    expect(explain).toBeVisible();
    expect(explain).toHaveAttribute('maxLength', '300');
    // "Other" combines with other answers rather than replacing them.
    fireEvent.click(within(challenges).getByRole('checkbox', { name: 'Finding customers' }));
    expect(explain).toBeVisible();
    fireEvent.change(explain, { target: { value: 'Shipping to the Family Islands' } });
    // Unticking "Other" by mistake hides the field without losing what was typed.
    fireEvent.click(within(challenges).getByRole('checkbox', { name: 'Other' }));
    expect(explain).not.toBeVisible();
    fireEvent.click(within(challenges).getByRole('checkbox', { name: 'Other' }));
    expect(explain).toHaveValue('Shipping to the Family Islands');
  });

  it('saves every selected goal and challenge together', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    await continueTo('What do you want Islanda to help you do?');

    const goals = screen.getByRole('group', { name: GOALS });
    fireEvent.click(within(goals).getByRole('checkbox', { name: /licences, permits/ }));
    fireEvent.click(within(goals).getByRole('checkbox', { name: /funding or investment/ }));
    fireEvent.click(within(goals).getByRole('checkbox', { name: 'Other' }));
    fireEvent.change(screen.getByLabelText(/What would you like help with\?/), {
      target: { value: 'Import duties' },
    });
    const challenges = screen.getByRole('group', { name: CHALLENGES });
    fireEvent.click(within(challenges).getByRole('checkbox', { name: 'Finding customers' }));
    fireEvent.click(within(challenges).getByRole('checkbox', { name: 'Marketing my business' }));

    await continueTo('Early testing');
    expect(lastSave()).toMatchObject({
      section: '2',
      fields: 'primaryGoals,goalOther,challenges,challengeOther,businessStage',
      goalOther: 'Import duties',
    });
    // Option order, not click order — and no duplicates.
    expect(lastSaveAll('primaryGoals')).toEqual([
      'licences_permits_approvals',
      'funding_investment',
      'other',
    ]);
    expect(lastSaveAll('challenges')).toEqual(['finding_customers', 'marketing']);
  });

  it('keeps the "not sure" answers exclusive', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    await continueTo('What do you want Islanda to help you do?');

    const goals = screen.getByRole('group', { name: GOALS });
    const plan = within(goals).getByRole('checkbox', { name: /Create a clear plan/ });
    const notSure = within(goals).getByRole('checkbox', { name: "I'm not sure yet" });
    fireEvent.click(plan);
    fireEvent.click(notSure);
    expect(notSure).toBeChecked();
    expect(plan).not.toBeChecked();
    fireEvent.click(plan);
    expect(plan).toBeChecked();
    expect(notSure).not.toBeChecked();

    const challenges = screen.getByRole('group', { name: CHALLENGES });
    const several = within(challenges).getByRole('checkbox', { name: /several challenges/ });
    const customers = within(challenges).getByRole('checkbox', { name: 'Finding customers' });
    fireEvent.click(customers);
    fireEvent.click(several);
    expect(within(challenges).getAllByRole('checkbox', { checked: true })).toEqual([several]);
    fireEvent.click(customers);
    expect(several).not.toBeChecked();
  });

  it('clearing every selection saves an empty answer, not "unchanged"', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    await continueTo('What do you want Islanda to help you do?');
    await continueTo('Early testing');
    expect(lastSave().fields).toContain('primaryGoals');
    expect(lastSaveAll('primaryGoals')).toEqual([]);
  });

  it('walks all four sections; the last submit is final and shows a confirmation', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    await continueTo('What do you want Islanda to help you do?');
    await continueTo('Early testing');

    expect(screen.getByRole('radio', { name: "Yes, I'd love to try it" })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: "Maybe — I'd like to learn more first" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: "Yes, I'd love to try it" }));
    expect(screen.getByText(/never use them for marketing or public testimonials/)).toBeTruthy();

    await continueTo('Anything else?');
    expect(screen.getByText(/don't include passwords, payment details/)).toBeTruthy();
    const textarea = screen.getByLabelText(/Is there anything else/);
    expect(textarea).toHaveAttribute('maxLength', '1000');
    fireEvent.change(textarea, { target: { value: 'I need a food handler licence.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }));

    expect(await screen.findByText(/your answers are saved/)).toBeTruthy();
    expect(lastSave()).toMatchObject({
      final: 'true',
      fields: 'additionalInfo',
      additionalInfo: 'I need a food handler licence.',
    });
    // The token is kept so the visitor can come back and update their answers.
    expect(storedSurvey()).toMatchObject({ token: TOKEN, finished: true });
    expect(screen.getByRole('button', { name: 'Update my answers' })).toBeTruthy();
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it('Back keeps earlier answers and sends nothing', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Jamaica' } });
    await continueTo('What do you want Islanda to help you do?');
    const calls = actions.survey.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'About your business' });
    expect(screen.getByLabelText('Country')).toHaveValue('Jamaica');
    expect(actions.survey.mock.calls.length).toBe(calls);
  });

  it('skipping keeps the signup, writes nothing, and records the skip', async () => {
    await joinAndOpenSurvey();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for Now' }));
    expect(await screen.findByText(/You are still on the waitlist/)).toBeTruthy();
    expect(screen.getByText("You're on the list!")).toBeTruthy();
    expect(actions.survey).not.toHaveBeenCalled();
    expect(actions.track).toHaveBeenCalledWith('waitlist_survey_skipped', { section: 1 });
  });

  it('shows a useful error, keeps the answers, and lets the visitor retry', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValueOnce(
      fail(
        new AppError({
          code: 'UNEXPECTED',
          humanMessage: 'We could not save your answers just now. Please try again.',
          correlationId: 'c',
        }),
      ),
    );
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'The Bahamas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Generous timeout: this form now renders ~35 controlled checkboxes, and under a
    // full parallel suite the first commit can exceed the 1s default.
    expect(
      await screen.findByText(/could not save your answers just now/, {}, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.getByText(/Your answers are still here/)).toBeTruthy();
    expect(screen.getByLabelText('Country')).toHaveValue('The Bahamas');
    expect(screen.getByRole('heading', { name: 'About your business' })).toBeTruthy();

    actions.survey.mockResolvedValueOnce(ok({ status: 'saved' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled(),
    );
    await continueTo('What do you want Islanda to help you do?');
    expect(lastSave().country).toBe('The Bahamas');
  });

  it('a returning visitor (same browser) gets their saved answers back to update', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: TOKEN, finished: false, savedAt: Date.now() }),
    );
    actions.read.mockResolvedValue({
      country: 'Barbados',
      cityIsland: 'Bridgetown',
      businessName: null,
      businessJourney: 'established_business',
      industry: 'other',
      industryOther: 'Boat repair',
      primaryGoals: ['clear_plan', 'other'],
      goalOther: 'Export permits',
      challenges: ['finding_customers'],
      challengeOther: null,
      businessStage: null,
      testingInterest: null,
      feedbackInterest: null,
      additionalInfo: null,
      completed: false,
    });
    render(<WaitlistForm />);

    expect(await screen.findByRole('heading', { name: 'About your business' })).toBeTruthy();
    expect(actions.read).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByLabelText('Country')).toHaveValue('Barbados');
    expect(
      screen.getByRole('radio', { name: 'I already run an established business' }),
    ).toBeChecked();
    expect(screen.getByLabelText(/Your industry/)).toHaveValue('Boat repair');
    // Multi-select answers come back ticked, "Other" text included (section B is
    // mounted but hidden until reached, so query the hidden tree).
    const goals = screen.getByRole('group', { name: GOALS, hidden: true });
    expect(
      within(goals)
        .getAllByRole('checkbox', { checked: true, hidden: true })
        .map((box) => (box as HTMLInputElement).value),
    ).toEqual(['clear_plan', 'other']);
    expect(screen.getByLabelText(/What would you like help with\?/)).toHaveValue('Export permits');
    expect(
      within(screen.getByRole('group', { name: CHALLENGES, hidden: true })).getByRole('checkbox', {
        name: 'Finding customers',
        hidden: true,
      }),
    ).toBeChecked();
    // It does not repeat the claim that an email was just sent.
    expect(screen.queryByText(/confirmation email is on its way/)).toBeNull();
  });

  it('an expired stored token is ignored', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: TOKEN,
        finished: false,
        savedAt: Date.now() - 31 * 24 * 3600 * 1000,
      }),
    );
    render(<WaitlistForm />);
    expect(screen.getByRole('button', { name: 'Join the Waitlist' })).toBeTruthy();
    expect(screen.queryByText('About your business')).toBeNull();
  });
});
