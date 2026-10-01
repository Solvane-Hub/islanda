// TEMPORARY DIAGNOSTIC — delete once the CI Storage upload failure is understood.
//
// Question: can a GitHub Actions runner upload to the `business-documents`
// bucket at all, and does the failure in
// tests/rls/business-intelligence.test.ts:388 ("A can upload and sign a URL for
// its own document object") happen before Supabase returns an HTTP response?
//
// Each probe varies ONE thing relative to the failing call (request shape,
// auth, HTTP method) so the passing/failing set isolates the cause.
//
// Never prints secrets: keys, JWTs, upload tokens, signed-URL query strings and
// the project host are all redacted. Uploads go to
// `<A's business id>/rls-diag-<ts>/` and are removed with the service-role
// client at the end (users have no DELETE policy on this bucket).

/* eslint-disable no-console -- a CLI diagnostic whose only output is its log. */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aEmail = process.env.RLS_TEST_USER_A_EMAIL;
const aPassword = process.env.RLS_TEST_USER_A_PASSWORD;
const BUCKET = 'business-documents';

const secrets = [url, anonKey, serviceKey, aEmail, aPassword].filter(Boolean);
function redact(value) {
  let text = String(value ?? '');
  for (const s of secrets) text = text.split(s).join('<redacted>');
  if (url) text = text.split(new URL(url).host).join('<supabase-host>');
  return text
    .replace(/([?&]token=)[^&\s"]+/g, '$1<redacted>')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>');
}

function errorChain(error) {
  const chain = [];
  let e = error;
  for (let depth = 0; e && depth < 6; depth += 1) {
    chain.push({
      name: e.name,
      code: e.code,
      errno: e.errno,
      syscall: e.syscall,
      message: redact(e.message).slice(0, 200),
    });
    e = e.cause ?? e.originalError;
  }
  return chain;
}

/** Records every HTTP exchange so we know whether a response ever arrived. */
const exchanges = [];
function tracedFetch(input, init = {}) {
  const target = new URL(typeof input === 'string' ? input : input.url);
  const body = init.body;
  const entry = {
    method: init.method ?? 'GET',
    path: redact(target.pathname),
    bodyType:
      body === undefined || body === null ? 'none' : (body.constructor?.name ?? typeof body),
    contentType: redact(
      Object.entries(init.headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ??
        '(set by fetch)',
    ),
  };
  const started = Date.now();
  return fetch(input, init).then(
    (response) => {
      exchanges.push({
        ...entry,
        ms: Date.now() - started,
        httpStatus: response.status,
        cfRay: response.headers.get('cf-ray') ? 'present' : 'absent',
        server: response.headers.get('server'),
      });
      return response;
    },
    (error) => {
      exchanges.push({
        ...entry,
        ms: Date.now() - started,
        httpStatus: null,
        error: errorChain(error),
      });
      throw error;
    },
  );
}

const results = [];
async function probe(name, description, run) {
  const before = exchanges.length;
  const started = Date.now();
  let outcome;
  try {
    const value = await run();
    const error = value?.error;
    outcome = error
      ? {
          ok: false,
          apiError: {
            name: error.name,
            status: error.status ?? error.statusCode,
            chain: errorChain(error),
          },
        }
      : { ok: true };
  } catch (error) {
    outcome = { ok: false, thrown: errorChain(error) };
  }
  results.push({
    probe: name,
    description,
    ms: Date.now() - started,
    ...outcome,
    http: exchanges.slice(before),
  });
}

async function main() {
  console.log(
    JSON.stringify({
      runtime: {
        node: process.version,
        undici: process.versions.undici,
        platform: `${process.platform}/${process.arch}`,
        ci: Boolean(process.env.CI),
      },
      configured: {
        url: Boolean(url),
        anonKey: Boolean(anonKey),
        serviceRoleKey: Boolean(serviceKey),
        userA: Boolean(aEmail && aPassword),
      },
    }),
  );
  if (!url || !anonKey || !aEmail || !aPassword) {
    console.log('DIAGNOSTIC ABORTED: missing configuration');
    return;
  }

  const A = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: tracedFetch },
  });
  const signIn = await A.auth.signInWithPassword({ email: aEmail, password: aPassword });
  if (signIn.error) {
    console.log('DIAGNOSTIC ABORTED: user A sign-in failed', redact(signIn.error.message));
    return;
  }
  const { data: biz } = await A.from('businesses')
    .select('id')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();
  if (!biz) {
    console.log('DIAGNOSTIC ABORTED: user A has no active business to upload under');
    return;
  }

  const prefix = `${biz.id}/rls-diag-${Date.now()}`;
  const rounds = Math.max(1, Number(process.env.DIAG_ROUNDS ?? 1));
  const created = [];
  let round = 0;
  const p = (name) => {
    const path = `${prefix}/r${round}-${name}.txt`;
    created.push(path);
    return path;
  };
  const signedUrlFor = async (path) => {
    const s = await A.storage.from(BUCKET).createSignedUploadUrl(path);
    if (s.error) throw s.error;
    return s.data;
  };

  const admin = serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: tracedFetch },
      })
    : null;

  for (round = 1; round <= rounds; round += 1) {
    const r = `R${round}_`;

    // P0 — control: the JSON POST that already passes in CI.
    await probe(`${r}P0_createSignedUploadUrl`, 'JSON POST (passes in CI today)', () =>
      A.storage.from(BUCKET).createSignedUploadUrl(p('p0')),
    );

    // P1 — the exact failing call.
    await probe(
      `${r}P1_uploadToSignedUrl_Blob`,
      'EXACT failing call: PUT multipart FormData via supabase-js',
      async () => {
        const path = p('p1');
        const s = await signedUrlFor(path);
        return A.storage.from(BUCKET).uploadToSignedUrl(path, s.token, new Blob(['probe']));
      },
    );

    // P2 — same signed-URL PUT, but a plain (non-multipart) body.
    await probe(
      `${r}P2_uploadToSignedUrl_Buffer`,
      'PUT plain text/plain body via supabase-js (no FormData)',
      async () => {
        const path = p('p2');
        const s = await signedUrlFor(path);
        return A.storage
          .from(BUCKET)
          .uploadToSignedUrl(path, s.token, Buffer.from('probe'), { contentType: 'text/plain' });
      },
    );

    // P3 — raw fetch PUT multipart, bypassing supabase-js entirely.
    await probe(
      `${r}P3_raw_fetch_PUT_FormData`,
      'raw fetch PUT multipart FormData to signed URL',
      async () => {
        const path = p('p3');
        const s = await signedUrlFor(path);
        const form = new FormData();
        form.append('cacheControl', '3600');
        form.append('', new Blob(['probe']));
        const res = await tracedFetch(s.signedUrl, {
          method: 'PUT',
          body: form,
          headers: { 'x-upsert': 'false' },
        });
        return res.ok
          ? {}
          : {
              error: {
                name: 'HTTP',
                status: res.status,
                message: redact(await res.text()).slice(0, 200),
              },
            };
      },
    );

    // P8 — curl (a different HTTP client entirely) PUT multipart to a signed URL.
    // The URL goes in via a stdin config file so it never appears in argv or logs.
    await probe(
      `${r}P8_curl_PUT_multipart`,
      'curl PUT multipart to signed URL (non-Node HTTP client)',
      async () => {
        const path = p('p8');
        const s = await signedUrlFor(path);
        const probeFile = join(tmpdir(), `rls-diag-probe-${process.pid}.txt`);
        writeFileSync(probeFile, 'probe');
        const config = [
          `url = "${s.signedUrl}"`,
          'request = "PUT"',
          'form = "cacheControl=3600"',
          `form = "file=@${probeFile.replaceAll('\\', '/')};filename=probe.txt;type=text/plain"`,
          'header = "x-upsert: false"',
          'silent',
          'output = "-"',
          'write-out = "\\nCURL http_code=%{http_code} http_version=%{http_version} time=%{time_total}\\n"',
          'max-time = 30',
        ].join('\n');
        const out = spawnSync('curl', ['-K', '-'], { input: config, encoding: 'utf8' });
        const tail = redact((out.stdout ?? '').split('\n').find((l) => l.startsWith('CURL')) ?? '');
        const code = /http_code=(\d+)/.exec(tail)?.[1];
        exchanges.push({
          method: 'PUT',
          path: '(curl)',
          bodyType: 'multipart',
          curlExit: out.status,
          curl: tail,
        });
        return out.status === 0 && code?.startsWith('2')
          ? {}
          : {
              error: {
                name: 'curl',
                status: Number(code) || null,
                message: `exit ${out.status} ${tail}`,
              },
            };
      },
    );

    // P4 — authenticated POST upload (user JWT, multipart) — not a signed URL.
    await probe(
      `${r}P4_upload_POST_Blob`,
      'POST multipart FormData with user JWT (storage.upload)',
      () => A.storage.from(BUCKET).upload(p('p4'), new Blob(['probe'])),
    );

    // P5 — authenticated POST upload, plain body.
    await probe(`${r}P5_upload_POST_Buffer`, 'POST plain text/plain body with user JWT', () =>
      A.storage.from(BUCKET).upload(p('p5'), Buffer.from('probe'), { contentType: 'text/plain' }),
    );

    if (admin) {
      // P6/P7 — same two shapes with the service-role key (no RLS involved).
      await probe(`${r}P6_service_upload_Blob`, 'service-role POST multipart FormData', () =>
        admin.storage.from(BUCKET).upload(p('p6'), new Blob(['probe'])),
      );
      await probe(`${r}P7_service_upload_Buffer`, 'service-role POST plain body', () =>
        admin.storage
          .from(BUCKET)
          .upload(p('p7'), Buffer.from('probe'), { contentType: 'text/plain' }),
      );
    }
  }

  if (admin) {
    const cleanup = await admin.storage.from(BUCKET).remove(created);
    console.log(
      JSON.stringify({
        cleanup: cleanup.error
          ? `failed: ${redact(cleanup.error.message)}`
          : `removed ${cleanup.data?.length ?? 0} of ${created.length} object path(s)`,
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        cleanup: 'skipped: no service-role key; objects left under rls-diag-* prefix',
      }),
    );
  }

  for (const result of results) console.log(JSON.stringify(result));
  console.log(
    'SUMMARY ' +
      results
        .map((x) => {
          const last = x.http.at(-1);
          const status =
            last?.httpStatus ?? (last?.curl ? /http_code=(\d+)/.exec(last.curl)?.[1] : null);
          return `${x.probe}=${x.ok ? 'OK' : 'FAIL'}${status ? `(${status})` : '(no-response)'}`;
        })
        .join(' '),
  );
}

main().catch((error) => {
  console.log('DIAGNOSTIC CRASHED', JSON.stringify(errorChain(error)));
});
