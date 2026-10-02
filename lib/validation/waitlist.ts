import { z } from 'zod';

export const joinWaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .max(255, 'Email is too long.')
    .email('Enter a valid email address.'),

  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(100, 'First name is too long.'),

  lastName: z.string().trim().min(1, 'Last name is required.').max(100, 'Last name is too long.'),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
