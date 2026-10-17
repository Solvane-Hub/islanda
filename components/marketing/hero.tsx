import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { LogoLockup } from '@/components/brand/logo-mark';
import { ACCESS_COPY, type AccessMode } from '@/lib/product/availability';
import { cn } from '@/lib/utils/cn';

/**
 * The landing hero — environment, then logo, then statement, then action.
 *
 * The first screen answers the five questions a first-time visitor has, in
 * order: who this is for and what problem it addresses (headline, supporting
 * line), whether they can use it (the availability line, from the same access
 * copy the auth pages use) and what to do next (one primary action). A second
 * action exists only when it works: "Sign in" is offered in open mode and never
 * while the waitlist gate redirects every sign-in away.
 *
 * A photograph of the Bahama Banks fills the viewport; the brand sits inside
 * it as the supplied lockup image, not an HTML wordmark — this is the one
 * place `LogoLockup` renders rather than `Logo`, because the design calls for
 * the exact designed graphic, verbatim, directly on the photograph — no
 * backing plate. `variant="dark"` selects the white-wordmark file (the icon
 * itself is never recoloured) so it reads without one. The workspace product
 * preview lives immediately below (`enter-islanda.tsx` via `app/page.tsx`),
 * so this first viewport stays uncontested: environment, brand, message, door in.
 *
 * Two separate background images, art-directed rather than cropped: the desktop
 * frame is a high-altitude view of the Exuma chain, the mobile frame is a
 * vertical sandbar composition with its own headline zone. One is not a resize
 * of the other, because a 3:2 aerial cropped to 4:5 loses the geography that
 * makes it worth showing.
 *
 * Legibility comes from a directional scrim in the photograph's own cobalt hue,
 * not a grey wash — the image reads as deepening water rather than as a picture
 * with something laid over it. White text on it measures 18.7:1.
 *
 * No client JavaScript. The entrance is a CSS keyframe, so the whole hero stays
 * a Server Component and `prefers-reduced-motion` neutralises it through the
 * global rule in globals.css.
 */
const BLUR_DESKTOP =
  'data:image/webp;base64,UklGRnIAAABXRUJQVlA4IGYAAADwAQCdASoQAAsAAwBSJbACdAEO9FoHCaAAzIKbdn0xHQy75i5tpmZfBNGGpSeWLBuADo1oW74eJC3bsKH78VWgnG8VH5o2tFt/Fwndfb0Rx1WLH/4Z1h93Ye/0eG8BH6e0Uu9AAAA=';
const BLUR_MOBILE =
  'data:image/webp;base64,UklGRoYAAABXRUJQVlA4IHoAAABQBACdASoQABQAPt1apkyopSOiMAgBEBuJbACdMoGv/gPC6MG6nWYXrb9gAPffaH/83GIZXt0HcPpYAR4NY9X9kmZ2ob8BEig7tTL+mYoMkXKJNx/twOhrv7GBvDRT6GiRK8mfnC/AoWaBj3z8OviSma5JebK+XpuAAA==';

export function Hero({ mode }: { mode: AccessMode }) {
  const access = ACCESS_COPY[mode];
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      {/* ---- Environment ------------------------------------------------- */}
      <Image
        src="/hero/banks-desktop.webp"
        alt="Aerial view of the Exuma cays in The Bahamas — green limestone islands and white sandbars scattered through turquoise shallows, with deep cobalt channels running between them."
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DESKTOP}
        className="hidden object-cover object-center md:block"
      />
      <Image
        src="/hero/banks-mobile.webp"
        alt="Aerial view of a white sandbar curving through brilliant turquoise shallows in The Bahamas, with small green cays and deep blue ocean beyond."
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_MOBILE}
        className="object-cover object-[58%_center] md:hidden"
      />

      {/* Centered vignette. A horizontal band rather than a radial pool — a
          radial shape reads as a blob at wide aspect ratios, where its width
          and height stop matching each other. A vertical band scales correctly
          at any width, and only the middle of the viewport needs it: the logo
          sits on its own opaque plate and needs no help, so this exists for the
          headline and scroll cue alone. Fades out well before the top and
          bottom of the photograph, which stays untouched at the edges. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0"
        style={{
          background:
            // Deeper than the logo-only hero needed: there is now a paragraph and
            // an availability line on the photograph, not just a headline.
            'linear-gradient(to bottom, transparent 0%, oklch(18% 0.055 245 / 0.45) 26%, oklch(18% 0.055 245 / 0.55) 70%, transparent 94%)',
        }}
      />

      {/* ---- Composition -------------------------------------------------- */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[92rem] flex-col items-center justify-center px-4 py-24 text-center sm:px-8 lg:px-12">
        <div className="hero-text-in flex max-w-2xl flex-col items-center">
          <LogoLockup variant="dark" priority className="w-[clamp(9rem,24vw,14rem)]" />

          <p className="text-2xs mt-8 font-semibold tracking-[0.2em] text-white uppercase drop-shadow-sm">
            The Bahamas business pilot
          </p>

          <h1 className="font-display mt-4 text-[clamp(1.875rem,5.4vw,3.5rem)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance text-white drop-shadow-sm">
            Starting a business in The Bahamas?{' '}
            <span className="text-bahama-turquoise">Start here.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base text-pretty text-white drop-shadow-sm sm:text-lg">
            Finding the right information and knowing what to do first can be hard. Islanda is being
            built to help you organize your business idea and take a clearer first step.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              href="#waitlist"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'text-ink bg-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white',
              )}
            >
              Join the early-access waitlist
              <ArrowRight aria-hidden="true" strokeWidth={2} />
            </Link>

            {access.signInAvailable ? (
              <p className="text-sm text-white drop-shadow-sm">
                Already have access?{' '}
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            ) : null}
          </div>

          {/* The availability statement sits on its own plate: it is the one
              line on the photograph a visitor must be able to read exactly. */}
          <p className="bg-abyss/70 mt-6 max-w-lg rounded-xl px-4 py-3 text-sm text-pretty text-white backdrop-blur-md">
            {access.statement}
          </p>
        </div>
      </div>
    </section>
  );
}
