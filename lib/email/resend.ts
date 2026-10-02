import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resend } from 'resend';
import {
  buildWaitlistConfirmationMessage,
  WAITLIST_LOGO_CONTENT_ID,
} from '@/lib/email/templates/waitlist-confirmation';

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  return new Resend(apiKey);
}

const fromEmail = process.env.WAITLIST_FROM_EMAIL ?? 'Islanda <waitlist@solvanehub.us>';

const notificationEmail = process.env.WAITLIST_NOTIFICATION_EMAIL ?? 'info@solvanehub.us';

export interface WaitlistEmailData {
  email: string;
  firstName: string;
  lastName: string;
  status: 'joined' | 'already_on_list';
  source?: string;
}

export async function sendWaitlistConfirmation(data: WaitlistEmailData): Promise<void> {
  const resend = getResend();
  const message = buildWaitlistConfirmationMessage(data);
  const logo = await readFile(join(process.cwd(), 'lib', 'email', 'assets', 'islanda-stamp.png'));

  await resend.emails.send({
    from: fromEmail,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: [
      {
        filename: 'islanda-stamp.png',
        content: logo,
        contentType: 'image/png',
        contentId: WAITLIST_LOGO_CONTENT_ID,
      },
    ],
  });
}

export async function sendWaitlistNotification(data: WaitlistEmailData): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: fromEmail,
    to: notificationEmail,
    replyTo: data.email,
    subject: `New Islanda waitlist signup — ${data.email}`,
    text: [
      'New Islanda waitlist signup',
      '',
      `First name: ${data.firstName.trim()}`,
      `Last name: ${data.lastName.trim()}`,
      `Email: ${data.email}`,
      `Status: ${data.status}`,
      '',
      `Source: ${data.source ?? 'landing_page'}`,
    ].join('\n'),
  });
}
