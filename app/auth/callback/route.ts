import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSafeInternalPath } from '@/lib/utils/safe-path';

/**
 * Exchanges an email confirmation or password-recovery code for a session.
 *
 * A Route Handler rather than a Server Action: this is a GET navigation target
 * for a link in an email, which is exactly the "clear architectural benefit"
 * exception in ADR-0003.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next') ?? '/dashboard';
  const next = isSafeInternalPath(requestedNext) ? requestedNext : '/dashboard';

  // Administrators recover through their own sign-in page, which stays open
  // while the founder product is waitlist-only.
  const loginPath = next.startsWith('/admin/') ? '/admin/login' : '/login';

  if (!code) {
    return NextResponse.redirect(`${origin}${loginPath}?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // The link is single-use and time-limited; an expired one is the common case.
    return NextResponse.redirect(`${origin}${loginPath}?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
