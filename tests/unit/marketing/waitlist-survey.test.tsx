import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, fail, ok } from '@/lib/errors';

const actions = vi.hoisted(() => ({ join: vi.fn(), survey: vi.fn() }));
vi.mock('@/app/waitlist-actions', () => ({
  joinWaitlistAction: actions.join,
  submitWaitlistSurveyAction: actions.survey,
}));

import { WaitlistForm } from '@/components/marketing/waitlist-form';

const TOKEN = 't'.repeat(43);
const STORAGE_KEY = 'islanda.waitlist.survey-token';

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
  return screen.findByRole('heading', { name: 'Help Us Build Something Useful for You' });
}

function lastSurveySubmission(): FormData {
  return actions.survey.mock.calls.at(-1)![1] as FormData;
}

describe('waitlist signup form', () => {
  beforeEach(() => {
    actions.join.mockReset();
    actions.survey.mockReset();
    window.sessionStorage.clear();
  });

  it('keeps signup short: name and email required, phone optional', () => {
    render(<WaitlistForm />);
    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.getByLabelText('Phone number')).not.toBeRequired();
    expect(screen.getByRole('button', { name: 'Join the Waitlist' })).toBeTruthy();
    // No questionnaire fields on the first screen.
    expect(screen.queryByText("What's your biggest challenge?")).toBeNull();
  });

  it('sends the optional phone number with the signup', async () => {
    actions.join.mockResolvedValue(ok({ status: 'already_on_list' }));
    render(<WaitlistForm />);
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '(242) 555-0123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /join the waitlist/i }).closest('form')!);
    await waitFor(() => expect(actions.join).toHaveBeenCalled());
    expect((actions.join.mock.calls[0]![1] as FormData).get('phone')).toBe('(242) 555-0123');
  });

  it('shows a phone validation error next to the phone field', async () => {
    actions.join.mockResolvedValue(
      fail(
        new AppError({ code: 'VALIDATION_FAILED', humanMessage: 'Fix it', correlationId: 'c' }),
        { phone: ['Enter a valid phone number, or leave it blank.'] },
      ),
    );
    join();
    expect(await screen.findByText('Enter a valid phone number, or leave it blank.')).toBeTruthy();
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('optional questionnaire', () => {
  beforeEach(() => {
    actions.join.mockReset();
    actions.survey.mockReset();
    window.sessionStorage.clear();
  });
  afterEach(() => window.sessionStorage.clear());

  it('appears only after a successful signup, beneath the confirmation', async () => {
    await joinAndOpenSurvey();
    expect(screen.getByText("You're on the list!")).toBeTruthy();
    expect(screen.getByText(/A confirmation email is on its way/)).toBeTruthy();
    expect(screen.getByText(/Tell us a little about yourself/)).toBeTruthy();
  });

  it('does not appear when the signup failed', async () => {
    actions.join.mockResolvedValue(
      fail(new AppError({ code: 'UNEXPECTED', humanMessage: 'Try again.', correlationId: 'c' })),
    );
    join();
    await screen.findByText('Try again.');
    expect(screen.queryByText('Help Us Build Something Useful for You')).toBeNull();
  });

  it('does not appear for someone already on the list (no token is issued)', async () => {
    actions.join.mockResolvedValue(ok({ status: 'already_on_list' }));
    join();
    await screen.findByText("You're on the list.");
    expect(screen.queryByText('Help Us Build Something Useful for You')).toBeNull();
  });

  it('offers all four questions with every agreed option, none required', async () => {
    await joinAndOpenSurvey();

    expect(screen.getByLabelText('Country')).not.toBeRequired();
    expect(screen.getByLabelText('City or island')).not.toBeRequired();

    const groups: Record<string, string[]> = {
      'Where are you in your business journey?': [
        'Just exploring',
        'Planning to start',
        'Trying to register',
        'Already operating',
      ],
      "What's your biggest challenge?": [
        'Finding reliable information',
        'Understanding registration',
        'Knowing the next steps',
        'Finding customers',
        'Managing my business',
        'Other',
      ],
      'Interested in trying Islanda before launch?': ['Yes', 'Maybe', 'Not right now'],
    };
    for (const [legend, options] of Object.entries(groups)) {
      const group = screen.getByRole('group', { name: legend });
      const radios = within(group).getAllByRole('radio');
      expect(radios.map((r) => (r.closest('label') as HTMLElement).textContent)).toEqual(options);
      for (const radio of radios) expect(radio).not.toBeRequired();
    }

    expect(screen.getByRole('button', { name: 'Submit Answers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip for Now' })).toBeTruthy();
  });

  it('reveals an optional explanation field only for "Other"', async () => {
    await joinAndOpenSurvey();
    expect(screen.queryByLabelText(/Tell us about your challenge/)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Other' }));
    const explain = await screen.findByLabelText(/Tell us about your challenge/);
    expect(explain).not.toBeRequired();
    expect(explain).toHaveAttribute('maxLength', '300');

    fireEvent.click(screen.getByRole('radio', { name: 'Finding customers' }));
    await waitFor(() => expect(screen.queryByLabelText(/Tell us about your challenge/)).toBeNull());
  });

  it('submits the answers with the signup token and shows the thank-you message', async () => {
    await joinAndOpenSurvey();
    actions.survey.mockResolvedValue(ok({ status: 'saved' }));

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'The Bahamas' } });
    fireEvent.change(screen.getByLabelText('City or island'), { target: { value: 'Exuma' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Trying to register' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Other' }));
    fireEvent.change(await screen.findByLabelText(/Tell us about your challenge/), {
      target: { value: 'Finding a shop' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }));

    expect(await screen.findByText(/Your answers will help us understand/)).toBeTruthy();
    const sent = lastSurveySubmission();
    expect(Object.fromEntries(sent.entries())).toEqual({
      token: TOKEN,
      country: 'The Bahamas',
      cityIsland: 'Exuma',
      businessStage: 'trying_to_register',
      biggestChallenge: 'other',
      challengeOther: 'Finding a shop',
      testingInterest: 'yes',
    });
    // The success message never implies selection for the pilot.
    expect(screen.queryByText(/selected/i)).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('skipping keeps the signup and never calls the server', async () => {
    await joinAndOpenSurvey();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for Now' }));

    expect(await screen.findByText(/You are still on the waitlist/)).toBeTruthy();
    expect(screen.getByText("You're on the list!")).toBeTruthy();
    expect(actions.survey).not.toHaveBeenCalled();
    expect(screen.queryByText('Help Us Build Something Useful for You')).toBeNull();
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
    fireEvent.click(screen.getByRole('radio', { name: 'Maybe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }));

    expect(await screen.findByText(/could not save your answers just now/)).toBeTruthy();
    expect(screen.getByText(/Your answers are still here/)).toBeTruthy();
    expect(screen.getByLabelText('Country')).toHaveValue('The Bahamas');
    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked();
    // The signup confirmation is untouched by the failure.
    expect(screen.getByText("You're on the list!")).toBeTruthy();

    actions.survey.mockResolvedValueOnce(ok({ status: 'saved' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }));
    expect(await screen.findByText(/Your answers will help us understand/)).toBeTruthy();
    expect(actions.survey).toHaveBeenCalledTimes(2);
    expect(lastSurveySubmission().get('country')).toBe('The Bahamas');
  });

  it('survives a refresh: the stored token brings the questions back', async () => {
    await joinAndOpenSurvey();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe(TOKEN);

    // Simulate a reload: a fresh component with no action state.
    const { unmount } = render(<div />);
    unmount();
    document.body.innerHTML = '';
    render(<WaitlistForm />);

    expect(
      await screen.findByRole('heading', { name: 'Help Us Build Something Useful for You' }),
    ).toBeTruthy();
    expect(screen.getByText("You're on the list.")).toBeTruthy();
    // It does not repeat the claim that an email was just sent.
    expect(screen.queryByText(/confirmation email is on its way/)).toBeNull();
  });
});
