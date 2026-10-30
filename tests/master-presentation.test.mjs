import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { GET as asset } from '@/app/api/master-resume/assets/[id]/[kind]/route';
import { renderMasterPreview, pngDimensions } from '@/lib/pdf/thumbnail.server';
import { getMasterSummary } from '@/lib/resumes/presentation.server';
import { assertLocalPageRequest, assertLocalUploadRequest } from '@/lib/resumes/request.server';
import { makeResumePdf } from './fixtures/resume.mjs';
const id = randomUUID();
const sectionId = randomUUID();
const metadata = { schemaVersion: 1, uploadId: id, candidate: { name: 'Alex Example', role: null }, sections: [{ id: sectionId, title: 'About' }] };
const permissions = [{ sectionId, adaptable: true }];
const request = (kind, extra = {}) => new Request(`http://127.0.0.1:3000/api/master-resume/assets/${id}/${kind}`, { headers: { host: '127.0.0.1:3000', 'x-resume-reader': '1', ...extra } });
const params = kind => ({ params: Promise.resolve({ id, kind }) });

test('SSR local gate allows document navigation but rejects foreign origins/forwarders and production', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    assert.doesNotThrow(() => assertLocalPageRequest(new Headers({ host: '127.0.0.1:3000', 'sec-fetch-site': 'none' })));
    assert.doesNotThrow(() => assertLocalUploadRequest(new Request('http://localhost:3000/api/master-resume', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' } })));
    assert.doesNotThrow(() => assertLocalUploadRequest(new Request('http://localhost:3000/image', { headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'image' } }), true));
    for (const headers of [{ host: 'foreign.test' }, { host: '127.0.0.1:3000', 'sec-fetch-site': 'cross-site' }, { host: '127.0.0.1:3000', 'x-forwarded-for': '8.8.8.8' }]) assert.throws(() => assertLocalPageRequest(new Headers(headers)));
    process.env.NODE_ENV = 'production';
    assert.throws(() => assertLocalPageRequest(new Headers({ host: '127.0.0.1:3000' })));
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('first-page PNG is rendered offline, summary excludes HTML/binary, and versioned assets support private HTTP caching', async context => {
  const pdf = makeResumePdf();
  const preview = await renderMasterPreview(pdf);
  const png = Buffer.from(preview.png, 'base64');
  assert.equal(preview.width, 640);
  assert.deepEqual(pngDimensions(png), { width: preview.width, height: preview.height });
  await assert.rejects(renderMasterPreview(new Uint8Array([1, 2, 3])), /preview could not be prepared/);
  const names = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
  const previous = names.map(name => process.env[name]);
  const calls = [];
  context.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(String(input)); calls.push(url.href);
    if (url.pathname.endsWith('/confirmed_master_resumes')) {
      const select = url.searchParams.get('select');
      if (select.includes('metadata:')) return Response.json({ id, filename: 'example.pdf', metadata, permissions, width: preview.width, height: preview.height });
      if (select === 'preview:content->preview') return Response.json({ preview });
      return Response.json({ id });
    }
    if (url.pathname.endsWith('/master_resume_uploads')) return Response.json({ id, storage_bucket: 'resumes', storage_path: `masters/${id}.pdf`, size_bytes: pdf.length, original_filename: 'example.pdf' });
    if (url.pathname.endsWith('/bucket/resumes')) return Response.json({ public: false });
    if (url.pathname.includes('/storage/v1/object/')) return new Response(pdf);
    throw new Error('External calls forbidden');
  });
  try {
    Object.assign(process.env, { NODE_ENV: 'development', SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SECRET_KEY: 'test' });
    const summary = await getMasterSummary(id);
    assert.equal(summary.candidate.name, 'Alex Example');
    assert.equal(summary.preview.width, 640);
    assert.equal(JSON.stringify(summary).includes('html'), false);
    assert.equal(JSON.stringify(summary).includes('png'), false);
    const thumbnail = await asset(request('thumbnail'), params('thumbnail'));
    assert.equal(thumbnail.status, 200);
    assert.equal(thumbnail.headers.get('cache-control'), 'private, max-age=86400, immutable');
    assert.deepEqual(Buffer.from(await thumbnail.arrayBuffer()), png);
    const notModified = await asset(request('thumbnail', { 'if-none-match': thumbnail.headers.get('etag') }), params('thumbnail'));
    assert.equal(notModified.status, 304);
    assert.equal((await notModified.arrayBuffer()).byteLength, 0);
    const original = await asset(request('pdf'), params('pdf'));
    assert.deepEqual(Buffer.from(await original.arrayBuffer()), pdf);
    assert.equal(calls.some(url => url.includes('active_master_resume')), false);
    const before = calls.length;
    assert.equal((await asset(request('thumbnail', { origin: 'https://foreign.invalid' }), params('thumbnail'))).status, 403);
    assert.equal((await asset(request('unsupported'), params('unsupported'))).status, 404);
    process.env.NODE_ENV = 'production';
    const blocked = await asset(request('thumbnail'), params('thumbnail'));
    assert.equal(blocked.status, 403);
    assert.equal(blocked.headers.get('cache-control'), 'no-store');
    assert.equal(calls.length, before);
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});
