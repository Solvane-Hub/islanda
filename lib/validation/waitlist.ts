import { z } from 'zod';

/**
 * Public waitlist signup — deliberately minimal (conversion over completeness).
 * Only email is required; a first name is a nice-to-have personalization.
 */
export const joinWaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, 'Enter a valid email address.')
    .max(255, 'Enter a valid email address.')
    .email('Enter a valid email address.'),
  firstName: z
    .string()
    .trim()
    .max(100, 'That name is too long.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
