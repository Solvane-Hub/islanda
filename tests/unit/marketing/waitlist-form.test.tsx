import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, ok, AppError } from '@/lib/errors';

const action = vi.hoisted(() => vi.fn());
vi.mock('@/app/waitlist-actions', () => ({ joinWaitlistAction: action }));

import { WaitlistForm } from '@/components/marketing/waitlist-form';
import { fireEvent, waitFor } from '@testing-library/react';

function submit() {
  render(<WaitlistForm />);
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.submit(screen.getByRole('button', { name: /join the waitlist/i }).closest('form')!);
}

describe('WaitlistForm submission states', () => {
  beforeEach(() => action.mockReset());

  it('shows the confirmation-email guidance after a new signup', async () => {
    action.mockResolvedValue(ok({ status: 'joined' }));
    submit();
    expect(await screen.findByText("You're on the list!")).toBeTruthy();
    expect(screen.getByText(/A confirmation email is on its way to you\./)).toBeTruthy();
    expect(screen.getByText(/Check your Spam or Junk folder/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'waitlist@solvanehub.us' }).getAttribute('href')).toBe(
      'mailto:waitlist@solvanehub.us',
    );
  });

  it('does not claim an email is on its way for a duplicate signup', async () => {
    action.mockResolvedValue(ok({ status: 'already_on_list' }));
    submit();
    expect(await screen.findByText("You're on the list.")).toBeTruthy();
    expect(screen.queryByText(/confirmation email/)).toBeNull();
  });

  it('shows no success state for a failed submission', async () => {
    action.mockResolvedValue(
      fail(new AppError({ code: 'UNEXPECTED', humanMessage: 'Try again.', correlationId: 'c' })),
    );
    submit();
    await waitFor(() => expect(screen.getByText('Try again.')).toBeTruthy());
    expect(screen.queryByText(/on the list/i)).toBeNull();
    expect(screen.queryByText(/confirmation email/)).toBeNull();
  });
});
