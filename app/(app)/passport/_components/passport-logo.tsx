'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PassportMonogram } from './passport-monogram';
import { finalizeLogoUploadAction, removeLogoAction, requestLogoUploadAction } from '../actions';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const OUTPUT_SIZE = 512;

/**
 * Auto-centred square crop — the shorter dimension sets the crop side, drawn
 * centred over the longer one, always exported as PNG (preserves
 * transparency regardless of the source format). There is no interactive
 * reposition/zoom step: a deliberate simplification to avoid a hand-rolled
 * drag/zoom interaction (or a new cropping dependency) for a first version.
 * `createImageBitmap`/`<canvas>` are native browser APIs — no dependency.
 */
async function cropToSquarePng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('That image could not be processed.'));
    }, 'image/png');
  });
}

type Phase = 'closed' | 'menu' | 'preview' | 'saving';

/**
 * The Passport's own logo slot — a small dialog for upload/replace/remove,
 * native to the Passport rather than a settings form. Opens on click/tap of
 * the logo itself; the result shows immediately (`router.refresh()`
 * re-fetches the Passport, which re-signs the new logo's URL).
 */
export function PassportLogo({
  name,
  logoUrl,
  size = 108,
}: {
  name: string | null;
  logoUrl: string | null;
  size?: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('closed');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase]);

  function close() {
    setPhase('closed');
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingBlob(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onFileChosen(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That image is larger than 2 MB.');
      return;
    }

    try {
      const blob = await cropToSquarePng(file);
      setPendingBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase('preview');
    } catch {
      setError('That image could not be processed. Please try another.');
    }
  }

  async function onSave() {
    if (!pendingBlob) return;
    setPhase('saving');
    setError(null);
    try {
      const ticket = await requestLogoUploadAction();
      if (!ticket.ok) {
        setError(ticket.message);
        setPhase('preview');
        return;
      }

      const supabase = createClient();
      const upload = await supabase.storage
        .from(ticket.data.bucket)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, pendingBlob);
      if (upload.error) {
        setError('That logo could not be uploaded. Please try again.');
        setPhase('preview');
        return;
      }

      const finalized = await finalizeLogoUploadAction(ticket.data.path);
      if (!finalized.ok) {
        setError(finalized.message);
        setPhase('preview');
        return;
      }

      close();
      router.refresh();
    } catch {
      setError('Something went wrong saving that logo. Please try again.');
      setPhase('preview');
    }
  }

  async function onRemove() {
    setError(null);
    const result = await removeLogoAction();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase('menu')}
        aria-label={logoUrl ? 'Change business logo' : 'Add business logo'}
        className="group relative rounded-[22%] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <PassportMonogram name={name} logoUrl={logoUrl} size={size} />
        <span
          aria-hidden="true"
          className="bg-abyss/75 text-4xs text-passport-foil absolute inset-0 flex items-center justify-center rounded-[22%] font-medium tracking-[0.14em] uppercase opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          {logoUrl ? 'Change' : 'Add logo'}
        </span>
      </button>

      {phase !== 'closed' ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Business logo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            aria-hidden="true"
            onClick={phase === 'saving' ? undefined : close}
            className="bg-abyss/80 absolute inset-0 backdrop-blur-sm"
          />

          {/* The dialog is cut from the same board as the cover — a panel of
              the document being amended, not a generic app modal. */}
          <div className="passport-cover-material relative flex w-full max-w-xs flex-col items-center gap-5 rounded-[2px] border border-black/60 p-6 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
            <span
              aria-hidden="true"
              className="border-passport-foil/20 pointer-events-none absolute inset-2 border"
            />
            <div className="relative flex w-full items-center justify-between">
              <h2 className="text-passport-foil text-3xs font-semibold tracking-[0.22em] uppercase">
                Business Logo
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-passport-foil-dim/70 hover:text-passport-foil"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={2} />
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              onChange={(e) => onFileChosen(e.target.files?.[0])}
            />

            <div className="ring-passport-foil/40 relative size-28 overflow-hidden rounded-[22%] ring-1">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a static asset
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <PassportMonogram name={name} logoUrl={logoUrl} size={112} />
              )}
            </div>

            {error ? <p className="text-danger relative text-center text-xs">{error}</p> : null}

            <div className="relative flex w-full flex-col gap-2">
              {phase === 'preview' ? (
                <>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={phase !== 'preview'}
                    className="bg-passport-foil text-passport-cover-deep text-3xs w-full rounded-[2px] py-3 font-semibold tracking-[0.16em] uppercase transition-opacity duration-150 hover:opacity-90"
                  >
                    Save logo
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="text-passport-foil-dim/70 hover:text-passport-foil text-3xs w-full py-2 font-medium tracking-[0.16em] uppercase transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={phase === 'saving'}
                    className="border-passport-foil/35 text-passport-foil text-3xs w-full rounded-[2px] border py-3 font-medium tracking-[0.16em] uppercase transition-colors duration-150 hover:bg-white/5"
                  >
                    {logoUrl ? 'Replace logo' : 'Upload new logo'}
                  </button>
                  {logoUrl ? (
                    <button
                      type="button"
                      onClick={onRemove}
                      className="text-danger text-3xs w-full py-2 font-medium tracking-[0.16em] uppercase transition-opacity duration-150 hover:opacity-80"
                    >
                      Remove logo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={close}
                    className="text-passport-foil-dim/70 hover:text-passport-foil text-3xs w-full py-2 font-medium tracking-[0.16em] uppercase transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
