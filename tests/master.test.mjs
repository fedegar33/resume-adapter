import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { masterContentSchema } from '@/lib/resumes/master';
import { POST as confirm } from '@/app/api/master-resume/confirm/route';
import { readActiveMasterId, getMasterSummary } from '@/lib/resumes/presentation.server';
import { processResumeFile } from '@/lib/resumes/process.client';
import { makeResumePdf } from './fixtures/resume.mjs';

const id = randomUUID();
const sectionId = randomUUID();
const content = {
  metadata: { schemaVersion: 1, uploadId: id, candidate: { name: 'Alex Example', role: null }, sections: [{ id: sectionId, title: 'Education' }] },
  html: '  <html><head></head><body>Example</body></html>\n',
  permissions: [{ sectionId, adaptable: true }],
};
const origin = 'http://127.0.0.1:3000';
const post = body => new Request(`${origin}/api/master-resume/confirm`, { method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('all section headings can be adaptable; permissions must cover each section exactly; raw HTML is preserved', () => {
  assert.equal(masterContentSchema.parse(content).html, content.html);
  for (const permissions of [[], [{ sectionId: randomUUID(), adaptable: true }], [...content.permissions, ...content.permissions]]) {
    assert.equal(masterContentSchema.safeParse({ ...content, permissions }).success, false);
  }
  assert.equal(masterContentSchema.safeParse({ ...content, metadata: { ...content.metadata, sections: [...content.metadata.sections, ...content.metadata.sections] } }).success, false);
});

test('confirmation uses private PDFs, atomic RPC, current SSR readers and safe errors', async context => {
  const names = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET'];
  const previous = names.map(name => process.env[name]);
  const pdf = makeResumePdf();
  let stored = null;
  let rpcError = null;
  let publicBucket = false;
  let rpcCount = 0;
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = String(input); calls.push(url);
    if (url.includes('/rpc/confirm_master_resume')) {
      rpcCount++;
      if (rpcError) return Response.json({ code: rpcError, message: 'private database details' }, { status: 400 });
      const body = JSON.parse(init.body);
      assert.equal(body.p_upload_id, id);
      const { preview, ...submitted } = body.p_content;
      assert.deepEqual(submitted, content);
      assert.equal(preview.width, 640);
      assert.ok(preview.png.startsWith("iVBOR"));
      assert.equal(body.p_expected_active_id, stored?.id ?? null);
      stored = { id, filename: 'example.pdf', content: body.p_content, confirmed_at: '2026-10-29T12:00:00Z' };
      return new Response(null, { status: 204 });
    }
    if (url.includes('/rest/v1/active_master_resume')) return Response.json(stored ? { master_id: id } : null);
    if (url.includes('/rest/v1/confirmed_master_resumes')) return Response.json(url.includes('metadata%3A') ? { id, filename: stored.filename, metadata: stored.content.metadata, permissions: stored.content.permissions, width: stored.content.preview.width, height: stored.content.preview.height } : stored);
    if (url.includes('/rest/v1/master_resume_uploads')) return Response.json({ id, storage_bucket: 'resumes', storage_path: `masters/${id}.pdf`, size_bytes: pdf.length, original_filename: 'example.pdf' });
    if (url.endsWith('/storage/v1/bucket/resumes')) return Response.json({ public: publicBucket });
    if (url.includes('/storage/v1/object/')) return new Response(pdf);
    throw new Error(`External request forbidden: ${url}`);
  });
  try {
    Object.assign(process.env, { NODE_ENV: 'development', SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SECRET_KEY: 'test', SUPABASE_STORAGE_BUCKET: 'resumes' });
    assert.equal(await readActiveMasterId(), null);
    assert.equal((await confirm(post({ content: { ...content, permissions: [] }, expectedActiveId: null }))).status, 400);
    assert.equal(rpcCount, 0);
    assert.equal((await confirm(post({ content, expectedActiveId: null }))).status, 200);
    assert.equal(await readActiveMasterId(), id);
    assert.equal((await getMasterSummary(id)).candidate.name, content.metadata.candidate.name);
    rpcError = '40001';
    assert.equal((await confirm(post({ content, expectedActiveId: null }))).status, 409);
    assert.equal(await readActiveMasterId(), id);
    assert.deepEqual(stored.content.permissions, content.permissions);
    rpcError = 'XX000';
    const failed = await confirm(post({ content, expectedActiveId: id }));
    assert.equal(failed.status, 502);
    assert.equal(JSON.stringify(await failed.json()).includes('private database'), false);
    publicBucket = true;
    const beforeRpc = rpcCount;
    assert.equal((await confirm(post({ content, expectedActiveId: id }))).status, 503);
    assert.equal(rpcCount, beforeRpc);
    const before = calls.length;
    process.env.NODE_ENV = 'production';
    assert.equal((await confirm(post({ content, expectedActiveId: id }))).status, 403);
    assert.equal(calls.length, before);
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});

test('real wizard pipeline reports phases, validates matching results and stops on conversion failure', async context => {
  const file = new File([makeResumePdf()], 'example.pdf');
  const calls = [];
  let fail = false;
  context.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    if (url.endsWith('/analyze')) return Response.json({ metadata: content.metadata });
    if (url.endsWith('/convert')) return fail ? Response.json({ error: 'Conversion failed' }, { status: 502 }) : Response.json({ uploadId: id, html: content.html });
    return Response.json({ id, filename: file.name });
  });
  const phases = [];
  const result = await processResumeFile(file, phase => phases.push(phase));
  assert.deepEqual(phases, ['uploading', 'analyzing', 'converting']);
  assert.equal(result.file, file);
  assert.equal(result.html, content.html);
  fail = true;
  await assert.rejects(processResumeFile(file, () => {}), /Conversion failed/);
  assert.equal(calls.some(url => url.endsWith('/confirm')), false);
});
