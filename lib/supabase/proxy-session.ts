import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { serverEnv } from '@/lib/env';

/**
 * Refreshes the auth session on every request and enforces route protection.
 *
 * Session refresh must happen in middleware: Server Components cannot write
 * cookies, so without this an expired token would surface as a confusing
 * "not signed in" rather than being transparently renewed.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (serverEnv.WAITLIST_ONLY_MODE) {
    if (isProtected || isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      url.searchParams.set('access', 'waitlist');
      return NextResponse.redirect(url);
    }

    // Public pages do not need an auth-provider round trip in waitlist mode.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with the auth server. getSession() only
  // reads the cookie and can be spoofed, so it must not be used for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve intent so the founder lands where they were going.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const PROTECTED_PREFIXES = [
  '/dashboard',
  '/intake',
  '/timeline',
  '/compliance',
  '/funding',
  '/documents',
  '/assistant',
  '/settings',
  '/businesses',
  '/passport',
  '/welcome',
  '/intelligence',
] as const;

export const AUTH_ROUTES = ['/login', '/signup'] as const;
