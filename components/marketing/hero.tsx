import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoLockup } from '@/components/brand/logo-mark';

/**
 * The landing hero — environment, then logo, then statement, then action.
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

export function Hero() {
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
            'linear-gradient(to bottom, transparent 0%, oklch(18% 0.055 245 / 0.28) 34%, oklch(18% 0.055 245 / 0.34) 66%, transparent 88%)',
        }}
      />

      {/* ---- Composition -------------------------------------------------- */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[92rem] flex-col items-center justify-center px-6 py-24 text-center sm:px-8 lg:px-12">
        <div className="hero-text-in flex max-w-xl flex-col items-center">
          <LogoLockup variant="dark" priority className="w-[clamp(10.5rem,26vw,17rem)]" />

          <h1 className="font-display mt-8 text-[clamp(1.75rem,5.2vw,3.25rem)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance text-white">
            Navigate <span className="text-bahama-turquoise">what&apos;s next.</span>
          </h1>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="#waitlist">
              <Button
                size="lg"
                className="text-ink bg-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white"
              >
                Join the waitlist
                <ArrowRight aria-hidden="true" strokeWidth={2} />
              </Button>
            </Link>
            <Link href="#journey">
              <Button
                size="lg"
                variant="secondary"
                className="border-white/30 bg-white/10 text-white shadow-none backdrop-blur-md transition-colors hover:border-white/50 hover:bg-white/20"
              >
                See how it works
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll invitation */}
        <div className="mt-16 flex items-center gap-3 lg:mt-20">
          <span className="text-2xs font-medium tracking-[0.18em] text-white/70 uppercase">
            Scroll to explore
          </span>
          <span aria-hidden="true" className="relative h-px w-14 overflow-hidden bg-white/25">
            <span className="hero-rule absolute inset-y-0 left-0 w-5 bg-white/90" />
          </span>
        </div>
      </div>
    </section>
  );
}
